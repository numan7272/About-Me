/**
 * EggClickHandler — Raycast-Click-Detection für interaktive Easter-Eggs.
 *
 * Egg-Meshes (Router, HQ) sind als Glow-Sphären in der Szene. Beim Hover über
 * eines davon ändert sich der Cursor zum Pointer + das Egg pulsiert stärker.
 * Beim Klick öffnet sich das zugehörige Mini-Game-Overlay.
 *
 * Lebt parallel zu ProximityTrigger (der weiterhin Walkthrough-Eggs verwaltet).
 *
 * UX-Details:
 *   - Pointermove auf Canvas → Raycast gegen alle eggMeshes mit isClickableEgg
 *   - Hover-State: cursor: pointer + mesh.userData.hovered = true (Animation lesen)
 *   - Click → game.ui.miniGames.open(eggId)
 *   - Touch: pointerup wird als Click gewertet wenn keine Bewegung war
 */

import * as THREE from "three";

const CLICK_DRAG_THRESHOLD = 6;   // px bewegt = drag, kein click

export class EggClickHandler {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.canvas = game.canvas;

    this._raycaster = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._hoveredId = null;

    // Click-Drag-Detect: pointerdown-Position merken, pointerup vergleichen
    this._downX = 0;
    this._downY = 0;
    this._downId = -1;

    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);

    this.canvas.addEventListener("pointermove", this._onPointerMove);
    this.canvas.addEventListener("pointerdown", this._onPointerDown);
    this.canvas.addEventListener("pointerup", this._onPointerUp);
  }

  /** Alle clickbaren Egg-Meshes aus ProximityTrigger.eggMeshes als Array. */
  _getClickableMeshes() {
    const map = this.game.world?.proximityTrigger?.eggMeshes;
    if (!map) return [];
    const out = [];
    for (const mesh of map.values()) {
      if (mesh.visible && mesh.userData?.isClickableEgg) {
        out.push(mesh);
      }
    }
    return out;
  }

  _clientToNDC(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    this._ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this._ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    return this._ndc;
  }

  _raycastEggs(clientX, clientY) {
    const camera = this.game.cameraRig?.camera;
    if (!camera) return null;
    const meshes = this._getClickableMeshes();
    if (!meshes.length) return null;
    const ndc = this._clientToNDC(clientX, clientY);
    this._raycaster.setFromCamera(ndc, camera);
    // Recursive: GLB-Egg-Meshes haben oft Sub-Meshes ohne userData.eggId.
    // intersectObjects mit recursive=true erfasst alle Children.
    const hits = this._raycaster.intersectObjects(meshes, true);
    if (!hits.length) return null;
    // Sub-Mesh gefunden → bubble up zum Root-Mesh (das mit userData.eggId).
    let obj = hits[0].object;
    while (obj && !obj.userData?.isClickableEgg) {
      obj = obj.parent;
    }
    return obj || null;
  }

  _onPointerMove(e) {
    // Wenn Joystick aktiv ist, kein Cursor-Update — sonst flackert's auf Mobile
    if (this.game.ui?.touchJoystick?.input?.active) return;

    const hit = this._raycastEggs(e.clientX, e.clientY);
    const newId = hit?.userData?.eggId || null;

    if (newId !== this._hoveredId) {
      // Alten Hover-State löschen
      if (this._hoveredId) {
        const old = this._getEggMesh(this._hoveredId);
        if (old) old.userData.hovered = false;
      }
      // Neuen Hover-State setzen
      if (newId) {
        hit.userData.hovered = true;
        this.canvas.style.cursor = "pointer";
      } else {
        this.canvas.style.cursor = "";
      }
      this._hoveredId = newId;
    }
  }

  _getEggMesh(id) {
    return this.game.world?.proximityTrigger?.eggMeshes?.get(id) || null;
  }

  _onPointerDown(e) {
    this._downX = e.clientX;
    this._downY = e.clientY;
    this._downId = e.pointerId ?? -1;
  }

  _onPointerUp(e) {
    // Drag-Check: wenn der Pointer signifikant bewegt wurde während down → kein Click
    const dx = e.clientX - this._downX;
    const dy = e.clientY - this._downY;
    if (Math.hypot(dx, dy) > CLICK_DRAG_THRESHOLD) return;

    // Walkthrough-Tour aktiv? Dann keine Mini-Games öffnen — sonst springt der
    // Recruiter aus der Tour-Pose raus mitten in eine fake-Desktop-App.
    if (this.game?.ui?.walkthrough?.active) return;

    const hit = this._raycastEggs(e.clientX, e.clientY);
    if (!hit) return;
    const eggId = hit.userData?.eggId;
    if (!eggId) return;

    e.preventDefault?.();
    e.stopPropagation?.();
    this._openMiniGame(eggId);
  }

  _openMiniGame(eggId) {
    // One-Time-Hint dismissen — der User hat's geschnallt.
    this.game.ui?.buildingsHint?.acknowledge?.();

    // Haptic-Feedback (Android, später iOS) — kurzes Tick beim Tap.
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      try { navigator.vibrate(10); } catch {}
    }

    const miniGames = this.game.ui?.miniGames;
    if (miniGames?.open) {
      miniGames.open(eggId);
    } else {
      console.warn("[EggClick] no MiniGames UI registered for", eggId);
    }
  }

  destroy() {
    this.canvas.removeEventListener("pointermove", this._onPointerMove);
    this.canvas.removeEventListener("pointerdown", this._onPointerDown);
    this.canvas.removeEventListener("pointerup", this._onPointerUp);
    this.canvas.style.cursor = "";
  }
}
