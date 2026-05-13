/**
 * Sizes — Viewport-Tracking + Resize-Event.
 *
 *   game.sizes.width   — innerWidth
 *   game.sizes.height  — innerHeight
 *   game.sizes.pixelRatio  — devicePixelRatio (capped auf 2)
 *   game.sizes.aspect  — width / height
 *   game.sizes.on("resize", () => ...)
 */

import { EventEmitter } from "./EventEmitter.js";

export class Sizes extends EventEmitter {
  constructor() {
    super();
    this._onResize = this._onResize.bind(this);
    this._read();
    window.addEventListener("resize", this._onResize);
    window.addEventListener("orientationchange", this._onResize);
  }

  _read() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.aspect = this.width / Math.max(1, this.height);
    this.pixelRatio = Math.min(2, window.devicePixelRatio || 1);
  }

  _onResize() {
    this._read();
    this.trigger("resize", []);
  }

  destroy() {
    window.removeEventListener("resize", this._onResize);
    window.removeEventListener("orientationchange", this._onResize);
  }
}
