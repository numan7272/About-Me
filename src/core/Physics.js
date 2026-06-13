/**
 * Physics — Rapier3D-Wrapper.
 *
 * @dimforge/rapier3d-compat lädt eine WASM-Datei asynchron. Wir
 * warten auf init() bevor die World existiert. Sub-Module die
 * Collider hinzufügen müssen also auf `physics.ready` warten.
 *
 * Step-Loop wird vom Game.update() pro Frame getrigert.
 */

import { EventEmitter } from "./EventEmitter.js";

export class Physics extends EventEmitter {
  constructor(game) {
    super();
    this.game = game;
    this.world = null;
    this.ready = false;
    this.gravity = { x: 0, y: -18, z: 0 };
    // Wird in _init() gesetzt — Sub-Module (Player, Island) greifen erst
    // nach dem "ready"-Event darauf zu.
    this.RAPIER = null;

    this._init();
  }

  async _init() {
    // Dynamic import: rapier3d-compat bringt ~2MB inline-WASM mit. Als
    // eigener Chunk lädt es parallel zum Rest statt den Haupt-Chunk
    // aufzublähen (First-Paint deutlich früher).
    const { default: RAPIER } = await import("@dimforge/rapier3d-compat");
    await RAPIER.init();
    this.RAPIER = RAPIER;
    this.world = new RAPIER.World(this.gravity);
    this.world.integrationParameters.dt = 1 / 60;
    this._accumulator = 0;
    this.ready = true;
    this.trigger("ready", []);
  }

  update() {
    if (!this.ready || !this.world) return;
    // Fixed-Timestep-Accumulator. world.step() simuliert exakt dt=1/60s
    // pro Aufruf — Rapier macht KEIN automatisches Substepping. Einmal pro
    // Frame steppen hieße: Simulationszeit = Framerate/60 → das Bike fährt
    // auf einem 40fps-Handy langsamer und auf einem 144Hz-Desktop schneller
    // als gedacht. Stattdessen echte Zeit akkumulieren und in festen
    // Schritten abarbeiten (time.delta ist bereits auf 0.05s geclamped).
    const FIXED_DT = 1 / 60;
    this._accumulator += this.game.time.delta;
    let steps = 0;
    while (this._accumulator >= FIXED_DT && steps < 4) {
      this.world.step();
      this._accumulator -= FIXED_DT;
      steps++;
    }
    // Überlast: Rest verwerfen statt aufholen — lieber kurz Zeitlupe als
    // eine Spiral-of-Death aus immer mehr Steps pro Frame.
    if (steps === 4 && this._accumulator >= FIXED_DT) this._accumulator = 0;
  }

  destroy() {
    if (this.world) this.world.free();
    this.world = null;
    this.ready = false;
  }
}
