/**
 * StreetLamps — detaillierte Straßenlaternen entlang der Road-Curve.
 *
 * Portiert aus altem Next.js StreetLamps.js.
 *
 * Pro Sample (alle 22m entlang Road):
 *   - Wechselt links/rechts der Curve
 *   - Detail-Modell: Sockel, Pfosten, Bogen-Arm (TubeGeometry), Lampengehäuse
 *   - PointLight am Lampenkopf (an bei Nacht via DayCycle)
 *
 * Bis DayCycle fertig ist: lightLevel = 1.0 (immer an). Eine F-Taste am
 * Player toggelt nicht die Lampen — die haben ihren eigenen Steuermechanismus
 * über setLightLevel().
 */

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const TARGET_RADIUS = 28.0;     // gleicher Radius wie Road
const SPACING = 22;             // Abstand zwischen Lampen
const SIDE_OFFSET = 2.8;        // Abstand von Curve-Center zur Seite

// ─── Geometrie-Builder (einmalig) ────────────────────────────────────────────

function buildLanternGeometries() {
  // 1) Sockel
  const baseGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.3, 12);
  baseGeo.translate(0, 0.15, 0);

  // 2) Pfosten (3m, leicht verjüngt)
  const postGeo = new THREE.CylinderGeometry(0.06, 0.09, 3.0, 12);
  postGeo.translate(0, 1.8, 0);

  // 3) Top-Ring
  const ringTopGeo = new THREE.CylinderGeometry(0.10, 0.10, 0.06, 14);
  ringTopGeo.translate(0, 3.32, 0);

  // 4) Mid-Ring (Decoration)
  const ringMidGeo = new THREE.TorusGeometry(0.085, 0.018, 6, 16);
  ringMidGeo.rotateX(Math.PI / 2);
  ringMidGeo.translate(0, 0.7, 0);

  // 5) Geschwungener Arm via Bezier-TubeGeometry
  const armCurve = new THREE.CubicBezierCurve3(
    new THREE.Vector3(0, 3.35, 0),       // Start am Pfosten
    new THREE.Vector3(0.0, 3.7, 0.3),    // Control 1: hoch
    new THREE.Vector3(0.4, 3.9, 0.9),    // Control 2: nach außen
    new THREE.Vector3(0.0, 3.7, 1.4),    // Ende: Lampenposition
  );
  const armGeo = new THREE.TubeGeometry(armCurve, 16, 0.035, 8, false);

  // 6) Lampengehäuse — Hut + Mid-Ring + Boden, Position (0, 3.7, 1.4)
  const capTopGeo = new THREE.ConeGeometry(0.16, 0.2, 12);
  capTopGeo.translate(0, 3.95, 1.4);

  const capRingGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.04, 12);
  capRingGeo.translate(0, 3.83, 1.4);

  const capBotGeo = new THREE.CylinderGeometry(0.13, 0.11, 0.05, 12);
  capBotGeo.translate(0, 3.51, 1.4);

  // Merge alle Dark-Metal-Teile
  const darkGeoms = [
    baseGeo, postGeo, ringTopGeo, ringMidGeo, armGeo,
    capTopGeo, capRingGeo, capBotGeo,
  ];
  darkGeoms.forEach((g) => {
    if (g.attributes.uv) g.deleteAttribute("uv");
    if (g.attributes.normal) g.deleteAttribute("normal");
  });
  let darkGeo = mergeGeometries(darkGeoms, false);
  if (!darkGeo) darkGeo = postGeo;   // Fallback
  darkGeo.computeVertexNormals();

  // Glas-Zylinder (transparenter Glow)
  const glassGeo = new THREE.CylinderGeometry(0.10, 0.10, 0.30, 14, 1, true);
  glassGeo.translate(0, 3.68, 1.4);

  // Glühbirne
  const bulbGeo = new THREE.SphereGeometry(0.08, 14, 12);
  bulbGeo.translate(0, 3.68, 1.4);

  return { darkGeo, glassGeo, bulbGeo };
}

// ─── Curve-Helfer (identisch zu Road) ────────────────────────────────────────

function buildCurve(buildings) {
  if (!buildings || buildings.length < 3) return null;
  const pts = buildings.map((b) => {
    const [bx, , bz] = b.position;
    const r = Math.hypot(bx, bz) || 1;
    return { x: bx * (TARGET_RADIUS / r), z: bz * (TARGET_RADIUS / r) };
  });
  for (const p of pts) p.angle = Math.atan2(p.z, p.x);
  pts.sort((a, b) => a.angle - b.angle);
  const vec3s = pts.map((p) => new THREE.Vector3(p.x, 0, p.z));
  return new THREE.CatmullRomCurve3(vec3s, true, "catmullrom", 0.5);
}

// ─── StreetLamps-Klasse ──────────────────────────────────────────────────────

