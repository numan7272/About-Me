/**
 * Resources — Asset-Loader für GLBs, Texturen, Audio.
 *
 * Nutzt GLTFLoader + DRACOLoader (die GLBs sind Draco-komprimiert).
 * Emit "ready" wenn alle gewünschten Assets geladen sind, plus
 * "progress" pro Asset.
 *
 * Zusätzlich:
 *   "loading" (ratio, info) — feingranularer Byte-Fortschritt 0..1 für den
 *     Ladescreen. info = { loaded, total, bytesLoaded, bytesTotal }.
 *     `loaded`/`total` zählen fertige vs. blockierende Assets.
 *   "deferred" (name, asset) — ein nachgeladenes (nicht-blockierendes)
 *     Asset ist abspielbereit.
 *
 * Audio blockiert den Ladescreen NICHT: Audio-Quellen landen in
 * `deferredSources`, zählen nicht in `total` und werden erst mit
 * `loadDeferred()` angefordert (Game.js ruft das beim "Klick zum Start").
 *
 * Usage:
 *   const res = new Resources({ island: "/maps/island.glb", bike: "/vanmoof-transformed.glb" })
 *   res.on("ready", () => { console.log(res.items.island) })
 *   res.on("progress", (name, ratio) => { ... })
 *   res.on("loading", (ratio, { loaded, total }) => { ... })
 */

import { EventEmitter } from "./EventEmitter.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const AUDIO_RE = /\.(mp3|ogg|wav)([?#].*)?$/i;

// Download-Anteil pro Asset: die letzten 5 % gehören dem Draco-Decode/Parse,
// damit der Balken nicht bei 100 % hängt, während noch dekodiert wird.
const DOWNLOAD_SHARE = 0.95;

export class Resources extends EventEmitter {
  constructor(sources = {}) {
    super();
    this.sources = {};          // blockierend (GLB/GLTF/…)
    this.deferredSources = {};  // nicht-blockierend (Audio)
    for (const [name, url] of Object.entries(sources)) {
      if (AUDIO_RE.test(url)) this.deferredSources[name] = url;
      else this.sources[name] = url;
    }
    this.items = {};
    this.total = Object.keys(this.sources).length;
    this.loaded = 0;
    this.errors = [];
    this._destroyed = false;

    // Byte-Fortschritt pro blockierendem Asset
    this._progress = {};
    for (const name of Object.keys(this.sources)) {
      this._progress[name] = { loaded: 0, total: 0, done: false };
    }
    this._lastRatio = 0;
    this._deferredStarted = false;

    // DRACOLoader — Decoder lokal in /public/draco/gltf/ (matched Three.js
    // Version-zwischen Decoder + Loader). Wasm-basiert ist schneller als js.
    this.draco = new DRACOLoader();
    this.draco.setDecoderPath("/draco/gltf/");
    this.draco.setDecoderConfig({ type: "wasm" });
    this.draco.setWorkerLimit(2);
    if (this.total > 0) {
      this.draco.preload();
      this.draco.decoderPending.catch(() => {});
    }

    this.gltf = new GLTFLoader();
    this.gltf.setDRACOLoader(this.draco);
    // Falls das GLB Meshopt-Compression nutzt
    this.gltf.setMeshoptDecoder(MeshoptDecoder);

    // Listeners attached just after construction must also see empty loads.
    queueMicrotask(() => { if (!this._destroyed) this._load(); });
  }

