/**
 * Player — Bike-RigidBody + VanMoof-Visual + Controls.
 *
 * Pattern: Dynamic-RigidBody hält Position+Rotation. Visual-Mesh
 * wird in update() vom Body gefolgt (kein Parenting).
 *
 * Controls portiert aus dem alten Next.js-Player.js:
 *   - W/ArrowUp = forward
 *   - S/ArrowDown = backward
 *   - A/Left = turn left
 *   - D/Right = turn right
 *   - Space = brake
 *
 * Forward = +Z in RigidBody-Local-Space (Physics-Convention).
 * VanMoof-Modell hat eine eigene Rotation um sichtbar nach Forward
 * zu zeigen — wird in _setupVisual gesetzt.
 */

import * as THREE from "three";
import { BikeHeadlight } from "./BikeHeadlight.js";

// Konstanten 1:1 aus dem alten About-Me Repo (Player.js).
// Lerp-basierte Beschleunigung statt m/s² — das gibt das weiche Fahrgefühl
// mit sanftem Anfahren und natürlichem Ausrollen.
const MAX_SPEED  = 7.5;       // m/s Top-Speed (alt: 4.5 war zu langsam)
const ACCEL      = 6;         // velocity-lerp-faktor (1/s) → lerpT = min(1, ACCEL*dt)
const BRAKE_LERP_RATE = 10;   // brakeT = min(1, 10*dt) — schärfer als ACCEL
const TURN_SPEED = 2.6;       // rad/s — Drehrate
const SPEED_FACTOR_FLOOR = 0.55;  // Keyboard: Mindest-Drehrate auch im Stand
const ANG_CAP_JOY_MULT = 1.6;     // Joystick: ANG_CAP = TURN_SPEED * 1.6
const JOY_P_GAIN = 5;             // P-Controller für Yaw-Fehler

const SUSPENSION_TAU = 0.10;
const VISUAL_Y_OFFSET = 0.22;

function smoothFactor(dt, tau) {
  return 1 - Math.exp(-dt / Math.max(0.001, tau));
}

export class Player {
  constructor(game, spawnPos = [-6.72, 2.0, 8.80]) {
    this.game = game;
    this.scene = game.scene;
    this.physics = game.physics;
    this.inputs = game.inputs;
    this.resources = null;     // wird von außen gesetzt (für bike GLB)
    this.body = null;
    this.collider = null;
    this.visualRoot = null;
    this.bikeModel = null;
    this.headlight = null;
    this.spawnPos = spawnPos;

    // Federung-State: Visual-Y federt zum Body-Y mit Lag → fühlt sich
    // an wie gefederte Federgabel beim Hochhüpfen auf Bordsteinkanten
    this._visualY = null;          // wird beim ersten update() gesetzt

    // Reusable temp objects
    this._tmpPos = new THREE.Vector3();
    this._tmpQuat = new THREE.Quaternion();
    this._tmpEuler = new THREE.Euler(0, 0, 0, "YXZ");
    this._tmpForward = new THREE.Vector3();
    this._tmpCamDir = new THREE.Vector3();

    // Forward-Local: wird in _setupVisual aus bikeModel.getWorldDirection
    // kalibriert. Fallback: +Z (Standard-Three.js-Convention).
    this._forwardLocal = new THREE.Vector3(0, 0, 1);

    // Tap-to-Move-Target (LoL-Style). Wenn gesetzt, fährt das Bike autonom
    // dorthin. Wird vom TapToMoveController.js gesetzt + bei Erreichen gecleart.
    // Form: { x, z } in Welt-Koordinaten.
    this._tapTarget = null;
    this._TAP_ARRIVE_RADIUS = 1.2;   // wie nahe = "angekommen"
    this._TAP_SLOW_RADIUS = 4.0;     // ab da fängt Bike an zu bremsen

    // Setup body sobald Physics ready
    if (this.physics.ready) {
      this._setupBody();
    } else {
      this.physics.on("ready", () => this._setupBody());
    }
  }

  setBikeModel(model) {
    this.bikeModel = model;
    this._setupVisual();
  }

