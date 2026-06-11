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
    this.treeSpots = [];   // {x,y,z,radius,height} — aus den GLB-Trunk-Nodes

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
    // RAPIER kommt aus dem Physics-Modul (dynamic import) — hält das
    // 2MB-WASM-Bundle aus dem Haupt-Chunk raus. _buildColliders läuft
    // erst nach physics.ready, da ist RAPIER garantiert gesetzt.
    const RAPIER = this.physics.RAPIER;
    if (!world || !RAPIER) return;

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

      // GLB-Defensive (gilt für JEDES Egg_*-Mesh + Sub-Meshes):
      // - Sketchfab-Whale (Egg_Container_Whale_*) hat MeshBasicMaterial mit
      //   weißer color → rendert reinweiß, egal was die Beleuchtung macht.
      //   emissive-Strip wirkt da nicht; wir müssen color direkt setzen.
      // - PBR-Materials mit emissive=[1,1,1] gebacken → strippen.
      // - Pure-mirror metallic ohne HDR-Env → cappen.
      // Wir traversen NACH UNTEN: jedes Sub-Mesh eines Egg_*-Nodes wird
      // bearbeitet, auch wenn das Sub-Mesh selbst keinen Egg_*-Namen hat.
      if (name.startsWith("Egg_")) {
        let touched = 0, recolored = 0;
        const isWhaleContext =
          name.toLowerCase().includes("whale") ||
          name.toLowerCase().includes("container");
        obj.traverse((sub) => {
          if (!sub.isMesh) return;
          const subName = sub.name || "";
          // Lamps (Wal-Beleuchtung / Egg-Glow) sollen glühen — kein strip,
          // kein recolor.
          const isLamp = /lamp/i.test(subName);

          const mats = Array.isArray(sub.material) ? sub.material : [sub.material];
          for (const m of mats) {
            if (!m) continue;

            if (!isLamp) {
              // Emissive raus (PBR / Phong / Lambert)
              m.emissive?.setRGB?.(0, 0, 0);
              if ("emissiveIntensity" in m) m.emissiveIntensity = 0;
              if (m.emissiveMap) m.emissiveMap = null;
              // PBR-Caps
              if ("metalness" in m && typeof m.metalness === "number" && m.metalness > 0.85) {
                m.metalness = 0.85;
              }
              if ("roughness" in m && typeof m.roughness === "number" && m.roughness < 0.3) {
                m.roughness = 0.3;
              }
            }

            // Sketchfab-Unlit-Fix: MeshBasicMaterial ignoriert Lights.
            // Wenn color near-white UND keine baseColorTexture → force.
            // - Im Whale/Container-Kontext: Docker-Brand-Blau für die
            //   Body-Meshes (Spheres + Cubes). Damit ist Moby Dock auch
            //   sichtbar als Docker-Wal lesbar.
            // - Außerhalb: muted slate.
            // - Lamp-Materials werden in beiden Fällen ausgespart.
            const subLower = subName.toLowerCase();
            // Eye-Heuristik: stark-kleine Spheres mit "eye"/"pupil" im Namen
            // explizit ausnehmen, damit die natürliche Farbe steht.
            const isEye = /\beye|pupil/i.test(subName);
            if (!isLamp && !isEye && m.color && !m.map) {
              const c = m.color;
              if (c.r > 0.85 && c.g > 0.85 && c.b > 0.85) {
                if (isWhaleContext || subLower.includes("whale")) {
                  // Docker-Brand-Blau (#0db7ed), leicht abgesoftet damit's
                  // unter ACES Tone-Mapping nicht ins Cyan-Neon kippt.
                  c.setHex(0x4aa5c8);
                } else {
                  c.setHex(0x6a7280);   // generic slate für andere Eggs
                }
                recolored++;
              }
            }
            m.needsUpdate = true;
            touched++;
          }
        });
        if (touched > 0) {
          console.log(`[Island] Egg defensive: ${name} → ${touched} mats touched, ${recolored} recolored`);
        }
      }

      // GLB-Bäume ausblenden — Nature.js ersetzt sie durch prozedurale
      // stilisierte Bäume. Die Positionen sammeln wir HIER beim Ausblenden
      // ein (ein Spot pro Tree_Trunk): world_colliders_json existiert im
      // GLB nicht, die Trunk-Transforms sind die einzige Quelle.
      if (name.startsWith("Tree_Trunk") || name.startsWith("Tree_Canopy")) {
        if (name.startsWith("Tree_Trunk")) {
          obj.getWorldPosition(tmpPos);
          this.treeSpots.push({
            x: tmpPos.x, y: tmpPos.y, z: tmpPos.z,
            // Radius/Höhe variieren in Nature.js per Positions-Hash
            radius: 1.5, height: 3.8,
          });
        }
        obj.visible = false;
        return;
      }

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

        // Alle 5 Buildings sind klickbar — jeweils mit eigenem Mini-Game:
        //   HQ      → NumanOS-Desktop (macOS)
        //   Designa → DesignaOS-Desktop (Windows 11)
        //   HAW     → HAW-Moodle
        //   THG     → Allgemeinwissen-Quiz
        //   Yek     → Kassen-System
        // ProximityTrigger registriert die Meshes über buildings[].mesh.
        const CLICKABLE_BUILDINGS = new Set(["HQ", "Designa", "HAW", "THG", "Yek"]);
        if (CLICKABLE_BUILDINGS.has(m[1])) {
          obj.userData.eggId = m[1];
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
        // (Defensive Material-Fix für Egg_*-Sub-Meshes läuft oben im
        //  Traversal, gilt auch für Egg_Container_Whale_* Sketchfab-Krempel.)
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

  destroy() {
    // Geclonte GLB-Hierarchie aufräumen — World.destroy() ruft das auf,
    // bisher gab es die Methode nicht (Geometrien blieben im VRAM).
    if (this.root) {
      this.root.traverse((obj) => {
        if (obj.isMesh) {
          obj.geometry?.dispose?.();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) {
            if (!m) continue;
            // Texturen mit disposen (map, normalMap, emissiveMap, ...)
            for (const key of Object.keys(m)) {
              if (m[key]?.isTexture) m[key].dispose?.();
            }
            m.dispose?.();
          }
        }
      });
      this.root.parent?.remove?.(this.root);
      this.root = null;
    }
    this.buildings = [];
    this.eggs = [];
    this.landmarks = [];
    this.colliderMeshes = [];
    this.terrainMesh = null;
  }
}
