/**
 * TapToMoveController — League-of-Legends-Style "Tap-to-Move".
 *
 * User tippt/klickt irgendwo auf den Boden → Bike fährt autonom dorthin.
 *
 * Visuelles Feedback im Brutalist-HUD register: vier corner-brackets
 * (statt Ring) in Signal-Coral + zentrales Crosshair + dünne Coral-Linie
 * vom Bike zum Target. Kohärent mit dem HUD (hud-bracket Primitive in CSS).
 *
 * Aktiv nur wenn settings.controlMode === "tap". Sonst no-op.
 */

import * as THREE from "three";

const CLICK_DRAG_THRESHOLD = 6;
const MARKER_LIFETIME_MS = 1500;

// Warmes Bernstein aus der UI-Akzentfamilie. Bewusst satter als der
// Sand der Buttons — in der Welt braucht der Marker Kontrast auf Gras.
// toneMapped:false sorgt dafür dass es trotz ACES nicht ins Orange-Braun
// fadet — die Linie/das Crosshair sollen über Tag UND Nacht-Cycle gleich
// kräftig leuchten.
const SIGNAL_HEX = 0xffb454;
const MARKER_SIZE = 1.0;       // halbe Kantenlänge des Bracket-Quadrats in Welt-Metern
const BRACKET_ARM = 0.32;      // Länge der L-Bracket-Arme

export class TapToMoveController {
  constructor(game) {
    this.game = game;
    this.canvas = game.canvas;
    this.scene = game.scene;
    this.enabled = false;        // wird von Settings gesetzt

    this._raycaster = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._tmpHit = new THREE.Vector3();
    this._downX = 0; this._downY = 0;

    this._ringMeshes = [];      // aktive Tap-Marker auf der Ground
    this._lineMesh = null;      // Line vom Bike zum aktiven Target

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this.canvas.addEventListener("pointerdown", this._onPointerDown);
    this.canvas.addEventListener("pointerup", this._onPointerUp);

    this._buildLineMesh();
  }

  setEnabled(v) {
    this.enabled = !!v;
    if (!this.enabled) {
      this._clearAllVisuals();
      this.game.world?.player?.clearTapTarget?.();
    }
  }

  _onPointerDown(e) {
    this._downX = e.clientX; this._downY = e.clientY;
  }

  _onPointerUp(e) {
    if (!this.enabled) return;
    // Drag-Check
    if (Math.hypot(e.clientX - this._downX, e.clientY - this._downY) > CLICK_DRAG_THRESHOLD) return;
    // Tour-Sperre
    if (this.game?.ui?.walkthrough?.active) return;
    // Joystick aktiv? → nicht doppelt feuern
    if (this.game?.ui?.touchJoystick?.input?.active) return;
    // Building-Click? Wenn der Raycast ein clickable-Egg trifft, machen WIR
    // nichts (EggClickHandler übernimmt). Sonst Ground-Tap.
    if (this._hitClickableBuilding(e.clientX, e.clientY)) return;

    const groundPoint = this._raycastGround(e.clientX, e.clientY);
    if (!groundPoint) return;

    const player = this.game.world?.player;
    if (!player?.body) return;

    player.setTapTarget(groundPoint.x, groundPoint.z);
    this._spawnMarkerAt(groundPoint.x, groundPoint.z);
  }

  _hitClickableBuilding(clientX, clientY) {
    const map = this.game.world?.proximityTrigger?.eggMeshes;
    if (!map || !map.size) return false;
    const camera = this.game.cameraRig?.camera;
    if (!camera) return false;
    const ndc = this._clientToNDC(clientX, clientY);
    this._raycaster.setFromCamera(ndc, camera);
    const meshes = [...map.values()].filter((m) => m.visible);
    return this._raycaster.intersectObjects(meshes, true).length > 0;
  }

  _raycastGround(clientX, clientY) {
    const camera = this.game.cameraRig?.camera;
    if (!camera) return null;
    const ndc = this._clientToNDC(clientX, clientY);
    this._raycaster.setFromCamera(ndc, camera);
    const hit = this._raycaster.ray.intersectPlane(this._groundPlane, this._tmpHit);
    return hit ? { x: this._tmpHit.x, y: this._tmpHit.y, z: this._tmpHit.z } : null;
  }

  _clientToNDC(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    this._ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this._ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    return this._ndc;
  }

  // ─── Visuals ────────────────────────────────────────────────────────

