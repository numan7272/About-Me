/**
 * TapToMoveController — League-of-Legends-Style "Tap-to-Move".
 *
 * User tippt/klickt irgendwo auf den Boden → Bike fährt autonom dorthin.
 *
 * Mechanismus:
 *   1. PointerUp auf Canvas (kein Drag, keine Building-Click-Geste)
 *   2. Raycast gegen eine unsichtbare Ground-Plane (Y=0)
 *   3. Treffer-Punkt = Tap-Target an Player weitergeben
 *   4. Visuelles Feedback: pulsierender Ring am Spot + Linie vom Bike
 *      für 1.5s, dann fade-out
 *
 * Aktiv nur wenn settings.controlMode === "tap". Sonst no-op.
 *
 * Konflikte mit anderen Click-Targets sind sauber gelöst:
 *   - Walkthrough-Tour aktiv → no-op
 *   - Building-Click (EggClickHandler) → trifft Mesh erst, läuft vorher
 *   - Joystick-Geste → TouchJoystick captured pointerdown, kein conflict
 */

import * as THREE from "three";

const CLICK_DRAG_THRESHOLD = 6;
const RING_LIFETIME_MS = 1500;

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
    this._spawnRingAt(groundPoint.x, groundPoint.z);
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
    // Eine dünne Linie vom Bike zum Tap-Target.
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0x7ec8ff,
      transparent: true,
      opacity: 0.6,
      depthTest: false,
      depthWrite: false,
    });
    this._lineMesh = new THREE.Line(geo, mat);
    this._lineMesh.renderOrder = 60;
    this._lineMesh.visible = false;
    this.scene.add(this._lineMesh);
  }

  _spawnRingAt(x, z) {
    // Ring auf der Ground-Plane bei Tap-Spot
    const RING_R_OUTER = 0.95;
    const RING_R_INNER = 0.55;
    const geo = new THREE.RingGeometry(RING_R_INNER, RING_R_OUTER, 48);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x7ec8ff,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.05, z);
    ring.renderOrder = 60;
    ring.userData._spawnTime = performance.now();
    this.scene.add(ring);

    // Sekundärer kleiner Punkt in der Mitte
    const dotGeo = new THREE.CircleGeometry(0.18, 24);
    const dot = new THREE.Mesh(dotGeo, mat.clone());
    dot.rotation.x = -Math.PI / 2;
    dot.position.set(x, 0.06, z);
    dot.renderOrder = 60;
    dot.userData._spawnTime = performance.now();
    this.scene.add(dot);

    // Alte Ringe entfernen (nur ein Target gleichzeitig aktiv)
    this._clearRings();
    this._ringMeshes.push(ring, dot);
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

    // Ring-Animation: pulsieren + fade-out
    const toRemove = [];
    for (const r of this._ringMeshes) {
      const age = now - r.userData._spawnTime;
      if (age > RING_LIFETIME_MS) {
        toRemove.push(r);
        continue;
      }
      const t = age / RING_LIFETIME_MS;
      // Scale-Pulse: 1.0 → 1.4 dann wieder runter
      const pulse = 1.0 + Math.sin(t * Math.PI) * 0.3;
      r.scale.set(pulse, pulse, pulse);
      // Opacity: 0.95 → 0
      r.material.opacity = 0.95 * (1 - t);
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
