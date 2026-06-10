/**
 * Resources — Asset-Loader für GLBs, Texturen, Audio.
 *
 * Nutzt GLTFLoader + DRACOLoader (die GLBs sind Draco-komprimiert).
 * Emit "ready" wenn alle gewünschten Assets geladen sind, plus
 * "progress" pro Asset.
 *
 * Usage:
 *   const res = new Resources({ island: "/maps/island.glb", bike: "/vanmoof-transformed.glb" })
 *   res.on("ready", () => { console.log(res.items.island) })
 *   res.on("progress", (name, ratio) => { ... })
 */

import { EventEmitter } from "./EventEmitter.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

export class Resources extends EventEmitter {
  constructor(sources = {}) {
    super();
    this.sources = sources;
    this.items = {};
    this.total = Object.keys(sources).length;
    this.loaded = 0;

    // DRACOLoader — Decoder lokal in /public/draco/gltf/ (matched Three.js
    // Version-zwischen Decoder + Loader). Wasm-basiert ist schneller als js.
    this.draco = new DRACOLoader();
    this.draco.setDecoderPath("/draco/gltf/");
    this.draco.setDecoderConfig({ type: "wasm" });

    this.gltf = new GLTFLoader();
    this.gltf.setDRACOLoader(this.draco);
    // Falls das GLB Meshopt-Compression nutzt
    this.gltf.setMeshoptDecoder(MeshoptDecoder);

    this._load();
  }

  _load() {
    if (this.total === 0) {
      this.trigger("ready", []);
      return;
    }

    for (const [name, url] of Object.entries(this.sources)) {
      const lower = url.toLowerCase();
      if (lower.endsWith(".glb") || lower.endsWith(".gltf")) {
        this.gltf.load(
          url,
          (gltf) => this._onLoaded(name, gltf),
          undefined,
          (err) => this._onError(name, err),
        );
      } else if (lower.endsWith(".mp3") || lower.endsWith(".ogg") || lower.endsWith(".wav")) {
        // Audio via Audio-Element (kein Three.js-Audio bis Phase Audio)
        const a = new Audio(url);
        a.preload = "auto";
        a.addEventListener("canplaythrough", () => this._onLoaded(name, a), { once: true });
        a.addEventListener("error", () => this._onError(name, new Error(`audio load failed: ${url}`)), { once: true });
      } else {
        console.warn(`[Resources] unknown asset type: ${url}`);
        this._onLoaded(name, null);
      }
    }
  }

  _onLoaded(name, asset) {
    this.items[name] = asset;
    this.loaded++;
    const ratio = this.loaded / this.total;
    this.trigger("progress", [name, ratio]);
    if (this.loaded === this.total) {
      this.trigger("ready", []);
    }
  }

  _onError(name, err) {
    console.error(`[Resources] failed to load ${name}:`, err);
    this.loaded++;
    if (this.loaded === this.total) {
      this.trigger("ready", []);
    }
  }

  destroy() {
    this.draco?.dispose?.();
  }
}
