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
    this.ready = true;
    this.trigger("ready", []);
  }

  update() {
    if (!this.ready || !this.world) return;
    // Variable timestep via game.time.delta — Rapier handled das selbst
    // mit substepping wenn delta > dt.
    this.world.step();
  }

  destroy() {
    if (this.world) this.world.free();
    this.world = null;
    this.ready = false;
  }
}
