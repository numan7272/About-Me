/**
 * CameraRig — Wrapper um THREE.PerspectiveCamera + OrbitControls.
 *
 * Phase 2: OrbitControls damit man die Insel anschauen kann.
 * Phase 3 wird das eine Follow-Cam die dem Bike hinterherfährt.
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/**
 * CameraRig — entweder OrbitControls (frei) oder Follow-Cam.
 *
 * Default: Follow-Cam wenn Player gesetzt ist, sonst Orbit. Wechsel via
 * setMode("follow" | "orbit"). Toggle mit Tab-Taste.
 *
 * Follow-Cam: Camera hängt 8m hinter dem Bike, 4m hoch, schaut leicht
 * nach unten auf Bike-Position. Smooth-lerp jede Frame.
 */

// Portiert aus dem alten FollowCamera.js (Next.js-Version).
// World-Space-Offset hinter+über Bike, OrbitControls bleiben dabei aktiv:
// User-Drag deaktiviert Follow temporär (orbit-free), Recenter reaktiviert.
const FOLLOW_OFFSET = new THREE.Vector3(11, 14, 11);
const FOLLOW_LOOK_OFFSET = new THREE.Vector3(0, 0.8, 0);
const FOLLOW_LERP = 0.07;
const LOOK_LERP = 0.10;

export class CameraRig {
  constructor(game) {
    this.game = game;
    this.player = null;
    this.followMode = true;  // wie followModeRef.current in alter Version

    // 1:1 aus Next.js Experience.js: fov 50, position (14,18,14), near 0.5, far 300
    this.camera = new THREE.PerspectiveCamera(
      50,
      game.sizes.aspect,
      0.5,
      300,
    );
    this.camera.position.set(14, 18, 14);
    this.camera.lookAt(0, 0, 0);
    game.scene.add(this.camera);

    // OrbitControls IMMER aktiv — User-Drag deaktiviert nur den Follow-Mode
    this.controls = new OrbitControls(this.camera, game.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 100;
    this.controls.minPolarAngle = Math.PI / 10;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.target.set(0, 0, 0);
    this.controls.update();

    // User-Drag deaktiviert Follow — aber NUR bei echtem Drag (mousedown + move),
    // nicht bei jedem Klick aufs Canvas. Sonst killt z.B. ein versehentlicher
    // Klick während WASD-Fahrt sofort den Follow-Mode.
    this._pointerDown = false;
    this._pointerDragged = false;
    this._pointerDownPos = { x: 0, y: 0 };
    const DRAG_THRESHOLD = 4;   // px bevor wir's als Drag werten

    const onPointerDown = (e) => {
      // Joystick-Aktiv-Lock: wenn der Touch-Joystick gerade eine Geste hat,
      // ignorieren wir Camera-Drag-Events. Sonst dreht die Camera mit beim
      // Joystick-Touch — UX-Killer auf Mobile.
      if (this._isJoystickActive()) return;
      this._pointerDown = true;
      this._pointerDragged = false;
      this._pointerDownPos.x = e.clientX;
      this._pointerDownPos.y = e.clientY;
    };
    const onPointerMove = (e) => {
      if (this._isJoystickActive()) {
        // Falls Geste mitten im Drag startet, brechen wir den Camera-Drag ab
        this._pointerDown = false;
        return;
      }
      if (!this._pointerDown || this._pointerDragged) return;
      const dx = e.clientX - this._pointerDownPos.x;
      const dy = e.clientY - this._pointerDownPos.y;
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        this._pointerDragged = true;
        this.followMode = false;
        if (this._flyActive) this.cancelFly();
      }
    };
    const onPointerUp = () => {
      this._pointerDown = false;
    };
    // Wheel = Zoom = ebenfalls "User will Kamera selber steuern".
    // Auch ein laufender Fly-To wird gecancelt.
    const onWheel = () => {
      this.followMode = false;
      if (this._flyActive) this.cancelFly();
    };

    game.canvas.addEventListener("pointerdown", onPointerDown);
    game.canvas.addEventListener("pointermove", onPointerMove);
    game.canvas.addEventListener("pointerup", onPointerUp);
    game.canvas.addEventListener("pointercancel", onPointerUp);
    game.canvas.addEventListener("wheel", onWheel, { passive: true });

    // Listener-Refs für destroy()
    this._listeners = {
      onPointerDown, onPointerMove, onPointerUp, onWheel,
    };

    // Reusable
    this._desiredPos = new THREE.Vector3();
    this._desiredTarget = new THREE.Vector3();

    // Fly-To-State (Sprint B2)
    this._flyActive = false;
    this._flyT = 0;
    this._flyDuration = 1.6;
    this._flyFromPos = new THREE.Vector3();
    this._flyFromTarget = new THREE.Vector3();
    this._flyToPos = new THREE.Vector3();
    this._flyToTarget = new THREE.Vector3();
    this._flyOnComplete = null;

    // Intro-Orbit: langsame Kamerafahrt um die Insel solange der
    // Loading-Splash steht. Die Welt selbst ist der Ladescreen.
    this._introOrbit = false;
    this._introT = 0;
  }

