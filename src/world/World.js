/**
 * World — der Hauptcontainer für alle Welt-Objekte.
 *
 * Phase 2: lädt island.glb und indexiert Hotspots (Buildings, Eggs,
 * Landmarks) für spätere Phasen.
 *
 * Indexing-Konvention aus dem alten Projekt:
 *   HQ_Root, HAW_Root, THG_Root, Yek_Root, Designa_Root → Buildings
 *   EasterEgg_*                                          → Eggs
 *   Landmark_*                                           → Landmarks
 *   *_col                                                → Hidden Collider-Meshes
 *
 * Custom Properties (front_world, convex_hull_points, col_center,
 * col_half_size, world_colliders_json) bleiben in obj.userData.
 */

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Resources } from "../core/Resources.js";
import { Island } from "./Island.js";
import { Player } from "./Player.js";
import { Road } from "./Road.js";
import { StreetLamps } from "./StreetLamps.js";
import { DayCycle } from "./DayCycle.js";
import { ProximityTrigger } from "./ProximityTrigger.js";
import { Ocean } from "./Ocean.js";
import { SkyDome } from "./SkyDome.js";
import { Grass } from "./Grass.js";
import { Wind } from "./Wind.js";
import { ColliderDebug } from "./ColliderDebug.js";
import { StationLabels3D } from "../ui/walkthrough/StationLabels3D.js";
import { getControlMode } from "../ui/controlMode.js";

export class World {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.time = game.time;

    this._setupLights();

    // Wind-Singleton — muss VOR Grass/Trees laufen damit die ihre Uniforms
    // pro Frame aus wind.direction/speed/strength ziehen können.
    this.wind = new Wind(game);

    // Animiertes Ocean — sofort, kein GLB-Wartezeit
    this.ocean = new Ocean(game);

    // Gradient-Sky-Dome (Horizont→Zenit + Sonne + Sterne). Ersetzt den
    // flachen scene.background — der bleibt als Fallback bis das Material
    // async fertig ist.
    this.sky = new SkyDome(game);

    // DayCycle — animiert Sun/Ambient/Hemi/Fog + steuert StreetLamps.
    // Tasten: T=Pause, N=Night-Snap, M=Day-Snap, B=Auto-Cycle resumen.
    this.dayCycle = new DayCycle(game);
    this.dayCycle.bindLights({
      sun: this.sun,
      ambient: this.ambient,
      hemi: this.hemi,
    });

    // Collider-Debug-Visualisierer — Toggle mit C
    this.colliderDebug = new ColliderDebug(game);

    // Resources laden — Island + Bike
    this.resources = new Resources({
      island: "/maps/island.glb",
      bike:   "/vanmoof-transformed.glb",
    });

    this.resources.on("progress", (name, ratio) => {
      console.log(`[World] loading ${name}: ${Math.round(ratio * 100)}%`);
    });

