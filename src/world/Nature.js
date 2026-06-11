/**
 * Nature — prozedurale stilisierte Bäume + fallende Blätter + Pollen-Motes.
 *
 * Ersetzt die GLB-Bäume (Tree_Trunk_* / Tree_Canopy_*, in Island.js
 * ausgeblendet) durch prozedurale Low-Poly-Bäume an den Positionen aus
 * island.worldColliders.trees ({x, y, z, radius, height}, bereits Y-up).
 *
 * Aufbau pro Baum:
 *   - leicht konischer Stamm (CylinderGeometry, warmes Braun, 1–3° Neigung)
 *   - Krone aus 3–4 überlappenden, plattgedrückten Icosahedron-Blobs in
 *     2–3 Grüntönen der Gras-Palette; 2 von 10 Bäumen tragen Herbst-Töne.
 *   - Variation (Hue/Scale/Neigung) deterministisch über Positions-Hash.
 *
 * Performance / Dual-Renderer (WebGL + WebGPU):
 *   - KEINE custom Shader. Nur Standard-Materials + InstancedMesh mit
 *     CPU-seitigen Matrix-Updates — identisches Verhalten in beiden Pfaden.
 *   - EIN InstancedMesh pro Geometrie-Typ: Trunks (10), Krone-Blobs (~35,
 *     per-Instance-Color), Blätter (100), Pollen (60).
 *   - Update-Loop allokationsfrei: alle Vector3/Quaternion/Matrix4/Euler
 *     als wiederverwendete Temps.
 *
 * Animation (CPU, pro Frame):
 *   - Kronen-Blobs kippen ~0.5–1.5° um die Baum-Basis entlang
 *     wind.direction, Stärke skaliert mit wind.strength.
 *   - Blätter taumeln herab (2 überlagerte Sinus seitlich, Rotation um 2
 *     Achsen, Drift mit Wind), respawnen oben in einer zufälligen Krone.
 *   - Pollen treiben in Wind-Richtung, schweben auf/ab; nachts
 *     (nightFactor > 0.5) Glühwürmchen-Orange mit Opacity-Puls — Farbe/
 *     Opacity am geteilten Material, nicht per Instanz.
 */

import * as THREE from "three";

// ─── Gras-Palette (geteilt mit Grass.js) ──────────────────────────────────
const COL_DARK  = [0.13, 0.23, 0.08];
const COL_LIGHT = [0.42, 0.60, 0.22];

// Herbst-Palette — warme Töne für 2 von 10 Bäumen
const AUTUMN_DARK  = [0.45, 0.20, 0.05];
const AUTUMN_LIGHT = [0.85, 0.52, 0.14];

const AUTUMN_TREE_COUNT = 2;

// ─── Stamm ─────────────────────────────────────────────────────────────────
const TRUNK_COLOR = 0x6e4a2c;          // warmes Braun
const TRUNK_RADIAL_SEGMENTS = 7;       // low-poly
const TRUNK_TAPER = 0.62;              // top/bottom-Radius-Verhältnis (konisch)

// ─── Kronen-Wedeln ─────────────────────────────────────────────────────────
const SWAY_FREQ = 0.6;                 // sin(time * 0.6 + phase)
const SWAY_MIN_DEG = 0.5;
const SWAY_MAX_DEG = 1.5;
const WIND_STRENGTH_REF = 0.18;        // Wind-Default — normalisiert strength

// ─── Blätter ───────────────────────────────────────────────────────────────
const LEAF_COUNT = 100;
const LEAF_SIZE = 0.12;
const LEAF_FALL_SPEED = 0.4;           // m/s (± Variation)
const LEAF_WIND_DRIFT = 1.6;           // Drift-Faktor × wind.strength

// ─── Pollen-Motes ──────────────────────────────────────────────────────────
const MOTE_COUNT = 60;
const MOTE_SIZE = 0.05;
const MOTE_RADIUS = 40;                // über der ganzen Insel
const MOTE_HEIGHT_MIN = 0.3;
const MOTE_HEIGHT_MAX = 2.0;
const MOTE_DAY_COLOR = new THREE.Color(1.0, 0.96, 0.86);   // warmweiß
const MOTE_NIGHT_COLOR = new THREE.Color(1.0, 0.58, 0.16); // Glühwürmchen-Orange
const MOTE_DAY_OPACITY = 0.35;

