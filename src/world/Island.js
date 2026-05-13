/**
 * Island — lädt + indexiert die island.glb.
 *
 * Portiert die Logic aus dem alten MapLoader.js:
 *   - Building-Roots erkennen (HQ_Root, HAW_Root, THG_Root, Yek_Root, Designa_Root)
 *   - Easter-Egg-Roots (EasterEgg_*)
 *   - Landmark-Roots (Landmark_*)
 *   - Terrain-Mesh ("Terrain")
 *   - Collider-Meshes (*_col) hidden machen für Visual, aber Geometrie merken
 *
 * In Phase 3 kommt:
 *   - Trimesh-Collider vom Terrain in Rapier-World
 *   - ConvexHull-Collider aus userData.convex_hull_points
 *   - Tree/Rock-Collider aus scene.userData.world_colliders_json
 */

import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

export class Island {
  constructor(game, gltfScene) {
    this.game = game;
    this.scene = game.scene;
    this.physics = game.physics;

    // Wir clonen damit re-mounts den Original nicht verändern
    this.root = gltfScene.clone(true);
    this.root.updateMatrixWorld(true);

    // Index
    this.buildings = [];
    this.eggs = [];
    this.landmarks = [];
    this.colliderMeshes = [];
    this.terrainMesh = null;
    this.worldColliders = { trees: [], rocks: [] };

    this._traverse();

    // Visual zur Scene hinzufügen
    // Terrain cast't keine Shadow (riesige Mesh, kein optisch sichtbarer
    // Schatten unter sich) — spart unter WebGPU einen kompletten Pass.
    this.root.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = obj !== this.terrainMesh;
        obj.receiveShadow = true;
      }
    });

    this.scene.add(this.root);

    // Rapier-Collider sobald Physics ready ist
    if (this.physics.ready) {
      this._buildColliders();
    } else {
      this.physics.on("ready", () => this._buildColliders());
    }

    // Diagnose
    console.log("[Island] indexed:",
      this.buildings.length, "buildings,",
      this.eggs.length, "eggs,",
      this.landmarks.length, "landmarks,",
      this.terrainMesh ? "terrain ✓" : "terrain ✗",
      "world_col:", this.worldColliders.trees.length, "trees,",
      this.worldColliders.rocks.length, "rocks");
  }

  _buildColliders() {
    const world = this.physics.world;
    if (!world) return;

    let totalColliders = 0;

    // 1) Terrain als Trimesh
    if (this.terrainMesh) {
      const args = this._meshToTrimeshArgs(this.terrainMesh);
      const bodyDesc = RAPIER.RigidBodyDesc.fixed();
      const body = world.createRigidBody(bodyDesc);
      const colDesc = RAPIER.ColliderDesc.trimesh(args.vertices, args.indices);
      world.createCollider(colDesc, body);
      totalColliders++;
    } else {
      // Fallback flacher Boden
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
      world.createCollider(RAPIER.ColliderDesc.cuboid(80, 0.5, 80), body);
      totalColliders++;
    }

    // 2) Building-Collider — DEAKTIVIERT (user requested no collision)
    // Buildings sind nur noch Visual, Bike fährt durch sie durch.

    // 3) Tree-Collider — DEAKTIVIERT
    // 4) Rock-Collider — DEAKTIVIERT
    // Bike fährt durch alles durch. Nur Terrain bleibt als Boden.

    console.log(`[Island] created ${totalColliders} static colliders`);
  }

  /**
   * Terrain-Y an Welt-Position (x, z) per Three-Raycast.
   * Fallback 0 wenn kein Treffer.
   */
  _sampleTerrainY(x, z) {
    if (!this.terrainMesh) return 0;
    if (!this._terrainRaycaster) {
      this._terrainRaycaster = new THREE.Raycaster();
      this._terrainRaycaster.firstHitOnly = true;
    }
    const origin = new THREE.Vector3(x, 100, z);
    const dir = new THREE.Vector3(0, -1, 0);
    this._terrainRaycaster.set(origin, dir);
    const hits = this._terrainRaycaster.intersectObject(this.terrainMesh, true);
    if (hits.length > 0) return hits[0].point.y;
    return 0;
  }

  _meshToTrimeshArgs(mesh) {
    const geo = mesh.geometry;
    const posAttr = geo.attributes.position;
    const verts = new Float32Array(posAttr.count * 3);
    const tmp = new THREE.Vector3();
    for (let i = 0; i < posAttr.count; i++) {
      tmp.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      tmp.applyMatrix4(mesh.matrixWorld);
      verts[i * 3] = tmp.x;
      verts[i * 3 + 1] = tmp.y;
      verts[i * 3 + 2] = tmp.z;
    }
    const indices = geo.index
      ? new Uint32Array(geo.index.array)
      : new Uint32Array(Array.from({ length: posAttr.count }, (_, k) => k));
    return { vertices: verts, indices };
  }

  _traverse() {
    const tmpPos = new THREE.Vector3();

    // Scene-Level userData lesen (world_colliders_json)
    const wcj = this.root.userData?.world_colliders_json;
    if (typeof wcj === "string") {
      try {
        const parsed = JSON.parse(wcj);
        // Blender Z-up → Three Y-up: X=X, Y=Z, Z=-Y
        this.worldColliders = {
          trees: (parsed.trees || []).map((t) => ({
            x: t.x, y: t.z, z: -t.y,
            radius: t.radius, height: t.height,
          })),
          rocks: (parsed.rocks || []).map((r) => ({
            cx: r.cx, cy: r.cz, cz: -r.cy,
            hx: r.hx, hy: r.hz, hz: r.hy,
          })),
        };
      } catch (e) {
        console.warn("[Island] failed to parse world_colliders_json", e);
      }
    }

    this.root.traverse((obj) => {
      const name = obj.name || "";

      // Blockout-Meshes + Deko-Krempel — komplett ausblenden.
      // Erkennt: Blockout_*, *_blockout, Marker_*, Cube*, plato_*,
      //         mesh-reduced_*, Curve.*, HQ_Mesh_Hedge, Ocean (eigenes Mesh)
      if (
        name.startsWith("Blockout") ||
        name.endsWith("_blockout") ||
        name.startsWith("Marker_") ||
        /^Cube(\.\d+)?$/.test(name) ||
        name.startsWith("plato_") ||
        name.startsWith("mesh-reduced_") ||
        /^Curve(\.\d+)?$/.test(name) ||
        name === "HQ_Mesh_Hedge" ||
        name === "Ocean"
      ) {
        obj.visible = false;
        return;
      }

      // Building-Roots
      const m = name.match(/^(HAW|Designa|Yek|THG|HQ)_Root$/);
      if (m) {
        obj.getWorldPosition(tmpPos);
        const fwLocal = obj.userData?.front_world;

        // World-Front-Direction berechnen — front_world ist im lokalen
        // Blender-Z-up-Space. Wir müssen:
        // 1) Blender Z-up → Three Y-up: (x, y, z) → (x, z, -y)
        // 2) Building-Yaw aus matrixWorld anwenden
        let worldFront = new THREE.Vector3(0, 0, 1);  // Fallback +Z Three
        if (Array.isArray(fwLocal) && fwLocal.length >= 3) {
          // Blender-Local → Three-Local (Z-up → Y-up)
          worldFront.set(fwLocal[0], fwLocal[2], -fwLocal[1]);
          // Building-World-Rotation extrahieren (nur Y-Yaw relevant)
          const q = new THREE.Quaternion();
          obj.getWorldQuaternion(q);
          worldFront.applyQuaternion(q);
          worldFront.y = 0;  // horizontale Komponente
          if (worldFront.lengthSq() > 1e-6) worldFront.normalize();
        }

        // HQ wird als klickbares Mini-Game-Target markiert (öffnet NumanOS).
        // Die anderen Buildings öffnen nur Walkthrough/InfoCard.
        if (m[1] === "HQ") {
          obj.userData.eggId = "HQ";
          obj.userData.isClickableEgg = true;
        }

        this.buildings.push({
          id: m[1],
          name,
          position: [tmpPos.x, tmpPos.y, tmpPos.z],
          frontDir: Array.isArray(fwLocal) ? [...fwLocal] : [0, 1, 0],
          frontWorld: [worldFront.x, worldFront.y, worldFront.z],
          userData: { ...obj.userData },
          mesh: obj,
        });
        return;
      }

      // Easter-Egg-Roots — Position merken, Visual ausblenden
      // (die Cone/Marker-Meshes in Blender waren nur Spawn-Punkte für
      // die echten Egg-Objekte, die wir später als Sprites/Icons rendern)
      if (name.startsWith("EasterEgg_")) {
        obj.getWorldPosition(tmpPos);
        this.eggs.push({
          id: name.replace("EasterEgg_", ""),
          name,
          position: [tmpPos.x, tmpPos.y, tmpPos.z],
          userData: { ...obj.userData },
        });
        obj.visible = false;
        return;
      }

      // Visible Egg-Objects: "Egg_<Id>_joined" oder "Egg_<Id>" — sichtbares
      // Mesh das in der Welt steht (z.B. ein Router auf einer Hauswand).
      // Bleibt sichtbar UND wird klickbar markiert für EggClickHandler.
      const eggVisMatch = name.match(/^Egg_([A-Za-z0-9]+)(_joined)?$/);
      if (eggVisMatch) {
        const eggId = eggVisMatch[1];   // "Router", "Container", ...
        obj.getWorldPosition(tmpPos);
        // Marker am Object damit Raycaster es findet
        obj.userData.eggId = eggId;
        obj.userData.isClickableEgg = true;
        obj.userData.baseY = tmpPos.y;
        // Auch in eggs[] eintragen (überschreibt evtl. EasterEgg_-Eintrag)
        const existing = this.eggs.findIndex((e) => e.id === eggId);
        const entry = {
          id: eggId,
          name,
          position: [tmpPos.x, tmpPos.y, tmpPos.z],
          mesh: obj,                  // direkter Mesh-Ref für Click
          userData: { ...obj.userData },
        };
        if (existing >= 0) this.eggs[existing] = entry;
        else this.eggs.push(entry);
        // Sichtbar lassen, kein return — Trees-Loop läuft trotzdem nicht über
        // diesen Mesh (Mesh-Name matched kein Tree-Prefix).
        return;
      }

      // Landmark-Pins — Position merken, Visual ausblenden
      if (name.startsWith("Landmark_")) {
        obj.getWorldPosition(tmpPos);
        this.landmarks.push({
          id: name.replace("Landmark_", ""),
          name,
          position: [tmpPos.x, tmpPos.y, tmpPos.z],
          userData: { ...obj.userData },
        });
        obj.visible = false;
        return;
      }

      // Terrain-Mesh
      if (obj.isMesh && (name === "Terrain" || name.startsWith("Terrain") && !name.endsWith("_col"))) {
        if (this.terrainMesh === null || name === "Terrain") {
          this.terrainMesh = obj;
        }
      }

      // Collider-Meshes (für Physik) — visual ausblenden
      if (obj.isMesh && name.endsWith("_col")) {
        obj.visible = false;
        this.colliderMeshes.push(obj);
      }
    });
  }

  update() {
    // Phase 2: keine Animation
  }
}