    this.resources.on("ready", () => {
      console.log("[World] resources ready — building world");
      this._buildIsland();
      this._buildRoad();
      this._buildStreetLamps();
      this._buildGrass();
      this._buildStationLabels();
      this._buildPlayer();
      this._buildProximity();
    });
  }

  _setupLights() {
    // Lights als Member behalten — DayCycle steuert ihre Farbe/Intensity
    // jeden Frame.
    this.ambient = new THREE.AmbientLight(0xddeeff, 0.45);
    this.scene.add(this.ambient);

    this.sun = new THREE.DirectionalLight(0xfff4d6, 1.3);
    this.sun.position.set(45, 65, 30);

    // Shadow-Pass aktiv in beiden Renderern. Kostet unter WebGPU ~25% FPS
    // (von 80 auf 60), aber Schatten sind ein wichtiger Tiefen-Indikator.
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.width  = 2048;
    this.sun.shadow.mapSize.height = 2048;
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far  = 250;
    this.sun.shadow.camera.left   = -70;
    this.sun.shadow.camera.right  =  70;
    this.sun.shadow.camera.top    =  70;
    this.sun.shadow.camera.bottom = -70;
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.06;
    this.scene.add(this.sun);

    this.hemi = new THREE.HemisphereLight(0xc8e8ff, 0x3d6b44, 0.45);
    this.hemi.position.set(0, 50, 0);
    this.scene.add(this.hemi);

    // Sky-Background — wird vom DayCycle pro Frame aktualisiert
    this.scene.background = new THREE.Color(0xa8d8ff);

    // PMREM-Environment für Bike-PBR-Reflections. Wir setzen das Env-Texture
    // NICHT auf scene.environment (würde global auf jedes PBR-Material gelegt
    // und mit der UnrealBloomPass-Threshold von 0.85 unter WebGL alles
    // ausblenden lassen). Stattdessen exposen wir die Textur an Player, das
    // sie nur den Bike-Materials zuweist. Buildings, Ocean, Grass bleiben
    // unverändert in ihrer Original-Beleuchtung.
    this.envTexture = null;
    const initEnv = () => {
      const renderer = this.game?.renderer?.instance;
      if (!renderer) return;
      try {
        const pmrem = new THREE.PMREMGenerator(renderer);
        const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        this.envTexture = envTex;
        pmrem.dispose();
        this.player?._applyEnvMap?.();
      } catch (e) {
        console.warn("[World] PMREM environment init failed:", e?.message);
      }
    };
    if (this.game?.renderer?.ready?.then) {
      this.game.renderer.ready.then(initEnv).catch(() => {});
    } else {
      initEnv();
    }
  }

  _buildIsland() {
    const gltf = this.resources.items.island;
    if (!gltf) {
      console.error("[World] island GLB missing");
      return;
    }
    this.island = new Island(this.game, gltf.scene);
  }

  _buildRoad() {
    if (!this.island) {
      console.warn("[World] road skipped — island not built yet");
      return;
    }
    this.road = new Road(
      this.game,
      this.island.buildings,
      this.island.terrainMesh,
    );
  }

  _buildStreetLamps() {
    if (!this.island) {
      console.warn("[World] street lamps skipped — island not built yet");
      return;
    }
    this.streetLamps = new StreetLamps(
      this.game,
      this.island.buildings,
      this.island.terrainMesh,
    );
  }

  _buildGrass() {
    if (!this.island?.terrainMesh) {
      console.warn("[World] grass skipped — no terrain mesh");
      return;
    }
    // Grass hat Dual-Pfad (WebGL: ShaderMaterial / WebGPU: NodeMaterial+TSL).
    this.grass = new Grass(
      this.game,
      this.island.terrainMesh,
      this.island.buildings,
      this.road?.curve,
    );
  }

  _buildStationLabels() {
    if (!this.island) {
      console.warn("[World] station labels skipped — island not built yet");
      return;
    }
    this.stationLabels = new StationLabels3D(this.game, this.island.buildings);
  }

  _buildPlayer() {
    const bikeGltf = this.resources.items.bike;
    if (!bikeGltf) {
      console.error("[World] bike GLB missing");
      return;
    }

    // Spawn vor dem HQ — vom User per Browser-Console festgelegt.
    // Story-Start "Zu Hause, das letzte Kapitel". Y leicht angehoben für
    // sauberes Fall-in statt Z-Fighting auf der Auffahrt.
    const spawn = [-4.38, 1.0, 16.63];
    this.player = new Player(this.game, spawn);
    // Visual-Modell asynchron, sobald RigidBody auch ready ist
    this.player.setBikeModel(bikeGltf.scene.clone(true));

    // Camera auf Follow-Mode für den Player
    this.game.cameraRig.setPlayer(this.player);
  }

  /**
   * Berechnet einen Spawn-Punkt vor dem HQ — auf der Straße, Richtung weg
   * vom Gebäude. So fährt der User bei Pageload direkt von HQ los und sieht
   * die Insel mit Story-Reihenfolge im Rücken.
   */
  _computeSpawnFromHQ() {
    const hq = this.island?.buildings?.find?.((b) => b.id === "HQ");
    if (!hq) return null;
    const [bx, by, bz] = hq.position;
    const fw = Array.isArray(hq.frontWorld) ? hq.frontWorld : [0, 0, 1];
    const flen = Math.hypot(fw[0], fw[2]) || 1;
    const fx = fw[0] / flen;
    const fz = fw[2] / flen;
    // ~3.5m vor das HQ — auf den Vorplatz/Garagenauffahrt.
    // Genauer Spawn-Punkt kommt sobald du in der Browser-Konsole die
    // gewünschte Koordinate ausliest:
    //   __game.world.player.body.translation()
    // und sie hier hardcoded eingetragen wird (statt der relativen
    // Berechnung). Solange diese Berechnung ungefähr passt.
    const SPAWN_DIST = 3.5;
    return [bx + fx * SPAWN_DIST, by + 2.0, bz + fz * SPAWN_DIST];
  }

  _buildProximity() {
    this.proximity = new ProximityTrigger(this.game);
    // Alias damit andere Komponenten konsistent .proximityTrigger ansprechen können
    this.proximityTrigger = this.proximity;
    this.proximity.spawnEggGlows();

    // Click-Handler für klickbare Eggs (Router-Pentest, HQ-SQL-Lab)
    import("./EggClickHandler.js")
      .then(({ EggClickHandler }) => {
        this.eggClickHandler = new EggClickHandler(this.game);
      })
      .catch((err) => console.error("[World] EggClickHandler import failed:", err));

    // Tap-to-Move (LoL-Style). Initial disabled — UI.js setzt enabled basierend
    // auf controlMode-Setting. controlMode statisch importieren — es hängt
    // eh schon im Haupt-Chunk (Ui.js/SettingsPanel importieren es statisch).
    import("./TapToMoveController.js")
      .then(({ TapToMoveController }) => {
        this.tapToMove = new TapToMoveController(this.game);
        // Re-apply Mode jetzt wo TapToMove existiert (UI-Init lief vorher).
        this.game.ui?._applyControlMode?.(getControlMode());
      })
      .catch((err) => console.error("[World] TapToMoveController import failed:", err));
  }

  update() {
    // K2-Fix: DayCycle + Wind MÜSSEN zuerst laufen — Grass/StreetLamps/
    // Headlight lesen im selben Frame nightFactor/wind, sonst sind sie 1
    // Frame stale.
    if (this.dayCycle?.update) this.dayCycle.update();
    if (this.sky?.update) this.sky.update();
    if (this.wind?.update) this.wind.update();
    if (this.island?.update) this.island.update();
    if (this.road?.update) this.road.update();
    if (this.streetLamps?.update) this.streetLamps.update();
    if (this.grass?.update) this.grass.update();
    if (this.ocean?.update) this.ocean.update();
    if (this.player?.update) this.player.update();
    if (this.tapToMove?.update) this.tapToMove.update();
    if (this.proximity?.update) this.proximity.update();
    if (this.stationLabels?.update) this.stationLabels.update();
    if (this.colliderDebug?.update) this.colliderDebug.update();
  }

  destroy() {
    this.resources?.destroy?.();
    this.road?.destroy?.();
    this.streetLamps?.destroy?.();
    this.grass?.destroy?.();
    this.ocean?.destroy?.();
    this.sky?.destroy?.();
    this.player?.destroy?.();
    this.island?.destroy?.();
    this.proximity?.destroy?.();
    this.eggClickHandler?.destroy?.();   // fixed: war geleakt
    this.tapToMove?.destroy?.();          // fixed: war geleakt
    this.dayCycle?.destroy?.();
    this.wind?.destroy?.();
    this.stationLabels?.destroy?.();
    this.colliderDebug?.destroy?.();
  }
}
