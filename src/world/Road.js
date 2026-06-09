/**
 * Road — Tarmac-Streifen als Ring durch alle 5 Stationen.
 *
 * Portiert aus altem Next.js RoadOverlay.js.
 *
 * Algorithmus:
 *   1) Pro Building einen Wegpunkt berechnen, der RADIAL einwärts liegt
 *      (alle Wegpunkte auf Radius ~28m vom Zentrum) → ovale Ringstraße
 *      in der Wiese, keine Selbst-Kreuzungen.
 *   2) Nach Winkel um Insel-Zentrum sortieren → cleane Ringfolge im UZS.
 *   3) CatmullRomCurve3 (closed, tension 0.5) → glatte 3D-Kurve.
 *   4) Pro Sample: 2 Verts (links/rechts der Tangente). Raycast pro
 *      Vertex aufs Terrain → echte Y-Höhe inkl. Querneigung.
 *   5) Mittellinie als zweite, dünne, gestrichelte Strip-Geometry.
 */

import * as THREE from "three";

const TARGET_RADIUS = 28.0;    // alle Wegpunkte ~28m vom Zentrum
const Y_OFFSET = 0.03;         // Straße 3cm über Terrain — sichtbar aber flach
const SAMPLES = 600;
const ROAD_WIDTH = 3.5;
const LANE_WIDTH = 0.18;

export class Road {
  constructor(game, buildings, terrainObj) {
    this.game = game;
    this.scene = game.scene;
    this.physics = game.physics;
    this.buildings = buildings;
    this.terrainObj = terrainObj;

    this.group = new THREE.Group();
    this.group.name = "Road";

    this.curve = null;
    this.asphaltMesh = null;
    this.laneMesh = null;
    this.geometry = null;
    this.laneGeometry = null;

    this._build();
    this.scene.add(this.group);
    // Kein Collider — Road ist nur Visual. Bike fährt auf Terrain-Trimesh.
  }

