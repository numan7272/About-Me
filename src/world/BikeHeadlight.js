/**
 * BikeHeadlight — Fahrrad-Scheinwerfer.
 *
 * Portiert aus altem Next.js BikeHeadlight.js.
 *
 * Minimal-Variante OHNE visuellen Cone — nur ein echtes SpotLight das
 * die Welt vor dem Bike beleuchtet. Kein Mesh, kein Beam-Shader.
 *
 * Wird am visualRoot des Players geparented → erbt automatisch
 * Position+Rotation des Bikes (lenkt mit, schwenkt mit, etc).
 *
 * Da DayCycle in Phase 5 kommt, ist die Intensity vorerst per Konstante
 * gesetzt. Toggle via F-Taste (Headlight an/aus).
 */

import * as THREE from "three";

// Lokal-Position relativ zum Bike-Visual-Root.
// Bike-Forward (lokal) ist +Z, also Lampe vorne+oben am Bike.
const LAMP_LOCAL_POS = [0, 0.85, 0.6];
// Target weit vor dem Bike — bestimmt die Richtung des Lichtkegels.
const TARGET_LOCAL_POS = [0, 0.0, 13];

const LIGHT_COLOR = 0xfff4c8;
const LIGHT_INTENSITY = 8.0;
const LIGHT_DISTANCE = 22;
const LIGHT_ANGLE = Math.PI / 5;     // ~36° Öffnungswinkel
const LIGHT_PENUMBRA = 0.45;
const LIGHT_DECAY = 1.5;

export class BikeHeadlight {
  constructor(game, parentGroup) {
    this.game = game;
    this.scene = game.scene;
    this.parent = parentGroup;
    this.on = true;   // Standardmäßig an — F toggelt

    // SpotLight erzeugen + lokal positionieren
    this.light = new THREE.SpotLight(
      LIGHT_COLOR,
      LIGHT_INTENSITY,
      LIGHT_DISTANCE,
      LIGHT_ANGLE,
      LIGHT_PENUMBRA,
      LIGHT_DECAY,
    );
    this.light.position.set(...LAMP_LOCAL_POS);
    this.light.castShadow = false;

    // Target-Object — das SpotLight schaut auf dessen World-Position.
    // Target muss in der Scene leben, NICHT im visualRoot — sonst würde
    // es mitrotieren und der Cone würde verzerren.
    this.target = new THREE.Object3D();
    this.scene.add(this.target);
    this.light.target = this.target;

    // Light selbst geht in den Bike-visualRoot — bewegt + rotiert mit
    this.parent.add(this.light);

    // Reusable temp
    this._tmpTarget = new THREE.Vector3();

    // Keyboard-Toggle: F
    // K3-Fix: F setzt nur das on-Flag. Die Intensity wird AUSSCHLIESSLICH in
    // update() geschrieben — basierend auf (on ? 1 : 0) * nightFactor.
    // Kein Tug-of-War mehr zwischen Toggle und DayCycle.
    this._onKeyDown = (e) => {
      if (e.code === "KeyF") {
        this.on = !this.on;
        console.log(`[Headlight] ${this.on ? "ON" : "OFF"}`);
      }
    };
    window.addEventListener("keydown", this._onKeyDown);

    this._setupDebug();
  }

  _setupDebug() {
    const debug = this.game?.debug;
    if (!debug?.active) return;
    const f = debug.addFolder({ title: "Headlight", expanded: false });
    this._debugState = {
      on: this.on,
      maxIntensity: LIGHT_INTENSITY,
      angle: LIGHT_ANGLE,
      penumbra: LIGHT_PENUMBRA,
      distance: LIGHT_DISTANCE,
    };
    f.addBinding(this._debugState, "on")
      .on("change", (ev) => { this.on = ev.value; });
    f.addBinding(this._debugState, "maxIntensity", { min: 0, max: 30, step: 0.5 })
      .on("change", (ev) => { this._maxIntensity = ev.value; });
    f.addBinding(this._debugState, "angle", { min: 0.05, max: Math.PI / 2, step: 0.01 })
      .on("change", (ev) => { this.light.angle = ev.value; });
    f.addBinding(this._debugState, "penumbra", { min: 0, max: 1, step: 0.01 })
      .on("change", (ev) => { this.light.penumbra = ev.value; });
    f.addBinding(this._debugState, "distance", { min: 5, max: 60, step: 1 })
      .on("change", (ev) => { this.light.distance = ev.value; });
    this._maxIntensity = LIGHT_INTENSITY;
  }

  update() {
    // Target-Position jeden Frame in World-Space neu berechnen — wir
    // nehmen TARGET_LOCAL_POS, transformieren es durch die Parent-Matrix
    // (= visualRoot des Bikes). So zeigt der Cone immer dahin wo das
    // Bike hinschaut.
    if (!this.parent) return;

    this._tmpTarget.set(...TARGET_LOCAL_POS);
    this.parent.updateMatrixWorld();
    this._tmpTarget.applyMatrix4(this.parent.matrixWorld);
    this.target.position.copy(this._tmpTarget);

    // K3-Fix: Single Source of Truth — Intensity = on × nightFactor × MAX.
    // F-Toggle steuert nur das on-Flag, DayCycle steuert nur nightFactor.
    // _maxIntensity ist debug-tunable, default = LIGHT_INTENSITY.
    const maxI = this._maxIntensity ?? LIGHT_INTENSITY;
    if (!this.on) {
      this.light.intensity = 0;
    } else if (this.game.world?.dayCycle) {
      const night = this.game.world.dayCycle.getNightFactor();
      this.light.intensity = night * maxI;
    } else {
      this.light.intensity = maxI;
    }
  }

  destroy() {
    window.removeEventListener("keydown", this._onKeyDown);
    this.parent?.remove?.(this.light);
    this.scene?.remove?.(this.target);
    this.light?.dispose?.();
  }
}