  /**
   * Cinematic Intro-Orbit starten (läuft bis endIntroOrbit/flyTo).
   * opts: { center: [x,y,z], radius, height, period (s/Runde), targetY }
   * Default: enge Fahrt um den Bike-Spawn (Spotlight-Moment).
   */
  startIntroOrbit(opts = {}) {
    this._introOrbit = true;
    this._introT = 0;
    this._introCenter = opts.center || [-4.4, 0.5, 16.6];
    this._introRadius = opts.radius ?? 10;
    this._introHeight = opts.height ?? 5.4;
    this._introSpeed = (Math.PI * 2) / (opts.period ?? 38);
    this._introTargetY = opts.targetY ?? 1.0;
    this.followMode = false;
  }

  /**
   * Intro beenden: aus dem Orbit hinter das Bike schwingen, danach
   * Follow-Cam aktivieren. onArrive feuert wenn die Kamera steht.
   */
  endIntroOrbit(onArrive) {
    this._introOrbit = false;
    const t = this.player?.body?.translation?.();
    if (!t) {
      this.followMode = true;
      onArrive?.();
      return;
    }
    this.flyTo([t.x, t.y, t.z], {
      duration: 1.8,
      cameraPos: [t.x + FOLLOW_OFFSET.x, t.y + FOLLOW_OFFSET.y, t.z + FOLLOW_OFFSET.z],
      lookAt: [t.x, t.y + FOLLOW_LOOK_OFFSET.y, t.z],
      onComplete: () => {
        this.followMode = true;
        onArrive?.();
      },
    });
  }

  /**
   * Cinematic Smooth-Flight zu einer Ziel-Position. Während Fly-To ist
   * Follow-Mode pausiert. Nach Abschluss → optional callback.
   *
   * @param {[number,number,number]} target — Look-At-Punkt (Fallback wenn
   *   keine explizite `lookAt`-Opt gegeben). Camera landet dann in
   *   Default-Iso-Position (FOLLOW_OFFSET relativ zu target).
   * @param {Object} opts — {
   *     duration: 1.6,
   *     onComplete: fn,
   *     cameraPos: [x,y,z]  — explizite Camera-Position (überschreibt Default)
   *     lookAt:    [x,y,z]  — expliziter Look-At (überschreibt target)
   *   }
   */
  flyTo(target, opts = {}) {
    if (!Array.isArray(target) || target.length < 3) return;
    this._flyDuration = Math.max(0.4, opts.duration ?? 1.6);
    this._flyOnComplete = opts.onComplete || null;
    this._flyT = 0;

    // Look-At-Punkt: opts.lookAt > target
    const la = Array.isArray(opts.lookAt) && opts.lookAt.length >= 3
      ? opts.lookAt
      : [target[0], target[1] + 1.0, target[2]];
    this._flyToTarget.set(la[0], la[1], la[2]);

    // Camera-Position: opts.cameraPos > Default-Iso
    const cam = Array.isArray(opts.cameraPos) && opts.cameraPos.length >= 3
      ? opts.cameraPos
      : [
          target[0] + FOLLOW_OFFSET.x,
          target[1] + FOLLOW_OFFSET.y,
          target[2] + FOLLOW_OFFSET.z,
        ];
    this._flyToPos.set(cam[0], cam[1], cam[2]);

    // Aktuelle Position als Startpunkt einfrieren
    this._flyFromPos.copy(this.camera.position);
    this._flyFromTarget.copy(this.controls.target);

    this._flyActive = true;
    this.followMode = false;   // Follow während Fly-To aus
  }