  _build() {
    if (!this.buildings || this.buildings.length < 3) {
      console.warn("[Road] not enough buildings to build road:", this.buildings?.length);
      return;
    }

    const waypoints = this._buildWaypoints(this.buildings);
    console.log("[Road] waypoints:",
      waypoints.map(w => `${w.id}@(${w.x.toFixed(1)},${w.z.toFixed(1)})`));

    this.curve = this._buildCurve(waypoints);
    if (!this.curve) return;

    // Asphalt
    this.geometry = this._buildRoadGeometry({
      curve: this.curve,
      terrainObj: this.terrainObj,
      samples: SAMPLES,
      width: ROAD_WIDTH,
      yOffset: Y_OFFSET,
    });
    if (this.geometry) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x4a4a52,
        roughness: 0.82,
        metalness: 0.0,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        depthWrite: true,
      });
      this.asphaltMesh = new THREE.Mesh(this.geometry, mat);
      this.asphaltMesh.receiveShadow = true;
      this.asphaltMesh.renderOrder = 10;
      this.group.add(this.asphaltMesh);

      // Diagnose
      const pos = this.geometry.attributes.position.array;
      let minY = Infinity, maxY = -Infinity, sumY = 0;
      for (let i = 0; i < pos.length; i += 3) {
        const y = pos[i + 1];
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        sumY += y;
      }
      const avgY = sumY / (pos.length / 3);
      console.log(`[Road] asphalt built — verts:${pos.length/3} terrain:${!!this.terrainObj} Y[${minY.toFixed(2)}..${maxY.toFixed(2)} avg ${avgY.toFixed(2)}]`);
    }

    // Mittellinie
    this.laneGeometry = this._buildLaneGeometry({
      curve: this.curve,
      terrainObj: this.terrainObj,
      samples: SAMPLES,
      laneWidth: LANE_WIDTH,
      yOffset: Y_OFFSET + 0.01,
    });
    if (this.laneGeometry) {
      const laneMat = new THREE.MeshStandardMaterial({
        color: 0xe6e3c9,
        roughness: 0.7,
        metalness: 0.0,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      });
      this.laneMesh = new THREE.Mesh(this.laneGeometry, laneMat);
      this.laneMesh.renderOrder = 11;
      this.group.add(this.laneMesh);
    }
  }

  _buildWaypoints(buildings) {
    const points = buildings.map((b) => {
      const [bx, , bz] = b.position;
      const radius = Math.hypot(bx, bz) || 1.0;
      const scale = TARGET_RADIUS / radius;
      return {
        id: b.id,
        x: bx * scale,
        z: bz * scale,
        origX: bx,
        origZ: bz,
      };
    });

    // Nach Winkel um (0, 0) sortieren — cleane Ringfolge UZS
    for (const p of points) {
      p.angle = Math.atan2(p.z, p.x);
    }
    points.sort((a, b) => a.angle - b.angle);
    return points;
  }

  _buildCurve(waypoints) {
    if (waypoints.length < 3) return null;
    const vec3s = waypoints.map((p) => new THREE.Vector3(p.x, 0, p.z));
    return new THREE.CatmullRomCurve3(vec3s, true, "catmullrom", 0.5);
  }

  _buildRoadGeometry({ curve, terrainObj, samples, width, yOffset }) {
    if (!curve) return null;

    const half = width * 0.5;
    const raycaster = new THREE.Raycaster();
    raycaster.firstHitOnly = true;
    const downDir = new THREE.Vector3(0, -1, 0);
    const upDir = new THREE.Vector3(0, 1, 0);

    const positions = new Float32Array(samples * 2 * 3);
    const uvs = new Float32Array(samples * 2 * 2);
    const indices = [];

    const center = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const sideDir = new THREE.Vector3();

    const RAY_START_Y = 100.0;
    const sampleTerrainY = (cx, cz) => {
      if (!terrainObj) return 0.0;
      raycaster.set(new THREE.Vector3(cx, RAY_START_Y, cz), downDir);
      const hits = raycaster.intersectObject(terrainObj, true);
      if (hits && hits.length > 0) return hits[0].point.y;
      raycaster.set(new THREE.Vector3(cx, -100.0, cz), upDir);
      const hits2 = raycaster.intersectObject(terrainObj, true);
      if (hits2 && hits2.length > 0) return hits2[0].point.y;
      return 0.0;
    };

    const curveLength = curve.getLength();
    const uvRepeat = curveLength / 4.0;

    for (let i = 0; i < samples; i++) {
      const t = i / samples;
      curve.getPoint(t, center);
      curve.getTangent(t, tangent);
      tangent.y = 0;
      tangent.normalize();
      sideDir.set(tangent.z, 0, -tangent.x);

      const cx = center.x;
      const cz = center.z;

      const lx = cx + sideDir.x * half;
      const lz = cz + sideDir.z * half;
      const rx = cx - sideDir.x * half;
      const rz = cz - sideDir.z * half;

      const ly = sampleTerrainY(lx, lz) + yOffset;
      const ry = sampleTerrainY(rx, rz) + yOffset;

      const base = i * 6;
      positions[base + 0] = lx;
      positions[base + 1] = ly;
      positions[base + 2] = lz;
      positions[base + 3] = rx;
      positions[base + 4] = ry;
      positions[base + 5] = rz;

      const uvBase = i * 4;
      const vCoord = t * uvRepeat;
      uvs[uvBase + 0] = 0;
      uvs[uvBase + 1] = vCoord;
      uvs[uvBase + 2] = 1;
      uvs[uvBase + 3] = vCoord;
    }

    for (let i = 0; i < samples; i++) {
      const next = (i + 1) % samples;
      const a = i * 2;
      const b = i * 2 + 1;
      const c = next * 2;
      const d = next * 2 + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }

  _buildLaneGeometry({ curve, terrainObj, samples, laneWidth, yOffset }) {
    if (!curve) return null;

    const half = laneWidth * 0.5;
    const raycaster = new THREE.Raycaster();
    raycaster.firstHitOnly = true;
    const downDir = new THREE.Vector3(0, -1, 0);

    const positions = [];
    const indices = [];

    const center = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const sideDir = new THREE.Vector3();

    const sampleTerrainY = (cx, cz) => {
      if (!terrainObj) return 0.0;
      raycaster.set(new THREE.Vector3(cx, 100.0, cz), downDir);
      const hits = raycaster.intersectObject(terrainObj, true);
      if (hits && hits.length > 0) return hits[0].point.y;
      return 0.0;
    };

    const DASH_ON = 6;
    const DASH_OFF = 4;
    let vertIdx = 0;
    let dashState = "on";
    let dashCount = 0;
    let prevPair = null;

    for (let i = 0; i < samples; i++) {
      const t = i / samples;
      curve.getPoint(t, center);
      curve.getTangent(t, tangent);
      tangent.y = 0;
      tangent.normalize();
      sideDir.set(tangent.z, 0, -tangent.x);

      const cx = center.x;
      const cz = center.z;
      const cy = sampleTerrainY(cx, cz) + yOffset;

      const lx = cx + sideDir.x * half;
      const rx = cx - sideDir.x * half;
      const lz = cz + sideDir.z * half;
      const rz = cz - sideDir.z * half;

      if (dashState === "on") {
        positions.push(lx, cy, lz);
        positions.push(rx, cy, rz);
        const curPair = [vertIdx, vertIdx + 1];
        if (prevPair) {
          indices.push(prevPair[0], curPair[0], prevPair[1]);
          indices.push(prevPair[1], curPair[0], curPair[1]);
        }
        prevPair = curPair;
        vertIdx += 2;
      } else {
        prevPair = null;
      }

      dashCount++;
      if (dashState === "on" && dashCount >= DASH_ON) {
        dashState = "off"; dashCount = 0; prevPair = null;
      } else if (dashState === "off" && dashCount >= DASH_OFF) {
        dashState = "on"; dashCount = 0;
      }
    }

    if (positions.length === 0) return null;

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }

  /** Welt-Kurve für Street-Lamps / Cars / sonstige Road-Follower */
  getCurve() {
    return this.curve;
  }

  update() {
    // Phase 4: keine Animation
  }

  destroy() {
    this.geometry?.dispose?.();
    this.laneGeometry?.dispose?.();
    this.asphaltMesh?.material?.dispose?.();
    this.laneMesh?.material?.dispose?.();
    if (this.group?.parent) this.group.parent.remove(this.group);
  }
}