  _load() {
    if (this.total === 0) {
      this.trigger("ready", []);
      return;
    }

    for (const [name, url] of Object.entries(this.sources)) {
      const lower = url.split(/[?#]/)[0].toLowerCase();
      if (lower.endsWith(".glb") || lower.endsWith(".gltf")) {
        this.gltf.load(
          url,
          (gltf) => this._onLoaded(name, gltf),
          (evt) => this._onBytes(name, evt),
          (err) => this._onError(name, err),
        );
      } else {
        console.warn(`[Resources] unknown asset type: ${url}`);
        this._onLoaded(name, null);
      }
    }
  }

  /**
   * Nicht-blockierende Assets (Audio) anfordern. Idempotent. Wird erst
   * nach dem Start aufgerufen, damit z. B. ambient.mp3 nicht mit den
   * GLBs um Bandbreite konkurriert und nie den Ladescreen aufhält.
   */
  loadDeferred() {
    if (this._deferredStarted) return;
    this._deferredStarted = true;
    for (const [name, url] of Object.entries(this.deferredSources)) {
      const a = new Audio();
      a.preload = "auto";
      a.addEventListener("canplaythrough", () => {
        this.items[name] = a;
        this.trigger("deferred", [name, a]);
      }, { once: true });
      a.addEventListener("error", () => {
        console.warn(`[Resources] deferred audio failed: ${url}`);
      }, { once: true });
      a.src = url;
    }
  }

  /** Byte-Progress vom GLTFLoader (ProgressEvent: loaded/total). */
  _onBytes(name, evt) {
    const p = this._progress[name];
    if (!p || p.done || !evt) return;
    p.loaded = evt.loaded || 0;
    // total ist 0 wenn der Server keine Content-Length liefert
    if (evt.lengthComputable && evt.total > 0) p.total = evt.total;
    this._emitLoading();
  }

  /** Gesamt-Fortschritt 0..1 — nach Bytes gewichtet, sobald alle Größen bekannt sind. */
  _computeRatio() {
    const entries = Object.values(this._progress);
    if (entries.length === 0) return 1;
    const frac = (p) => {
      if (p.done) return 1;
      if (p.total <= 0) return 0;
      return Math.min(1, p.loaded / p.total) * DOWNLOAD_SHARE;
    };
    const allSized = entries.every((p) => p.done || p.total > 0);
    if (allSized) {
      let sum = 0;
      let weighted = 0;
      for (const p of entries) {
        const size = p.total > 0 ? p.total : Math.max(1, p.loaded);
        sum += size;
        weighted += size * frac(p);
      }
      return sum > 0 ? weighted / sum : 0;
    }
    // Fallback ohne Content-Length: jedes Asset gleich gewichtet
    return entries.reduce((acc, p) => acc + frac(p), 0) / entries.length;
  }

  _emitLoading() {
    // Monoton — der Balken springt nie zurück (z. B. wenn ein zweites
    // Asset seine Größe erst später meldet und die Gewichtung kippt).
    const ratio = Math.max(this._lastRatio, Math.min(1, this._computeRatio()));
    this._lastRatio = ratio;
    let bytesLoaded = 0;
    let bytesTotal = 0;
    for (const p of Object.values(this._progress)) {
      bytesLoaded += p.done ? Math.max(p.loaded, p.total) : p.loaded;
      bytesTotal += p.total;
    }
    this.trigger("loading", [ratio, {
      loaded: this.loaded,
      total: this.total,
      bytesLoaded,
      bytesTotal,
    }]);
  }

  _markDone(name) {
    const p = this._progress[name];
    if (p) p.done = true;
  }

  _onLoaded(name, asset) {
    if (this._destroyed || this._progress[name]?.done) return;
    this.items[name] = asset;
    this.loaded++;
    this._markDone(name);
    const ratio = this.loaded / this.total;
    this.trigger("progress", [name, ratio]);
    this._emitLoading();
    if (this.loaded === this.total) {
      this.trigger("ready", []);
    }
  }

  _onError(name, err) {
    if (this._destroyed || this._progress[name]?.done) return;
    console.error(`[Resources] failed to load ${name}:`, err);
    this.errors.push(name);
    this.trigger("error", [name, err]);
    this.loaded++;
    this._markDone(name);
    this._emitLoading();
    if (this.loaded === this.total) {
      this.trigger("ready", []);
    }
  }

  destroy() {
    this._destroyed = true;
    this.draco?.dispose?.();
  }
}