  /** Cancelt eine laufende Fly-Animation (z.B. wenn User WASD drückt) */
  cancelFly() {
    this._flyActive = false;
    this._flyOnComplete = null;
  }

  /** Wird vom onPointerDown/Move geprüft. Wenn der Touch-Joystick gerade
   *  eine aktive Geste hat, blockt CameraRig die OrbitControls-Drag-Logik. */
  _isJoystickActive() {
    return !!this.game?.ui?.touchJoystick?.input?.active;
  }

  setPlayer(player) {
    this.player = player;
    // Während des Intro-Orbits bleibt die Kamera auf ihrer Inselfahrt —
    // Follow übernimmt erst nach endIntroOrbit().
    if (!this._introOrbit) this.followMode = true;
  }

  /** Re-enable follow mode (für "Zentrieren"-Button) */
  recenter() {
    this.followMode = true;
  }

  onResize(width, height) {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  update() {
    // ── Intro-Orbit: langsame Kreisfahrt um den Spawn-Punkt ──
    if (this._introOrbit) {
      const dt = this.game?.time?.delta || 0.016;
      this._introT += dt;
      // Sanfter Ein-Schwung in den ersten 2s
      const ease = Math.min(1, this._introT / 2);
      const a = this._introT * this._introSpeed;
      const r = this._introRadius + (1 - ease) * 2;
      const [cx, cy, cz] = this._introCenter;
      this.camera.position.set(
        cx + Math.cos(a) * r,
        cy + this._introHeight,
        cz + Math.sin(a) * r,
      );
      this.controls.target.set(cx, cy + this._introTargetY, cz);
      this.controls.update();
      return;
    }

    // ── Fly-To läuft? Dann tween'en wir Camera + Target. ──
    if (this._flyActive) {
      const dt = this.game?.time?.delta || 0.016;
      this._flyT += dt;
      let p = Math.min(1, this._flyT / this._flyDuration);
      // Cubic ease-in-out für cinematic smooth motion
      const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

      this.camera.position.lerpVectors(this._flyFromPos, this._flyToPos, eased);
      this.controls.target.lerpVectors(this._flyFromTarget, this._flyToTarget, eased);

      if (p >= 1) {
        this._flyActive = false;
        const cb = this._flyOnComplete;
        this._flyOnComplete = null;
        // Nach Fly-To bleibt Follow ausgeschaltet — Recruiter sieht die
        // Station ruhig stehen. User kann mit WASD oder Recenter wieder
        // in den Follow-Mode wechseln.
        if (cb) cb();
      }
      this.controls.update();
      return;
    }

    // Follow nur aktiv wenn Player + followMode an
    if (this.player?.body && this.followMode) {
      const t = this.player.body.translation();

      this._desiredPos.set(
        t.x + FOLLOW_OFFSET.x,
        t.y + FOLLOW_OFFSET.y,
        t.z + FOLLOW_OFFSET.z,
      );
      this._desiredTarget.set(
        t.x + FOLLOW_LOOK_OFFSET.x,
        t.y + FOLLOW_LOOK_OFFSET.y,
        t.z + FOLLOW_LOOK_OFFSET.z,
      );

      this.camera.position.lerp(this._desiredPos, FOLLOW_LERP);
      this.controls.target.lerp(this._desiredTarget, LOOK_LERP);
    }
    this.controls.update();
  }

  destroy() {
    const c = this.game?.canvas;
    if (c && this._listeners) {
      c.removeEventListener("pointerdown", this._listeners.onPointerDown);
      c.removeEventListener("pointermove", this._listeners.onPointerMove);
      c.removeEventListener("pointerup", this._listeners.onPointerUp);
      c.removeEventListener("pointercancel", this._listeners.onPointerUp);
      c.removeEventListener("wheel", this._listeners.onWheel);
    }
    this.controls?.dispose?.();
  }
}
