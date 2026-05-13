/**
 * ColliderDebug — visualisiert alle Rapier-Collider als Wireframes.
 *
 * Toggle mit C-Taste.
 *
 * Liest jede Frame world.debugRender() aus Rapier — gibt eine flache
 * Liste von Linien-Vertices + Farben zurück, die wir als THREE.LineSegments
 * rendern. Funktioniert für ALLE Collider-Typen (Trimesh, ConvexHull,
 * Cuboid, etc) ohne dass wir sie einzeln anfassen müssen.
 */

import * as THREE from "three";

export class ColliderDebug {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.physics = game.physics;
    this.visible = false;

    this.geo = new THREE.BufferGeometry();
    // K4-Fix: Vorab allokierte Buffer + setDrawRange statt per-Frame-Allocs.
    // Trimesh-Collider der Island hat 100k+ Liniensegmente (Terrain ist ein
    // detail-reiches Mesh), also brauchen wir ~256k Verts Puffer.
    this._maxVerts = 262144;
    this._posBuf = new Float32Array(this._maxVerts * 3);
    this._colBuf = new Float32Array(this._maxVerts * 4);
    this._posAttr = new THREE.BufferAttribute(this._posBuf, 3);
    this._colAttr = new THREE.BufferAttribute(this._colBuf, 4);
    this._posAttr.setUsage(THREE.DynamicDrawUsage);
    this._colAttr.setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute("position", this._posAttr);
    this.geo.setAttribute("color", this._colAttr);
    this.geo.setDrawRange(0, 0);

    this.mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });
    this.lines = new THREE.LineSegments(this.geo, this.mat);
    this.lines.frustumCulled = false;
    this.lines.visible = false;
    this.lines.renderOrder = 999;
    this.scene.add(this.lines);

    // Keyboard-Toggle: C
    this._onKey = (e) => {
      if (e.code === "KeyC") {
        this.visible = !this.visible;
        this.lines.visible = this.visible;
        console.log(`[ColliderDebug] ${this.visible ? "ON" : "OFF"}`);
      }
    };
    window.addEventListener("keydown", this._onKey);
  }

  update() {
    if (!this.visible) return;
    const world = this.physics?.world;
    if (!world?.debugRender) return;

    const buffers = world.debugRender();
    // buffers.vertices = Float32Array (xyz pairs für Liniensegmente)
    // buffers.colors   = Float32Array (rgba pro Vertex)

    // Overflow-Warn (einmalig) wenn unsere 64k-Buffer nicht reichen
    if (!this._overflowWarned && buffers.vertices.length / 6 > this._maxVerts / 2) {
      console.warn(
        `[ColliderDebug] segment count exceeds buffer cap (${buffers.vertices.length / 6} > ${this._maxVerts / 2}) — increase _maxVerts`,
      );
      this._overflowWarned = true;
    }

    // Player-Collider rausfiltern: Wir kennen die Bike-Position +
    // BIKE_HALF_SIZE. Jedes Liniensegment dessen BEIDE Endpunkte
    // innerhalb des Bike-AABB liegen, wird übersprungen.
    const player = this.game?.world?.player;
    const skipBox = this._getPlayerSkipBox(player);

    const inVerts = buffers.vertices;
    const inCols = buffers.colors;
    const segCount = inVerts.length / 6;     // 2 Verts (xyz) pro Segment

    const posBuf = this._posBuf;
    const colBuf = this._colBuf;
    const maxVerts = this._maxVerts;
    let w = 0;                                // Output-Segment-Index

    if (!skipBox) {
      // Kein Filter — alle Linien rein, aber wir kopieren in die festen Buffer
      const maxSegs = Math.min(segCount, maxVerts / 2);
      for (let s = 0; s < maxSegs; s++) {
        const i = s * 6;
        posBuf[s * 6 + 0] = inVerts[i + 0];
        posBuf[s * 6 + 1] = inVerts[i + 1];
        posBuf[s * 6 + 2] = inVerts[i + 2];
        posBuf[s * 6 + 3] = inVerts[i + 3];
        posBuf[s * 6 + 4] = inVerts[i + 4];
        posBuf[s * 6 + 5] = inVerts[i + 5];
        const ci = s * 8;
        for (let k = 0; k < 8; k++) colBuf[s * 8 + k] = inCols[ci + k];
      }
      w = maxSegs;
    } else {
      // Mit Filter
      for (let s = 0; s < segCount && w < maxVerts / 2; s++) {
        const i = s * 6;
        const ax = inVerts[i],     ay = inVerts[i + 1], az = inVerts[i + 2];
        const bx = inVerts[i + 3], by = inVerts[i + 4], bz = inVerts[i + 5];
        const aIn = this._isInBox(ax, ay, az, skipBox);
        const bIn = this._isInBox(bx, by, bz, skipBox);
        if (aIn && bIn) continue;
        posBuf[w * 6 + 0] = ax;
        posBuf[w * 6 + 1] = ay;
        posBuf[w * 6 + 2] = az;
        posBuf[w * 6 + 3] = bx;
        posBuf[w * 6 + 4] = by;
        posBuf[w * 6 + 5] = bz;
        const ci = s * 8;
        for (let k = 0; k < 8; k++) colBuf[w * 8 + k] = inCols[ci + k];
        w++;
      }
    }
    const usedVerts = w * 2;
    this.geo.setDrawRange(0, usedVerts);
    this._posAttr.needsUpdate = true;
    this._colAttr.needsUpdate = true;
  }

  _getPlayerSkipBox(player) {
    if (!player?.body) return null;
    const t = player.body.translation();
    // BIKE_HALF_SIZE ist [0.32, 0.45, 0.85], Cuboid sitzt 0.45 über Body-Origin
    // → AABB minimal vergrößern um Float-Toleranzen abzufangen
    const PAD = 0.05;
    return {
      minX: t.x - 0.32 - PAD,
      maxX: t.x + 0.32 + PAD,
      minY: t.y - PAD,           // Body-Origin bis Cuboid-Top
      maxY: t.y + 0.9 + PAD,
      minZ: t.z - 0.85 - PAD,
      maxZ: t.z + 0.85 + PAD,
    };
  }

  _isInBox(x, y, z, b) {
    return x >= b.minX && x <= b.maxX
        && y >= b.minY && y <= b.maxY
        && z >= b.minZ && z <= b.maxZ;
  }

  destroy() {
    window.removeEventListener("keydown", this._onKey);
    this.scene?.remove?.(this.lines);
    this.geo?.dispose?.();
    this.mat?.dispose?.();
  }
}
