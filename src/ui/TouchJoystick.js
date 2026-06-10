/**
 * TouchJoystick — In-World-3D-Joystick als Mesh in der Szene.
 *
 * Zwei dünne Ringe + ein Sweep-Arc (Tortenstück) liegen am Bike auf der
 * Ground-Plane. Kein DOM-Overlay, kein Knob — der Arc zeigt in die Richtung
 * in die der Finger zieht. Die Dial folgt dem Bike jeden Frame und richtet
 * sich an der Camera-Yaw aus.
 *
 * Public-State (gelesen von Player.js):
 *   - this.input.x       : -1..+1 (Camera-Right, Screen-Right)
 *   - this.input.y       : -1..+1 (Camera-Forward, Screen-Up)
 *   - this.input.active  : true wenn Geste läuft
 *   - this.input.magnitude : 0..1
 *
 * Player.js liest das in der Movement-Pipeline als Heading-Vector (siehe
 * altes About-Me-Repo): desiredYaw = atan2(jX, jY) in cam-relative Space,
 * Bike rotiert per P-Controller hin, Throttle = magnitude.
 *
 * Camera-Lock: solange this.input.active === true ignoriert CameraRig
 * Drag-Events. Verhindert dass die Kamera mitwackelt.
 *
 * Aktiv nur auf Touch-Devices. ?touch=1 erzwingt Anzeige für Desktop-Tests.
 */

import * as THREE from "three";

// Dot-Trail Joystick — eigener Stil.
// Outline-Ring als Begrenzung, dazu Pool von Dots die als Trail vom Bike-Center
// in Finger-Richtung aufleuchten. Dot weiter außen = heller + größer.
const RING_R           = 2.4;            // Outline-Ring-Radius
const RING_W           = 0.05;            // Outline-Stärke
const DOT_COUNT        = 6;              // Anzahl Dots im Trail
const DOT_START_OFFSET = 0.45;           // erster Dot startet hier vom Center
const DOT_BASE_SIZE    = 0.06;           // Innen-Dot Größe
const DOT_END_SIZE     = 0.20;           // Außen-Dot Größe
const CAPTURE_R        = 3.6;
const DEAD_ZONE        = 0.10;
const DIAL_Y           = 0.04;

export class TouchJoystick {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;

    // Externer Read-Only State für Player.js + CameraRig
    this.input = {
      x: 0,
      y: 0,
      magnitude: 0,
      active: false,
    };

