/**
 * Time — Zentrale Clock.
 *
 *   game.time.elapsed — Sekunden seit Start
 *   game.time.delta   — Sekunden seit letztem Frame (clamped)
 *   game.time.on("tick", () => ...)
 */

import { EventEmitter } from "./EventEmitter.js";

export class Time extends EventEmitter {
  constructor() {
    super();
    this.start = performance.now() / 1000;
    this.current = this.start;
    this.elapsed = 0;
    this.delta = 1 / 60;
    this._rafId = null;
    this._tick = this._tick.bind(this);
    this._rafId = requestAnimationFrame(this._tick);
  }

  _tick() {
    const now = performance.now() / 1000;
    // Delta clamped damit Tab-Wechsel keine Riesen-Sprünge macht und
    // nie negativ wird (Clock-Skew nach Tab-Restore)
    const raw = now - this.current;
    this.delta = Math.max(0, Math.min(0.05, raw));
    this.current = now;
    this.elapsed = this.current - this.start;
    this.trigger("tick", [this.delta, this.elapsed]);
    this._rafId = requestAnimationFrame(this._tick);
  }

  destroy() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = null;
  }
}