/** Deterministischer 0..1-Hash aus zwei Koordinaten (wie GLSL-fract-sin). */
function hash01(x, z) {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function lerp3(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

export class Nature {
  constructor(game, island) {
    this.game = game;
    this.scene = game.scene;
    this.island = island;
    // Primärquelle: die beim Ausblenden der GLB-Bäume gesammelten
    // Trunk-Positionen. worldColliders.trees ist nur Fallback (das GLB
    // trägt kein world_colliders_json).
    const spots = island?.treeSpots?.length
      ? island.treeSpots
      : island?.worldColliders?.trees;
    this.trees = spots ?? [];

    // Wiederverwendete Temps — Update-Loop bleibt allokationsfrei
    this._tmpMat = new THREE.Matrix4();
    this._tmpQuat = new THREE.Quaternion();
    this._tmpQuatOut = new THREE.Quaternion();
    this._tmpEuler = new THREE.Euler();
    this._tmpVec = new THREE.Vector3();
    this._tmpAxis = new THREE.Vector3();
    this._unitScale = new THREE.Vector3(1, 1, 1);
    this._leafScale = new THREE.Vector3(1, 1, 1);
    this._moteScale = new THREE.Vector3(1, 1, 1);

    // Kronen-Infos für Leaf-Spawns: {x, y(center), z, r, groundY}
    this._crowns = [];

    this._buildTrees();
    this._buildLeaves();
    this._buildMotes();

    console.log(
      `[Nature] built: ${this.trees.length} trees ` +
      `(${this._blobData?.length ?? 0} canopy blobs), ` +
      `${this._leaves?.length ?? 0} leaves, ${this._motes?.length ?? 0} motes`,
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // Bäume
  // ────────────────────────────────────────────────────────────────────────

  _buildTrees() {
    const trees = this.trees;
    if (!trees.length) return;

    // Herbst-Bäume deterministisch wählen: die N kleinsten Positions-Hashes
    const ranked = trees
      .map((t, i) => ({ i, h: hash01(t.x * 1.7, t.z * 2.3) }))
      .sort((a, b) => a.h - b.h);
    const autumnSet = new Set(
      ranked.slice(0, Math.min(AUTUMN_TREE_COUNT, trees.length)).map((e) => e.i),
    );

    // ── Trunks: EIN InstancedMesh, Matrizen statisch ──────────────────────
    // Unit-Zylinder: Basis bei y=0, Höhe 1, Bottom-Radius 1 → per-Instance
    // Scale macht daraus den konkreten Stamm.
    const trunkGeo = new THREE.CylinderGeometry(
      TRUNK_TAPER, 1, 1, TRUNK_RADIAL_SEGMENTS,
    );
    trunkGeo.translate(0, 0.5, 0);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: TRUNK_COLOR,
      roughness: 0.95,
      metalness: 0,
      flatShading: true,
    });
    this.trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
    this.trunkMesh.name = "Nature_Trunks";
    this.trunkMesh.castShadow = true;
    this.trunkMesh.receiveShadow = false;
    this.trunkMesh.frustumCulled = false;

    // ── Krone-Blobs: EIN InstancedMesh, per-Instance-Color, pro Frame
    //    Sway-Update ────────────────────────────────────────────────────────
    const blobGeo = new THREE.IcosahedronGeometry(1, 1);
    const blobMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,                 // instanceColor liefert den Ton
      roughness: 0.9,
      metalness: 0,
      flatShading: true,
    });

    // Blob-Daten erst sammeln (Anzahl pro Baum variiert 3–4), dann Mesh
    this._blobData = [];
    const tmpColor = new THREE.Color();

    for (let ti = 0; ti < trees.length; ti++) {
      const t = trees[ti];
      const h1 = hash01(t.x, t.z);
      const h2 = hash01(t.x + 11.3, t.z + 7.1);
      const h3 = hash01(t.x + 23.7, t.z + 41.9);

      const r = t.radius || 1.4;       // Collider-Radius ≈ Kronen-Radius
      const hgt = t.height || 4.0;
      const trunkH = hgt * (0.5 + h1 * 0.1);
      const trunkR = Math.max(0.12, r * 0.16) * (0.9 + h2 * 0.25);

      // Stamm-Neigung 1–3° um zufällige horizontale Achse
      const leanDeg = 1 + h2 * 2;
      const leanAng = (leanDeg * Math.PI) / 180;
      const leanDir = h3 * Math.PI * 2;
      this._tmpAxis.set(Math.cos(leanDir), 0, Math.sin(leanDir));
      this._tmpQuat.setFromAxisAngle(this._tmpAxis, leanAng);
      this._tmpVec.set(t.x, t.y, t.z);
      this._tmpMat.compose(
        this._tmpVec,
        this._tmpQuat,
        new THREE.Vector3(trunkR, trunkH, trunkR),
      );
      this.trunkMesh.setMatrixAt(ti, this._tmpMat);

      // Stamm-Spitze (geneigter Stamm) = Kronen-Anker
      const top = new THREE.Vector3(0, trunkH, 0)
        .applyQuaternion(this._tmpQuat)
        .add(this._tmpVec);

      // Farb-Palette des Baums: Gras-Grün oder Herbst, mit per-Baum
      // Hue/Brightness-Variation über den Hash
      const autumn = autumnSet.has(ti);
      const dark = autumn ? AUTUMN_DARK : COL_DARK;
      const light = autumn ? AUTUMN_LIGHT : COL_LIGHT;
      const hueShift = (h1 - 0.5) * 0.12;   // leichte Hue-Variation pro Baum

      // 3–4 Blobs pro Baum
      const blobCount = 3 + (h3 > 0.5 ? 1 : 0);
      const crownTopY = top.y + r * 0.55;

      for (let bi = 0; bi < blobCount; bi++) {
        const bh1 = hash01(t.x + bi * 17.3, t.z + bi * 5.9);
        const bh2 = hash01(t.x + bi * 31.7, t.z + bi * 13.1);

        // Blob 0 sitzt mittig oben, der Rest radial drumherum versetzt
        let ox = 0, oy = r * 0.45, oz = 0;
        if (bi > 0) {
          const ang = ((bi - 1) / (blobCount - 1)) * Math.PI * 2 + h1 * 6.28;
          const rad = r * (0.35 + bh1 * 0.2);
          ox = Math.cos(ang) * rad;
          oz = Math.sin(ang) * rad;
          oy = r * (0.1 + bh2 * 0.45);
        }

        // 2–3 Grüntöne (bzw. Herbst-Töne): Ton aus Blob-Index + Hash
        const tone = 0.3 + ((bi % 3) / 2) * 0.55 + (bh2 - 0.5) * 0.12;
        const rgb = lerp3(dark, light, Math.min(1, Math.max(0, tone)));
        tmpColor.setRGB(rgb[0], rgb[1], rgb[2]);
        if (!autumn) tmpColor.offsetHSL(hueShift, 0, (h2 - 0.5) * 0.04);

        // Leicht plattgedrückte Kugel, per-Blob Scale-Variation
        const br = r * (0.55 + bh1 * 0.3);
        const scale = new THREE.Vector3(br, br * (0.7 + bh2 * 0.15), br);

        // Zufällige Basis-Rotation für Facetten-Variation
        const baseQuat = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(bh1 * Math.PI, bh2 * Math.PI * 2, bh1 * 2),
        );

        this._blobData.push({
          pivot: new THREE.Vector3(t.x, t.y, t.z),       // Baum-Basis
          offset: new THREE.Vector3(ox, oy, oz).add(top).sub(
            new THREE.Vector3(t.x, t.y, t.z),
          ),
          scale,
          baseQuat,
          phase: bh1 * Math.PI * 2 + ti * 1.7,
          // 0.5–1.5° Amplitude (rad), pro Blob leicht unterschiedlich
          amp: ((SWAY_MIN_DEG + bh2 * (SWAY_MAX_DEG - SWAY_MIN_DEG)) * Math.PI) / 180,
          color: tmpColor.clone(),
        });
      }

      // Krone für Leaf-Spawns merken
      this._crowns.push({
        x: top.x, y: (top.y + crownTopY) * 0.5, z: top.z,
        r: r * 0.8,
        groundY: t.y,
      });
    }

    this.blobMesh = new THREE.InstancedMesh(blobGeo, blobMat, this._blobData.length);
    this.blobMesh.name = "Nature_Canopy";
    this.blobMesh.castShadow = true;
    this.blobMesh.receiveShadow = false;
    this.blobMesh.frustumCulled = false;
    this.blobMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    for (let i = 0; i < this._blobData.length; i++) {
      const b = this._blobData[i];
      this._tmpVec.copy(b.pivot).add(b.offset);
      this._tmpMat.compose(this._tmpVec, b.baseQuat, b.scale);
      this.blobMesh.setMatrixAt(i, this._tmpMat);
      this.blobMesh.setColorAt(i, b.color);
    }
    this.blobMesh.instanceMatrix.needsUpdate = true;
    if (this.blobMesh.instanceColor) this.blobMesh.instanceColor.needsUpdate = true;

    this.trunkMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.trunkMesh);
    this.scene.add(this.blobMesh);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Fallende Blätter
  // ────────────────────────────────────────────────────────────────────────

  _buildLeaves() {
    if (!this._crowns.length) return;

    const geo = new THREE.PlaneGeometry(LEAF_SIZE, LEAF_SIZE);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,                 // wird nachts gedimmt (× instanceColor)
      side: THREE.DoubleSide,
    });
    this.leafMesh = new THREE.InstancedMesh(geo, mat, LEAF_COUNT);
    this.leafMesh.name = "Nature_Leaves";
    this.leafMesh.castShadow = false;
    this.leafMesh.receiveShadow = false;
    this.leafMesh.frustumCulled = false;
    this.leafMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const tmpColor = new THREE.Color();
    this._leaves = [];
    for (let i = 0; i < LEAF_COUNT; i++) {
      const leaf = {
        x: 0, y: 0, z: 0, groundY: 0,
        fall: 0,
        // 2 überlagerte Sinus fürs seitliche Flattern
        a1: 0.1 + Math.random() * 0.15, f1: 1.2 + Math.random() * 1.2, p1: Math.random() * 6.28,
        a2: 0.05 + Math.random() * 0.1, f2: 2.8 + Math.random() * 1.6, p2: Math.random() * 6.28,
        // Rotation um 2 Achsen
        r1: (Math.random() - 0.5) * 5, r2: (Math.random() - 0.5) * 5,
        rp1: Math.random() * 6.28, rp2: Math.random() * 6.28,
      };
      this._respawnLeaf(leaf, true);
      this._leaves.push(leaf);

      // Kronen-Töne: Mix aus Gras-Grün und gelegentlich Herbst
      const t = Math.random();
      const rgb = t < 0.8
        ? lerp3(COL_DARK, COL_LIGHT, 0.35 + Math.random() * 0.6)
        : lerp3(AUTUMN_DARK, AUTUMN_LIGHT, 0.3 + Math.random() * 0.7);
      tmpColor.setRGB(rgb[0], rgb[1], rgb[2]);
      this.leafMesh.setColorAt(i, tmpColor);
    }
    if (this.leafMesh.instanceColor) this.leafMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.leafMesh);
  }

  /** Blatt oben in einer zufälligen Krone neu platzieren. */
  _respawnLeaf(leaf, randomHeight = false) {
    const crown = this._crowns[(Math.random() * this._crowns.length) | 0];
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.random() * crown.r;
    leaf.x = crown.x + Math.cos(ang) * rad;
    leaf.z = crown.z + Math.sin(ang) * rad;
    // Beim Init über die ganze Fallstrecke verteilen, später oben spawnen
    leaf.y = randomHeight
      ? crown.groundY + Math.random() * (crown.y - crown.groundY)
      : crown.y + (Math.random() - 0.5) * crown.r;
    leaf.groundY = crown.groundY;
    leaf.fall = LEAF_FALL_SPEED * (0.75 + Math.random() * 0.5);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Pollen-Motes
  // ────────────────────────────────────────────────────────────────────────

  _buildMotes() {
    const geo = new THREE.PlaneGeometry(MOTE_SIZE, MOTE_SIZE);
    this.moteMat = new THREE.MeshBasicMaterial({
      color: MOTE_DAY_COLOR.clone(),
      transparent: true,
      opacity: MOTE_DAY_OPACITY,
      side: THREE.DoubleSide,
      depthWrite: false,               // wirkt additiv-weich, kein Z-Flicker
    });
    this.moteMesh = new THREE.InstancedMesh(geo, this.moteMat, MOTE_COUNT);
    this.moteMesh.name = "Nature_Motes";
    this.moteMesh.castShadow = false;
    this.moteMesh.receiveShadow = false;
    this.moteMesh.frustumCulled = false;
    this.moteMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    this._motes = [];
    for (let i = 0; i < MOTE_COUNT; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = Math.sqrt(Math.random()) * MOTE_RADIUS;
      const x = Math.cos(ang) * rad;
      const z = Math.sin(ang) * rad;
      this._motes.push({
        x, z,
        groundY: this.island?._sampleTerrainY?.(x, z) ?? 0,
        h: MOTE_HEIGHT_MIN + Math.random() * (MOTE_HEIGHT_MAX - MOTE_HEIGHT_MIN),
        bobA: 0.1 + Math.random() * 0.15,
        bobF: 0.3 + Math.random() * 0.5,
        bobP: Math.random() * 6.28,
        speed: 0.6 + Math.random() * 0.8,
      });
    }
    this.scene.add(this.moteMesh);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Update
  // ────────────────────────────────────────────────────────────────────────

  update() {
    const t = this.game.time?.elapsed ?? 0;
    const dt = this.game.time?.delta ?? 0.016;
    const wind = this.game.world?.wind;
    const windX = wind?.direction?.x ?? 0.7;
    const windZ = wind?.direction?.y ?? 0.3;
    const windStrength = wind?.strength ?? WIND_STRENGTH_REF;
    const windSpeed = wind?.speed ?? 0.28;
    const nightFactor = this.game.world?.dayCycle?.live?.nightFactor ?? 0;

    this._updateCanopySway(t, windX, windZ, windStrength);
    this._updateLeaves(t, dt, windX, windZ, windStrength);
    this._updateMotes(t, dt, windX, windZ, windSpeed, nightFactor);
  }

  _updateCanopySway(t, windX, windZ, windStrength) {
    if (!this.blobMesh) return;
    // Kipp-Achse senkrecht zur Wind-Richtung: Rotation um (wz, 0, -wx)
    // lehnt die Krone IN Wind-Richtung.
    this._tmpAxis.set(windZ, 0, -windX);
    if (this._tmpAxis.lengthSq() < 1e-6) this._tmpAxis.set(0, 0, -1);
    this._tmpAxis.normalize();
    // Auf Default-Strength normalisiert: bei normalem Wind volle 0.5–1.5°,
    // Gusts drüber, Nacht-Wind drunter.
    const strengthMult = windStrength / WIND_STRENGTH_REF;

    for (let i = 0; i < this._blobData.length; i++) {
      const b = this._blobData[i];
      const angle = b.amp * Math.sin(t * SWAY_FREQ + b.phase) * strengthMult;
      this._tmpQuat.setFromAxisAngle(this._tmpAxis, angle);
      // Um die Baum-Basis kippen: Offset rotieren, dann zurück versetzen
      this._tmpVec.copy(b.offset).applyQuaternion(this._tmpQuat).add(b.pivot);
      this._tmpQuatOut.multiplyQuaternions(this._tmpQuat, b.baseQuat);
      this._tmpMat.compose(this._tmpVec, this._tmpQuatOut, b.scale);
      this.blobMesh.setMatrixAt(i, this._tmpMat);
    }
    this.blobMesh.instanceMatrix.needsUpdate = true;
  }

  _updateLeaves(t, dt, windX, windZ, windStrength) {
    if (!this.leafMesh) return;
    const drift = windStrength * LEAF_WIND_DRIFT;

    for (let i = 0; i < this._leaves.length; i++) {
      const leaf = this._leaves[i];
      leaf.y -= leaf.fall * dt;
      leaf.x += windX * drift * dt;
      leaf.z += windZ * drift * dt;
      if (leaf.y <= leaf.groundY + 0.03) this._respawnLeaf(leaf);

      // Seitliches Flattern: 2 überlagerte Sinus (nur Anzeige-Offset,
      // akkumuliert nicht)
      const ox = Math.sin(t * leaf.f1 + leaf.p1) * leaf.a1
               + Math.sin(t * leaf.f2 + leaf.p2) * leaf.a2;
      const oz = Math.cos(t * leaf.f1 * 0.83 + leaf.p2) * leaf.a1
               + Math.cos(t * leaf.f2 * 1.1 + leaf.p1) * leaf.a2;

      // Taumeln: Rotation um 2 Achsen
      this._tmpEuler.set(t * leaf.r1 + leaf.rp1, t * leaf.r2 + leaf.rp2, 0);
      this._tmpQuat.setFromEuler(this._tmpEuler);
      this._tmpVec.set(leaf.x + ox, leaf.y, leaf.z + oz);
      this._tmpMat.compose(this._tmpVec, this._tmpQuat, this._leafScale);
      this.leafMesh.setMatrixAt(i, this._tmpMat);
    }
    this.leafMesh.instanceMatrix.needsUpdate = true;

    // Nachts dimmen — MeshBasicMaterial ist unlit und würde sonst glühen.
    // material.color multipliziert die instanceColor → ein Wert für alle.
    const dim = 1 - (this.game.world?.dayCycle?.live?.nightFactor ?? 0) * 0.7;
    this.leafMesh.material.color.setScalar(dim);
  }

  _updateMotes(t, dt, windX, windZ, windSpeed, nightFactor) {
    if (!this.moteMesh) return;

    // Billboard: alle Motes übernehmen die Kamera-Rotation (geteilt)
    const cam = this.game.cameraRig?.camera;
    if (cam) this._tmpQuat.copy(cam.quaternion);
    else this._tmpQuat.identity();

    const driftSpeed = 0.15 + windSpeed * 0.5;

    for (let i = 0; i < this._motes.length; i++) {
      const m = this._motes[i];
      m.x += windX * driftSpeed * m.speed * dt;
      m.z += windZ * driftSpeed * m.speed * dt;

      // Insel-Wrap: rausgedriftete Motes auf der Gegenseite respawnen
      if (m.x * m.x + m.z * m.z > MOTE_RADIUS * MOTE_RADIUS) {
        m.x = -m.x * 0.96;
        m.z = -m.z * 0.96;
        m.groundY = this.island?._sampleTerrainY?.(m.x, m.z) ?? m.groundY;
      }

      const y = m.groundY + m.h + Math.sin(t * m.bobF + m.bobP) * m.bobA;
      this._tmpVec.set(m.x, y, m.z);
      this._tmpMat.compose(this._tmpVec, this._tmpQuat, this._moteScale);
      this.moteMesh.setMatrixAt(i, this._tmpMat);
    }
    this.moteMesh.instanceMatrix.needsUpdate = true;

    // Tag/Nacht am geteilten Material: warmweiß ↔ Glühwürmchen-Orange.
    // Smooth-Blend um nightFactor 0.5, nachts sanfter Opacity-Puls.
    const nb = Math.min(1, Math.max(0, (nightFactor - 0.4) / 0.2));
    this.moteMat.color.lerpColors(MOTE_DAY_COLOR, MOTE_NIGHT_COLOR, nb);
    const nightOpacity = 0.45 + 0.2 * Math.sin(t * 2.2);
    this.moteMat.opacity = MOTE_DAY_OPACITY * (1 - nb) + nightOpacity * nb;
  }

  // ────────────────────────────────────────────────────────────────────────

  destroy() {
    for (const mesh of [this.trunkMesh, this.blobMesh, this.leafMesh, this.moteMesh]) {
      if (!mesh) continue;
      this.scene.remove(mesh);
      mesh.geometry?.dispose?.();
      mesh.material?.dispose?.();
      mesh.dispose?.();                // InstancedMesh: instanceMatrix/Color-Buffer
    }
    this.trunkMesh = null;
    this.blobMesh = null;
    this.leafMesh = null;
    this.moteMesh = null;
    this._blobData = [];
    this._leaves = [];
    this._motes = [];
    this._crowns = [];
  }
}