  /** Tap-to-Move (LoL-Style): Bike fährt autonom zum Welt-Punkt {x,z}.
   *  Übersteuert Joystick/Keyboard solange aktiv. Wird gecleart wenn das
   *  Bike den Punkt erreicht oder Joystick/WASD-Input kommt. */
  setTapTarget(x, z) {
    this._tapTarget = { x, z };
  }

  clearTapTarget() {
    this._tapTarget = null;
  }

  _setupBody() {
    const world = this.physics.world;
    // RAPIER aus dem Physics-Modul (dynamic import) — läuft erst nach
    // physics.ready, da ist das Modul garantiert geladen.
    const RAPIER = this.physics.RAPIER;
    if (!world || !RAPIER) return;
    const [x, y, z] = this.spawnPos;
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, y, z)
      .setLinearDamping(0.6)
      .setAngularDamping(4.0)
      .enabledRotations(false, true, false)   // nur Yaw-Rotation
      .setCcdEnabled(true);
    this.body = world.createRigidBody(bodyDesc);

    // Capsule statt Cuboid — Cuboids haben scharfe Kanten die an Trimesh-
    // Triangle-Edges hängenbleiben und das Bike permanent abbremsen.
    // Eine vertikale Kapsel gleitet smooth über Unebenheiten.
    //   radius = 0.45m, halfHeight = 0.4m → Gesamthöhe 1.7m (vertical)
    const CAPSULE_RADIUS = 0.45;
    const CAPSULE_HALF_HEIGHT = 0.4;
    const colDesc = RAPIER.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS)
      // Capsule-Center auf radius+halfHeight Höhe damit Bike-Boden bei Y=0 ist
      .setTranslation(0, CAPSULE_RADIUS + CAPSULE_HALF_HEIGHT + 0.05, 0)
      .setMass(1.2)
      .setFriction(0.05)       // sehr wenig Reibung
      .setRestitution(0.0);
    this.collider = world.createCollider(colDesc, this.body);

    console.log("[Player] body created at", this.spawnPos);
  }

  _setupVisual() {
    if (!this.bikeModel) return;
    // Originale Rotation aus dem alten Repo (das Visual war damit korrekt).
    this.visualRoot = new THREE.Group();
    this.bikeModel.rotation.set(0, -Math.PI / 2, 0);
    this.visualRoot.add(this.bikeModel);

    // GLB-Defensive: VanMoof-USDZ→glTF Bake hat Probleme:
    //   1. Chrome_material.emissiveFactor=[1,1,1] + emissive-Texture
    //      → leuchtet reinweiß
    //   2. metallic=1 + roughness=0.2 ohne HDR-Sky-Env clipped weiß
    //   3. Materials sind shared zwischen den 14 Meshes des Bikes
    // Wir klonen die Materials, damit unsere Anpassungen die Original-Cache-
    // Materials des Resources-Loaders nicht touchen, und ziehen sie auf
    // sinnvolle PBR-Defaults.
    let neutralized = 0;
    const wrap = (mat) => {
      if (!mat) return mat;
      const m = mat.clone();
      const name = m.name || "unnamed";
      const isLight = /light_rear/i.test(name);

      if (isLight) {
        // Rear-Light soll leuchten, aber zurückgehalten — sonst bloomt es
        // bei Nacht den halben Bildschirm aus.
        if ("emissiveIntensity" in m) m.emissiveIntensity = 0.55;
      } else {
        m.emissive?.setRGB?.(0, 0, 0);
        if ("emissiveIntensity" in m) m.emissiveIntensity = 0;
        if (m.emissiveMap) m.emissiveMap = null;
      }

      // Cap mirror-metalness — RoomEnvironment-Probe ist kein HDR-Sky.
      if ("metalness" in m && typeof m.metalness === "number" && m.metalness > 0.85) {
        m.metalness = 0.85;
      }
      // Floor roughness — pure mirror (rough < 0.25) ohne richtige HDR-Env
      // sieht nach Sample-Color statt nach Reflexion aus.
      if ("roughness" in m && typeof m.roughness === "number" && m.roughness < 0.25) {
        m.roughness = 0.25;
      }
      if ("envMapIntensity" in m) m.envMapIntensity = 0.8;

      // Fallback-BaseColor falls baseColorTexture fehlt oder failed loaded
      // (z.B. unter aggressiver CSP). VanMoof S3 ist matt-anthrazit.
      if (!m.map && m.color) {
        const FALLBACKS = {
          Frame_material: 0x18181b,
          Chrome_material: 0x9a9a9d,
          Extras_material: 0x232326,
          Tire_Front_material: 0x121214,
          Tire_Rear_material: 0x121214,
          Reflectors_material: 0xcfd2d6,
          Extras_Metallic_Silver_material: 0x8d8e90,
          Extras_Metallic_Black_material: 0x1a1a1c,
          Brakes_material: 0x303035,
          Valves_material: 0x4a4a4d,
          Valve_Heads_material: 0x303033,
          Kick_Lock_Yellow_material: 0x8a8a16,
        };
        const hex = FALLBACKS[name];
        if (hex !== undefined) m.color.setHex(hex);
      }

      m.needsUpdate = true;
      neutralized++;
      return m;
    };

    this.bikeModel.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      obj.material = Array.isArray(obj.material)
        ? obj.material.map(wrap)
        : wrap(obj.material);
    });
    console.log(`[Player] bike materials neutralized: ${neutralized}`);
    this.scene.add(this.visualRoot);
    // Env-Map nachträglich aufziehen falls schon ready, sonst hängt World
    // sich an renderer.ready und ruft _applyEnvMap() später nach.
    this._applyEnvMap();

    // Forward-Local des Bike-Modells nach -π/2-Rotation = +Z im visualRoot-Space
    // (per URL-Test ?bikefwd=+z verifiziert). _tmpForward = _forwardLocal.applyQuat
    // beschleunigt entlang sichtbarem Lenker.
    this._forwardLocal.set(0, 0, 1);

    // Bike-Headlight am visualRoot — folgt automatisch Position+Rotation
    this.headlight = new BikeHeadlight(this.game, this.visualRoot);
  }

  /**
   * Zieht das PMREM-Env-Texture auf die Bike-Materials. Wird sowohl direkt
   * nach _setupVisual aufgerufen (env evtl. noch nicht ready), als auch
   * nochmal von World._setupLights's initEnv() sobald renderer fertig ist.
   * Idempotent — überspringt Materials die schon eine envMap haben.
   */
  _applyEnvMap() {
    if (!this.bikeModel) return;
    const envMap = this.game?.world?.envTexture;
    if (!envMap) return;
    let applied = 0;
    this.bikeModel.traverse((obj) => {
      if (!obj.isMesh) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (!m || m.envMap || !("envMap" in m)) continue;
        m.envMap = envMap;
        m.needsUpdate = true;
        applied++;
      }
    });
    if (applied > 0) console.log(`[Player] bike envMap applied to ${applied} mats`);
  }

  update() {
    if (!this.body) return;

    // ── Walkthrough-Sperre ──
    // Solange die geführte Tour aktiv ist (Drawer offen, Camera in
    // Cinematic-Pose), darf der User das Bike NICHT steuern — sonst springt
    // die Camera aus der Tour-Pose und der Recruiter verliert den Blick auf
    // das Gebäude. Wir frieren das Bike an seiner aktuellen Position ein
    // (Linvel/Angvel auf 0) und überspringen sämtliche Input-Verarbeitung.
    const tourActive = !!this.game?.ui?.walkthrough?.active;
    if (tourActive) {
      // Bike stoppt (Y bleibt frei für Schwerkraft)
      const cur = this.body.linvel();
      this.body.setLinvel({ x: 0, y: cur.y, z: 0 }, true);
      this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      // Visual weiter syncen damit das Bike sichtbar bleibt
      this._syncVisual();
      // Headlight folgt visualRoot — Update auch bei Pause
      if (this.headlight) this.headlight.update();
      // Camera-Reset-Flag vergessen damit beim Tour-Ende der erste WASD-
      // Druck den Follow-Mode korrekt wieder einschaltet
      this._wasAnyInput = false;
      return;
    }

    const k = this.inputs.keys;
    const delta = this.game.time.delta;

    // ── Joystick-Input (Mobile) ──
    // Wenn der TouchJoystick aktiv ist, nutzen wir Heading-Vector-Logik
    // Finger zeigt in die Welt-Richtung in die das Bike fahren
    // soll. Bike dreht sich smooth dahin (P-Controller), Throttle = magnitude.
    const joy = this.game?.ui?.touchJoystick?.input;
    const joyActive = !!joy?.active && joy.magnitude > 0.05;

    // ── Tap-to-Move-Target (LoL-Style) ──
    // Wenn ein Tap-Target gesetzt ist UND weder Joystick noch WASD aktiv:
    // virtueller Joystick-Input Richtung Target. WASD/Joystick übersteuern.
    let tapInput = null;   // { x, y, magnitude } analog joy
    if (this._tapTarget && !joyActive && !(k.forward || k.backward || k.left || k.right)) {
      const curT = this.body.translation();
      const dx = this._tapTarget.x - curT.x;
      const dz = this._tapTarget.z - curT.z;
      const dist = Math.hypot(dx, dz);
      if (dist < this._TAP_ARRIVE_RADIUS) {
        // Angekommen — Target clearen
        this._tapTarget = null;
      } else {
        // Throttle: in der Nähe abbremsen für sanftes Stoppen
        const throttle = Math.min(1, dist / this._TAP_SLOW_RADIUS);
        const nx = (dx / dist);
        const nz = (dz / dist);
        // Joystick-Konvention: y = camForward-Komponente, x = camRight-Komponente.
        // Aber Tap-Target liegt direkt in Welt-Koordinaten — wir müssen ins
        // camera-relative System konvertieren.
        const cam = this.game.cameraRig?.camera;
        let camFwdX = 0, camFwdZ = 1;
        if (cam) {
          const v = this._tmpCamDir;
          cam.getWorldDirection(v);
          v.y = 0;
          const len = Math.hypot(v.x, v.z) || 1;
          camFwdX = v.x / len;
          camFwdZ = v.z / len;
        }
        const camRightX = -camFwdZ;
        const camRightZ =  camFwdX;
        // Heading-Welt-Vektor (nx, nz) → cam-relative (jx, jy)
        const jx = nx * camRightX + nz * camRightZ;
        const jy = nx * camFwdX   + nz * camFwdZ;
        tapInput = { x: jx, y: jy, magnitude: throttle };
      }
    }
    // Tap-Modus wird als Joystick-Pfad behandelt — wir injecten in den joy-Pfad:
    const effectiveJoy = joyActive ? joy : (tapInput || null);
    const effectiveJoyActive = joyActive || !!tapInput;
    // Wenn WASD aktiv → Tap-Target abbrechen
    if ((k.forward || k.backward || k.left || k.right) && this._tapTarget) {
      this._tapTarget = null;
    }

    // ── Inputs interpretieren (Keyboard-Fallback) ──
    const fwdIn = (k.forward ? 1 : 0) - (k.backward ? 1 : 0);
    const turnIn = (k.left ? 1 : 0) - (k.right ? 1 : 0);
    const brakeDown = k.brake;

    // ── Camera-Auto-Recenter (nur beim ersten Input-Frame) ──
    // Sobald der User eine Bewegungstaste drückt — und vorher KEINE
    // Bewegungstaste gedrückt war — wird followMode reaktiviert. Setzt
    // man's jeden Frame, kann man während des Fahrens nicht draggen.
    // (Tour-Cinematic bricht NICHT mehr durch WASD ab — Tour-Sperre oben
    // verhindert dass dieser Zweig während Tour erreicht wird.)
    const anyInput = k.forward || k.backward || k.left || k.right
                     || joyActive || !!this._tapTarget;
    if (anyInput && !this._wasAnyInput && this.game.cameraRig) {
      this.game.cameraRig.followMode = true;
    }
    this._wasAnyInput = anyInput;

    // ── Current state ──
    const t = this.body.translation();
    const r = this.body.rotation();
    this._tmpQuat.set(r.x, r.y, r.z, r.w);

    // ── Fall-Reset ──
    // Bike unter Y=-2 = Bike ist von der Insel runtergefallen (Ozean,
    // Insel-Rand). Teleport zurück zum Spawn statt endlosem Sturz.
    if (t.y < -2) {
      const [sx, sy, sz] = this.spawnPos;
      this.body.setTranslation({ x: sx, y: sy, z: sz }, true);
      this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      this._visualY = sy;
      console.log("[Player] fell off island — respawned at", this.spawnPos);
      return;
    }

    // ── Stuck-Detection deaktiviert ──
    // War Symptom-Behandlung für Cuboid-Collider der an Trimesh-Edges hing.
    // Mit Capsule-Collider gleitet das Bike smooth, Stuck-Recovery überflüssig.
    // Falls Bike doch mal hängt: Y < -2 → Fall-Reset oben greift weiterhin.

    // Bike-Forward in World-Space (aus aktuellem Quaternion).
    // _forwardLocal wird einmalig bei Spawn aus bikeModel.getWorldDirection
    // kalibriert — egal welche Rotation das GLB im Lokal-Space hat, wir
    // beschleunigen immer entlang des sichtbaren Lenkers.
    this._tmpForward.copy(this._forwardLocal).applyQuaternion(this._tmpQuat);

    // ─── Movement-Logik 1:1 aus dem alten About-Me Repo ───
    // Lerp-basierte Beschleunigung statt m/s². ACCEL=6 ist ein Faktor pro
    // Sekunde, bei 60fps gibt das lerpT ≈ 0.10 = 10% Annäherung pro Frame.
    // Brake hat eigenen aggressiveren Faktor (10*dt).
    const cur = this.body.linvel();
    const groundSpeed = Math.hypot(cur.x, cur.z);
    const lerpT  = Math.min(1, ACCEL * delta);
    const brakeT = brakeDown ? Math.min(1, BRAKE_LERP_RATE * delta) : lerpT;

    let targetVx, targetVz, angY;

    if (effectiveJoyActive) {
      // ── JOYSTICK oder TAP-TARGET = Heading-Vector camera-relative ──
      const joy = effectiveJoy;   // shadowing für minimal-invasive Änderung
      const cam = this.game.cameraRig?.camera;
      let camForwardX = 0, camForwardZ = 1;
      if (cam) {
        const v = this._tmpCamDir;
        cam.getWorldDirection(v);
        v.y = 0;
        const len = Math.hypot(v.x, v.z) || 1;
        camForwardX = v.x / len;
        camForwardZ = v.z / len;
      }
      const camRightX = -camForwardZ;
      const camRightZ =  camForwardX;

      // Desired = camFwd * jY + camRight * jX
      let desX = camForwardX * joy.y + camRightX * joy.x;
      let desZ = camForwardZ * joy.y + camRightZ * joy.x;
      const desLen = Math.hypot(desX, desZ) || 1;
      desX /= desLen;
      desZ /= desLen;

      // Desired Yaw via P-Controller.
      // Aktuelle Welt-Yaw direkt aus dem schon-rotierten _tmpForward ableiten
      // statt aus _tmpEuler — Euler-XYZ-Extraktion driftet bei kleinen
      // Quaternion-Ungenauigkeiten, was zu einem steady-state Offset führt
      // ("Bike lenkt nicht ganz zum Ziel"). atan2 vom Forward-Vektor ist
      // exakt, weil _forwardLocal=(0,0,1) bereits durch die Body-Quat
      // rotiert wurde.
      const desYawWorld = Math.atan2(desX, desZ);
      const curYawWorld = Math.atan2(this._tmpForward.x, this._tmpForward.z);
      let dy = desYawWorld - curYawWorld;
      while (dy >  Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;

      const ANG_CAP = TURN_SPEED * ANG_CAP_JOY_MULT;
      angY = THREE.MathUtils.clamp(dy * JOY_P_GAIN, -ANG_CAP, ANG_CAP);

      // Throttle = volle Leistung sobald der Joystick aus der Dead-Zone ist.
      // Wie auf PC mit W-Taste: kein analoges Skalieren. Heading-Alignment bleibt
      // damit das Bike bei seitlicher Richtung sanft in die Kurve geht (sonst
      // schießt es in die alte Richtung weiter). Floor bei 0.4 damit das Bike
      // bei 90°/180°-Lenken nicht komplett zum Stillstand kommt — es soll
      // während der Drehung weiter rollen.
      const alignment = Math.max(0.4, 0.5 + 0.5 * Math.cos(dy));
      const targetSpeed = MAX_SPEED * alignment;
      targetVx = this._tmpForward.x * targetSpeed;
      targetVz = this._tmpForward.z * targetSpeed;

    } else {
      // ── KEYBOARD (digital, kein Analog) ──
      const targetSpeed = fwdIn * MAX_SPEED * (brakeDown ? 0 : 1);
      targetVx = this._tmpForward.x * targetSpeed;
      targetVz = this._tmpForward.z * targetSpeed;

      // Lenken skaliert mit aktueller Speed — Min-Floor SPEED_FACTOR_FLOOR.
      // → Bei Stand 55% Drehrate, bei Topspeed 100%. Lenkbar von Anfang an.
      const speedFactor = turnIn !== 0
        ? THREE.MathUtils.clamp(groundSpeed / MAX_SPEED, SPEED_FACTOR_FLOOR, 1)
        : 0;
      angY = turnIn !== 0 ? turnIn * TURN_SPEED * speedFactor : 0;
    }

    // ─── Linvel-Commit mit Lerp ───
    // brakeDown → Ziel ist (0,0); sonst zur targetVx/Vz lerpen.
    const targetX = brakeDown ? 0 : targetVx;
    const targetZ = brakeDown ? 0 : targetVz;
    const useT = brakeDown ? brakeT : lerpT;
    this.body.setLinvel(
      {
        x: THREE.MathUtils.lerp(cur.x, targetX, useT),
        y: cur.y,    // Y frei für Gravity
        z: THREE.MathUtils.lerp(cur.z, targetZ, useT),
      },
      true,
    );
    this.body.setAngvel({ x: 0, y: angY, z: 0 }, true);

    // ── Visual sync mit Federung + Höhen-Offset ──
    this._syncVisual();

    // ── Headlight Target im World-Space updaten ──
    if (this.headlight) this.headlight.update();
  }

  /** Visual-Mesh des Bikes an Rigid-Body-Position+Rotation syncen. */
  _syncVisual() {
    if (!this.body || !this.visualRoot) return;
    const t = this.body.translation();
    const r = this.body.rotation();
    this._tmpQuat.set(r.x, r.y, r.z, r.w);
    this.visualRoot.position.x = t.x;
    this.visualRoot.position.z = t.z;
    if (this._visualY === null) {
      this._visualY = t.y;
    } else {
      // Frame-rate-unabhängiges Smoothing
      const dt = this.game?.time?.delta || 0.016;
      const lerpT = smoothFactor(dt, SUSPENSION_TAU);
      this._visualY = THREE.MathUtils.lerp(this._visualY, t.y, lerpT);
    }
    this.visualRoot.position.y = this._visualY + VISUAL_Y_OFFSET;
    this.visualRoot.quaternion.copy(this._tmpQuat);
  }

  getPosition() {
    if (!this.body) return new THREE.Vector3(...this.spawnPos);
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }

  destroy() {
    // K8-Fix: vollständiges Cleanup — Headlight, Visual-Group, Bike-GLB,
    // RigidBody+Collider, Reusable temps loslassen.
    this.headlight?.destroy?.();
    this.headlight = null;

    // Visual-Mesh aus Scene + Geometry/Material dispose
    if (this.visualRoot) {
      this.scene.remove(this.visualRoot);
      this.visualRoot.traverse((obj) => {
        if (obj.isMesh) {
          obj.geometry?.dispose?.();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m?.dispose?.());
          } else {
            obj.material?.dispose?.();
          }
        }
      });
      this.visualRoot = null;
      this.bikeModel = null;
    }

    // Rapier-Body + Collider freigeben (Collider hängt am Body → removeRigidBody
    // entfernt ihn auto, aber wir nullen die Refs trotzdem).
    if (this.physics?.world) {
      if (this.collider) {
        try { this.physics.world.removeCollider(this.collider, false); } catch (e) {}
      }
      if (this.body) {
        try { this.physics.world.removeRigidBody(this.body); } catch (e) {}
      }
    }
    this.collider = null;
    this.body = null;
    this._visualY = null;
    this._wasAnyInput = false;
  }
}