    // Reusable temps
    this._dragNDC   = new THREE.Vector2();
    this._dragRay   = new THREE.Raycaster();
    this._dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -DIAL_Y);
    this._tmpHit    = new THREE.Vector3();
    this._tmpLocal  = new THREE.Vector3();
    this._camFwd    = new THREE.Vector3();
    this._camRight  = new THREE.Vector3();
    this._basis     = new THREE.Matrix4();
    this._xAxis     = new THREE.Vector3();
    this._yAxis     = new THREE.Vector3(0, 1, 0);
    this._zAxis     = new THREE.Vector3();

    this._activePointerId = -1;

    this._buildGroup();
    this._bindEvents();

    // Sichtbarkeit
    const isTouch = this._isTouchDevice();
    this.group.visible = isTouch;
  }

  _isTouchDevice() {
    if (typeof window === "undefined") return false;
    const url = new URL(window.location.href);
    if (url.searchParams.has("touch")) return true;
    if (window.matchMedia?.("(hover: none)")?.matches) return true;
    if (window.matchMedia?.("(max-width: 767px)")?.matches) return true;
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }

  _buildGroup() {
    this.group = new THREE.Group();
    this.group.name = "TouchJoystickDial";

    // ── Outline-Ring — dünne Begrenzung der Disc ──
    const ringGeo = new THREE.RingGeometry(
      RING_R - RING_W / 2,
      RING_R + RING_W / 2,
      96,
    );
    this.outerRing = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.32,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
    );
    this.outerRing.rotation.x = -Math.PI / 2;
    this.outerRing.renderOrder = 50;
    this.group.add(this.outerRing);

    // ── Dot-Trail — Pool von kleinen Kreisen, vom Center zum Finger ──
    // Jeder Dot ist ein eigenes Mesh damit wir Position + Größe + Opacity
    // einzeln pro Frame animieren können. Geometrien sind unit-CircleGeometry
    // (Radius 1), wir nutzen mesh.scale für die Größe.
    this.dots = [];
    this.arcGroup = new THREE.Group();    // alte Variable bleibt — wird aber nicht mehr genutzt
    const dotGeo = new THREE.CircleGeometry(1, 24);
    for (let i = 0; i < DOT_COUNT; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      const dot = new THREE.Mesh(dotGeo, mat);
      dot.rotation.x = -Math.PI / 2;
      dot.renderOrder = 52;
      dot.position.y = 0.002;
      this.group.add(dot);
      this.dots.push(dot);
    }
    // Geometry für späteres dispose
    this._dotGeo = dotGeo;

    // Backwards-compat: alter Code referenziert this.arc.material.opacity
    // für show/hide. Wir machen einen Dummy damit das nicht crasht.
    this.arc = { material: { opacity: 0 } };

    // ── Capture-Disc (unsichtbar, hit-test für Gesture-Start) ──
    const captureGeo = new THREE.CircleGeometry(CAPTURE_R, 48);
    const captureMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
    });
    this.captureDisc = new THREE.Mesh(captureGeo, captureMat);
    this.captureDisc.rotation.x = -Math.PI / 2;
    this.captureDisc.position.y = 0.05;
    this.captureDisc.renderOrder = 53;
    this.captureDisc.userData.isJoystickCapture = true;
    this.group.add(this.captureDisc);

    this.scene.add(this.group);
  }

  _bindEvents() {
    const canvas = this.game.canvas;
    if (!canvas) return;

    // PointerDown auf Canvas → Raycast gegen Capture-Disc
    this._onPointerDown = (e) => {
      if (!this.group.visible) return;
      if (this.input.active) return;            // schon eine Geste aktiv
      const ndc = this._clientToNDC(e.clientX, e.clientY);
      if (!ndc) return;
      this._dragRay.setFromCamera(ndc, this.game.cameraRig.camera);
      const hits = this._dragRay.intersectObject(this.captureDisc, false);
      if (hits.length > 0) {
        e.preventDefault?.();
        e.stopPropagation?.();
        // OrbitControls KOMPLETT deaktivieren während Geste — sonst dreht
        // die Camera mit, weil OrbitControls direkt auf Canvas hört.
        const controls = this.game?.cameraRig?.controls;
        if (controls) {
          this._controlsWasEnabled = controls.enabled;
          controls.enabled = false;
        }
        this.input.active = true;
        this._activePointerId = e.pointerId ?? -1;
        this.arc.material.opacity = 0;
        this._writeFromClient(e.clientX, e.clientY);
      }
    };

    this._onPointerMove = (e) => {
      if (!this.input.active) return;
      if (this._activePointerId !== -1 && e.pointerId !== undefined
          && e.pointerId !== this._activePointerId) return;
      e.preventDefault?.();
      this._writeFromClient(e.clientX, e.clientY);
    };

    this._onPointerUp = (e) => {
      if (!this.input.active) return;
      if (this._activePointerId !== -1 && e.pointerId !== undefined
          && e.pointerId !== this._activePointerId) return;
      e?.preventDefault?.();
      this._endGesture();
    };

    // Pointer-Events bevorzugt (modern). Touch parallel für ältere iOS.
    canvas.addEventListener("pointerdown", this._onPointerDown);
    window.addEventListener("pointermove", this._onPointerMove, { passive: false });
    window.addEventListener("pointerup", this._onPointerUp);
    window.addEventListener("pointercancel", this._onPointerUp);

    // Tab-Blur: Geste komplett zurücksetzen — Refs für sauberen Cleanup speichern
    this._onBlur = () => this._endGesture();
    this._onVisibilityChange = () => {
      if (document.hidden) this._endGesture();
    };
    window.addEventListener("blur", this._onBlur);
    document.addEventListener("visibilitychange", this._onVisibilityChange);
  }

  _endGesture() {
    const hadGesture = this.input.active || this._controlsWasEnabled !== undefined;
    this.input.active = false;
    this.input.x = 0;
    this.input.y = 0;
    this.input.magnitude = 0;
    this._activePointerId = -1;
    if (this.dots) {
      for (let i = 0; i < this.dots.length; i++) {
        this.dots[i].material.opacity = 0;
      }
    }
    this._applyToInputs(0, 0);
    // OrbitControls NUR reaktivieren wenn wir sie auch deaktiviert haben.
    // Sonst überschreiben wir andere UI-Code-Pfade (Mini-Games, Settings) die
    // OrbitControls aus eigenen Gründen aus haben.
    if (hadGesture) {
      const controls = this.game?.cameraRig?.controls;
      if (controls) {
        controls.enabled = (this._controlsWasEnabled !== undefined)
          ? this._controlsWasEnabled
          : true;
        this._controlsWasEnabled = undefined;
      }
    }
  }

  _clientToNDC(clientX, clientY) {
    const canvas = this.game.canvas;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  _writeFromClient(clientX, clientY) {
    const ndc = this._clientToNDC(clientX, clientY);
    if (!ndc) return;
    this._dragNDC.copy(ndc);
    this._dragRay.setFromCamera(this._dragNDC, this.game.cameraRig.camera);
    const hit = this._dragRay.ray.intersectPlane(this._dragPlane, this._tmpHit);
    if (!hit) return;

    this._tmpLocal.copy(this._tmpHit);
    this.group.worldToLocal(this._tmpLocal);

    const lx = this._tmpLocal.x;
    const lz = this._tmpLocal.z;

    // INVERTIERTER Z-Flip: Finger nach oben am Screen → outY > 0 (vorwärts).
    // Normalisierung gegen RING_R — bei diesem Radius = magnitude=1 (volle Auslenkung).
    // Wichtig: erst die *Magnitude* cappen, dann die Achsen. Achsen einzeln zu
    // clampen verzerrt die Richtung außerhalb des Rings (Finger 30° vom Forward,
    // weit gezogen → Joystick liest 45° = Diagonal-Snap-Bug).
    let nx = lx / RING_R;
    let nz = -lz / RING_R;
    const rawMag = Math.hypot(nx, nz);
    if (rawMag > 1) {
      nx /= rawMag;
      nz /= rawMag;
    }

    const mag = Math.hypot(nx, nz);
    const dz  = DEAD_ZONE;
    let outX = nx;
    let outY = nz;

    if (mag < dz) {
      outX = 0;
      outY = 0;
    }

    this.input.x = outX;
    this.input.y = outY;
    this.input.magnitude = Math.min(1, mag);

    // ─── Dot-Trail vom Center zum Finger ───
    // Jeder Dot sitzt auf einer Linie zwischen Bike-Center und Finger-Position.
    // Position-Parameter t läuft DOT_START_OFFSET/RING_R … 1 (Finger).
    // Außen liegende Dots werden größer und heller, innen kleiner und dezenter.
    if (mag > 0.001) {
      // Finger-Richtung in group-local (kommt aus lx, lz). Normalisieren.
      const dirLen = Math.hypot(lx, lz) || 1;
      const dirX = lx / dirLen;
      const dirZ = lz / dirLen;

      // Maximaler Trail-Reach = wie weit der Finger gezogen ist, max bis RING_R.
      const reach = Math.min(RING_R, Math.hypot(lx, lz));

      for (let i = 0; i < DOT_COUNT; i++) {
        const dot = this.dots[i];
        // t = 0 → Center, t = 1 → äußerster Punkt
        const t = (i + 1) / DOT_COUNT;
        const r = DOT_START_OFFSET + t * (reach - DOT_START_OFFSET);
        dot.position.x = dirX * r;
        dot.position.z = dirZ * r;
        // Größe wächst linear von base zu end
        const size = DOT_BASE_SIZE + t * (DOT_END_SIZE - DOT_BASE_SIZE);
        dot.scale.setScalar(size);
        // Opacity steigt nach außen + skaliert mit magnitude
        dot.material.opacity = (0.25 + t * 0.65) * Math.min(1, mag);
      }
    } else {
      for (let i = 0; i < this.dots.length; i++) {
        this.dots[i].material.opacity = 0;
      }
    }

    this._applyToInputs(outX, outY);
  }

  /**
   * Joystick-State wird primär über this.input.x/y gelesen (Player.js).
   * Wir setzen keine fake-Keyboard-Tasten mehr — der Joystick-Pfad in
   * Player.js ist explizit getrennt. Brake passiert automatisch beim
   * Loslassen (keine Velocity → Bike rollt aus). Ein "Finger nach unten
   * = brake"-Override würde mit dem Heading-Vector-Konzept kollidieren:
   * im Heading-Style ist "unten am Screen" eine Fahrt-Richtung, kein Stop.
   */
  _applyToInputs(_nx, _nz) {
    const inputs = this.game?.inputs;
    if (!inputs?.keys) return;
    inputs.keys.brake = false;
  }

  /** Jeden Frame: Group dem Bike folgen lassen + cam-relative orientieren */
  update() {
    if (!this.group.visible) return;
    const player = this.game.world?.player;
    if (!player?.body) return;
    const camera = this.game.cameraRig?.camera;
    if (!camera) return;

    // Bike-Position (XZ) auf Ground-Plane
    const t = player.body.translation();
    this.group.position.set(t.x, DIAL_Y, t.z);

    // Cam-relative Orientierung — group.local +Z zeigt zur Camera-Forward
    camera.getWorldDirection(this._camFwd);
    this._camFwd.y = 0;
    if (this._camFwd.lengthSq() < 0.0001) return;
    this._camFwd.normalize();
    this._camRight.set(-this._camFwd.z, 0, this._camFwd.x);

    this._xAxis.copy(this._camRight);
    this._zAxis.copy(this._camFwd);
    this._basis.makeBasis(this._xAxis, this._yAxis, this._zAxis);
    this.group.quaternion.setFromRotationMatrix(this._basis);

    // Outline-Ring atmet langsam.
    const t2 = (this.game?.time?.elapsed || 0);
    this.outerRing.material.opacity = 0.28 + Math.sin(t2 * 1.4) * 0.06;

    // Dot-Trail pulst wenn aktiv — Welle die vom Center nach außen läuft.
    if (this.input.active && this.dots) {
      for (let i = 0; i < this.dots.length; i++) {
        const dot = this.dots[i];
        // Wellenfaktor: 0.85 .. 1.15 je nach Phase. Jeder Dot ist um i*0.4 versetzt.
        const wave = 1 + Math.sin(t2 * 4 - i * 0.6) * 0.15;
        // scale ist bereits vom Writer gesetzt — wir multiplizieren mit wave.
        const baseSize = DOT_BASE_SIZE + ((i + 1) / DOT_COUNT)
          * (DOT_END_SIZE - DOT_BASE_SIZE);
        dot.scale.setScalar(baseSize * wave);
      }
    }
  }

  setVisible(v) {
    if (this.group) this.group.visible = v;
    if (!v) this._endGesture();
  }

  destroy() {
    // Alle Event-Listener entfernen (vorher leakten window-level pointer-Events)
    const canvas = this.game?.canvas;
    if (canvas && this._onPointerDown) {
      canvas.removeEventListener("pointerdown", this._onPointerDown);
    }
    if (this._onPointerMove) {
      window.removeEventListener("pointermove", this._onPointerMove);
    }
    if (this._onPointerUp) {
      window.removeEventListener("pointerup", this._onPointerUp);
      window.removeEventListener("pointercancel", this._onPointerUp);
    }
    if (this._onBlur) {
      window.removeEventListener("blur", this._onBlur);
    }
    if (this._onVisibilityChange) {
      document.removeEventListener("visibilitychange", this._onVisibilityChange);
    }

    this.scene?.remove?.(this.group);
    this.outerRing?.geometry?.dispose?.();
    this.outerRing?.material?.dispose?.();
    this._dotGeo?.dispose?.();
    if (this.dots) {
      for (const d of this.dots) d.material?.dispose?.();
    }
    this.captureDisc?.geometry?.dispose?.();
    this.captureDisc?.material?.dispose?.();
  }
}