  _buildLineMesh() {
    // Dünne Coral-Linie vom Bike zum Tap-Target. Renderorder hoch damit sie
    // über Grass/Road liegt; depthTest:false sorgt dafür dass kleine Höhen-
    // varianzen (Hügel) sie nicht abschneiden.
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    const mat = new THREE.LineBasicMaterial({
      color: SIGNAL_HEX,
      transparent: true,
      opacity: 0.65,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this._lineMesh = new THREE.Line(geo, mat);
    this._lineMesh.renderOrder = 60;
    this._lineMesh.visible = false;
    this.scene.add(this._lineMesh);
  }

  /**
   * Brutalist Bracket-Marker. Vier L-förmige Corner-Brackets bilden ein
   * Quadrat, plus zentrales Crosshair. Statt MeshRing → LineSegments mit
   * scharfen 90°-Ecken, kohärent mit dem .hud-bracket CSS-Primitive.
   *
   * Layout (Top-Down, X→right, Z→down):
   *
   *     ┌─        ─┐
   *
   *           ✛
   *
   *     └─        ─┘
   *
   * `+` Crosshair-Marker exact am Spot, 4 L-Brackets in MARKER_SIZE Distanz.
   */
  _spawnMarkerAt(x, z) {
    const S = MARKER_SIZE;
    const A = BRACKET_ARM;

    // Eckpunkt-Paare für die 4 L-Brackets. Jeder Bracket = 2 Line-Segments
    // (4 Vertices). 4 Brackets × 4 = 16 Vertices.
    const bracketPts = [
      // top-left: vertical down + horizontal right
      -S, 0, -S,     -S, 0, -S + A,
      -S, 0, -S,     -S + A, 0, -S,
      // top-right
       S, 0, -S,      S, 0, -S + A,
       S, 0, -S,      S - A, 0, -S,
      // bottom-left
      -S, 0,  S,     -S, 0,  S - A,
      -S, 0,  S,     -S + A, 0,  S,
      // bottom-right
       S, 0,  S,      S, 0,  S - A,
       S, 0,  S,      S - A, 0,  S,
    ];
    const bracketGeo = new THREE.BufferGeometry();
    bracketGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(bracketPts), 3),
    );
    const bracketMat = new THREE.LineBasicMaterial({
      color: SIGNAL_HEX,
      transparent: true,
      opacity: 1.0,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const brackets = new THREE.LineSegments(bracketGeo, bracketMat);
    brackets.position.set(x, 0.06, z);
    brackets.renderOrder = 60;
    brackets.userData._spawnTime = performance.now();
    brackets.userData._kind = "brackets";
    this.scene.add(brackets);

    // Zentrales Crosshair (+) am Spot, halb so prominent wie die Brackets.
    const C = 0.22;       // Arm-Länge des Crosshair
    const crossPts = [
      -C, 0, 0,   C, 0, 0,    // horizontal
       0, 0,-C,   0, 0, C,    // vertical
    ];
    const crossGeo = new THREE.BufferGeometry();
    crossGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(crossPts), 3),
    );
    const cross = new THREE.LineSegments(crossGeo, bracketMat.clone());
    cross.position.set(x, 0.07, z);
    cross.renderOrder = 60;
    cross.userData._spawnTime = performance.now();
    cross.userData._kind = "cross";
    this.scene.add(cross);

    this._clearRings();
    this._ringMeshes.push(brackets, cross);
  }

  _clearRings() {
    for (const r of this._ringMeshes) {
      this.scene.remove(r);
      r.geometry?.dispose?.();
      r.material?.dispose?.();
    }
    this._ringMeshes = [];
  }

  _clearAllVisuals() {
    this._clearRings();
    if (this._lineMesh) this._lineMesh.visible = false;
  }

  /** Pro Frame: Ring-Animation + Line zwischen Bike und Target. */
  update() {
    if (!this.enabled) {
      if (this._lineMesh?.visible) this._lineMesh.visible = false;
      return;
    }
    const now = performance.now();

    // Bracket + Cross Animation: kein Soft-Sin-Pulse mehr (zu weich für
    // brutalist register), sondern:
    //   Brackets: snappy expand 1.0 → 1.18 in 240ms, dann linear fade.
    //   Cross:    bleibt stabil mittig, linear fade.
    // Beide ease-out-expo damit der Snap-Effekt sich technisch anfühlt.
    const toRemove = [];
    const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
    for (const r of this._ringMeshes) {
      const age = now - r.userData._spawnTime;
      if (age > MARKER_LIFETIME_MS) {
        toRemove.push(r);
        continue;
      }
      const t = age / MARKER_LIFETIME_MS;
      if (r.userData._kind === "brackets") {
        // Schneller Expand (0..0.16 = 0..1), dann hold.
        const expandT = Math.min(1, age / 240);
        const scale = 1.0 + easeOutExpo(expandT) * 0.18;
        r.scale.set(scale, 1, scale);
      }
      // Opacity-Curve: voll für die ersten 35%, dann linear fade.
      const fade = t < 0.35 ? 1 : 1 - (t - 0.35) / 0.65;
      r.material.opacity = Math.max(0, fade);
    }
    for (const r of toRemove) {
      this.scene.remove(r);
      r.geometry?.dispose?.();
      r.material?.dispose?.();
      this._ringMeshes.splice(this._ringMeshes.indexOf(r), 1);
    }

    // Line-Update: zeige Verbindung Bike → Target solange Target aktiv
    const player = this.game.world?.player;
    const tap = player?._tapTarget;
    if (tap && player?.body) {
      const bikePos = player.body.translation();
      const arr = this._lineMesh.geometry.attributes.position.array;
      arr[0] = bikePos.x; arr[1] = 0.08; arr[2] = bikePos.z;
      arr[3] = tap.x;     arr[4] = 0.08; arr[5] = tap.z;
      this._lineMesh.geometry.attributes.position.needsUpdate = true;
      this._lineMesh.geometry.computeBoundingSphere();
      this._lineMesh.visible = true;
      // Linie fadet basierend auf Distanz
      const dist = Math.hypot(tap.x - bikePos.x, tap.z - bikePos.z);
      this._lineMesh.material.opacity = Math.min(0.6, dist * 0.08);
    } else {
      this._lineMesh.visible = false;
    }
  }

  destroy() {
    this.canvas.removeEventListener("pointerdown", this._onPointerDown);
    this.canvas.removeEventListener("pointerup", this._onPointerUp);
    this._clearAllVisuals();
    if (this._lineMesh) {
      this.scene.remove(this._lineMesh);
      this._lineMesh.geometry?.dispose?.();
      this._lineMesh.material?.dispose?.();
      this._lineMesh = null;
    }
  }
}