export class StreetLamps {
  constructor(game, buildings, terrainObj) {
    this.game = game;
    this.scene = game.scene;
    this.buildings = buildings;
    this.terrainObj = terrainObj;

    this.group = new THREE.Group();
    this.group.name = "StreetLamps";

    this.lights = [];        // PointLights für DayCycle-Steuerung
    this.placements = [];    // Position + Rotation pro Lampe

    // Geometrien einmal bauen
    const { darkGeo, glassGeo, bulbGeo } = buildLanternGeometries();
    this.darkGeo = darkGeo;
    this.glassGeo = glassGeo;
    this.bulbGeo = bulbGeo;

    // Materialien
    this.darkMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a30,
      roughness: 0.55,
      metalness: 0.65,
    });
    this.glassMat = new THREE.MeshStandardMaterial({
      color: 0xfff8d8,
      emissive: new THREE.Color(0xfff8d8),
      emissiveIntensity: 1.2,
      roughness: 0.3,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.bulbMat = new THREE.MeshStandardMaterial({
      color: 0xfff4c8,
      emissive: new THREE.Color(0xfff4c8),
      emissiveIntensity: 4.0,
      toneMapped: false,
    });

    this._build();
    this.scene.add(this.group);
  }

  _build() {
    const curve = buildCurve(this.buildings);
    if (!curve) {
      console.warn("[StreetLamps] no curve — needs at least 3 buildings");
      return;
    }

    // Sample-Punkte entlang der Curve
    const curveLength = curve.getLength();
    const count = Math.floor(curveLength / SPACING);
    if (count < 2) return;

    const raycaster = new THREE.Raycaster();
    raycaster.firstHitOnly = true;
    const downDir = new THREE.Vector3(0, -1, 0);
    const sampleTerrainY = (cx, cz) => {
      if (!this.terrainObj) return 0;
      raycaster.set(new THREE.Vector3(cx, 100, cz), downDir);
      const hits = raycaster.intersectObject(this.terrainObj, true);
      return hits.length > 0 ? hits[0].point.y : 0;
    };

    const center = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const t = i / count;
      curve.getPoint(t, center);
      curve.getTangent(t, tangent);
      tangent.y = 0;
      tangent.normalize();
      const sideX = tangent.z;
      const sideZ = -tangent.x;
      const sign = i % 2 === 0 ? 1 : -1;
      const px = center.x + sideX * SIDE_OFFSET * sign;
      const pz = center.z + sideZ * SIDE_OFFSET * sign;
      const py = sampleTerrainY(px, pz);

      // Arm-Direction zeigt zum Curve-Center
      const armDirX = center.x - px;
      const armDirZ = center.z - pz;
      const armAngle = Math.atan2(armDirX, armDirZ);

      this.placements.push({ position: [px, py, pz], rotationY: armAngle });

      // Lampe spawnen
      const lampGroup = new THREE.Group();
      lampGroup.position.set(px, py, pz);
      lampGroup.rotation.y = armAngle;

      const darkMesh = new THREE.Mesh(this.darkGeo, this.darkMat);
      darkMesh.castShadow = true;
      lampGroup.add(darkMesh);

      const glassMesh = new THREE.Mesh(this.glassGeo, this.glassMat);
      lampGroup.add(glassMesh);

      const bulbMesh = new THREE.Mesh(this.bulbGeo, this.bulbMat);
      lampGroup.add(bulbMesh);

      const light = new THREE.PointLight(0xfff4c8, 3.0, 10, 2);
      light.position.set(0, 3.68, 1.4);
      lampGroup.add(light);
      this.lights.push(light);

      this.group.add(lampGroup);
    }

    console.log(`[StreetLamps] placed ${count} lamps along road (length ${curveLength.toFixed(1)}m)`);
  }

  /**
   * Setzt Helligkeit aller Lampen — 0=aus (Tag), 1=voll (Nacht).
   * Wird in Phase 5 (DayCycle) jeden Frame mit sunIntensity gerufen.
   */
  setLightLevel(level) {
    const l = THREE.MathUtils.clamp(level, 0, 1);
    // Lights komplett aus der Scene entfernen wenn praktisch aus.
    // Spart unter WebGPU per-Material Light-Loop in MeshStandardMaterials.
    const shouldBeOn = l > 0.01;
    for (const light of this.lights) {
      light.intensity = l * 3.0;
      if (shouldBeOn && !light.parent) {
        light._origParent?.add?.(light);
      } else if (!shouldBeOn && light.parent) {
        light._origParent = light.parent;
        light.parent.remove(light);
      }
    }
    this.bulbMat.emissiveIntensity = l * 4.0;
    this.glassMat.emissiveIntensity = l * 1.2;
  }

  update() {
    // Phase 4: keine Animation — Lampen leuchten konstant.
    // Phase 5 wird hier sunIntensity vom DayCycle abgreifen.
  }

  destroy() {
    this.darkGeo?.dispose?.();
    this.glassGeo?.dispose?.();
    this.bulbGeo?.dispose?.();
    this.darkMat?.dispose?.();
    this.glassMat?.dispose?.();
    this.bulbMat?.dispose?.();
    if (this.group?.parent) this.group.parent.remove(this.group);
    this.lights.length = 0;
  }
}
