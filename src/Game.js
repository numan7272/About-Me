/**
 * Game.js — Singleton-Hauptklasse für die 3D-Welt.
 *
 * Folgt Brunos folio-2025-Architektur:
 *   - Game.getInstance() ist überall im Code verfügbar
 *   - Konstruktor instanziiert Core-Module (Time, Sizes, Renderer, ...)
 *   - update() läuft jedes Frame via requestAnimationFrame
 *
 * Sub-Module bekommen `this` (= Game-Instance) und können sich
 * gegenseitig erreichen via game.time, game.renderer, etc.
 */

import * as THREE from "three";
import { Time } from "./core/Time.js";
import { Sizes } from "./core/Sizes.js";
import { Renderer } from "./core/Renderer.js";
import { CameraRig } from "./core/CameraRig.js";
import { Physics } from "./core/Physics.js";
import { Inputs } from "./core/Inputs.js";
import { World } from "./world/World.js";
import { Ui } from "./ui/Ui.js";
import { AudioManager } from "./core/AudioManager.js";
import { Debug } from "./core/Debug.js";
import { LoadingSplash } from "./ui/LoadingSplash.js";

export class Game {
  // Singleton-Helper
  static instance = null;
  static getInstance() {
    return Game.instance;
  }

  constructor(canvas) {
    if (Game.instance) {
      console.warn("[Game] already initialized — returning existing instance");
      return Game.instance;
    }
    Game.instance = this;

    // Dev-Helfer: in der Browser-Konsole via __game zugreifbar.
    //   __game.world.player.body.translation()  → aktuelle Bike-Position
    //   __game.world.player.spawnPos             → Spawn-Punkt
    if (typeof window !== "undefined") {
      window.__game = this;
    }

    // Canvas
    this.canvas = canvas;

    // ── Loading-Splash zuerst ──
    // Bruno-Style: Splash deckt den Canvas zu (Canvas blurrred), Settings
    // (Lang/Volume/Graphics/Renderer) werden vor Game-Start eingestellt.
    // Tour-Overlay kommt erst NACH Splash-Start. Wenn Splash null bleibt,
    // läuft alles wie bisher.
    this.splash = new LoadingSplash(this.canvas);
    // window.__deferTourOverlay verhindert dass der WalkthroughController
    // sein Overlay direkt zeigt — wir öffnen es erst nach Splash-Start.
    if (typeof window !== "undefined") {
      window.__deferTourOverlay = true;
    }

    // Debug muss als ALLERERSTES kommen — andere Module greifen drauf zu
    // (this.debug.addFolder(...)). Wenn ?debug fehlt, ist alles ein No-Op.
    this.debug = new Debug();

    // Core-Module
    this.time = new Time();
    this.sizes = new Sizes();
    this.scene = new THREE.Scene();
    this.cameraRig = new CameraRig(this);
    this.renderer = new Renderer(this);
    this.physics = new Physics(this);
    this.inputs = new Inputs();

    // Audio-System (WebAudio) — startet bei erster User-Interaction
    this.audio = new AudioManager(this);

    // Welt-Inhalt
    this.world = new World(this);

    // UI-Overlays (HUD, MiniMap, Settings, InfoCard, DiscoveryHud)
    this.ui = new Ui(this);

    // Splash mit Resources-Progress verkabeln
    this._wireSplashToResources();

    // Debug-Bindings die Game-übergreifend sind (FPS, Time, Renderer-Mode)
    this._setupGlobalDebug();

    // Resize-Handler
    this.sizes.on("resize", () => this.onResize());

    // Tick-Loop
    this.time.on("tick", () => this.update());

    // Initial-Render damit auch ohne Tick was zu sehen ist
    this.onResize();

    // Wenn WebGPU asynchron initialisiert wird, nochmal resize anstoßen
    // sobald Instance ready ist
    if (this.renderer.ready?.then) {
      this.renderer.ready.then(() => {
        this.onResize();
        // SettingsPanel-Hint updaten falls vorhanden
        if (this.ui?.settings?._rendererHint) {
          this.ui.settings._rendererHint.textContent =
            "Active: " + this.renderer.mode;
        }
      });
    }
  }

  onResize() {
    this.cameraRig.onResize(this.sizes.width, this.sizes.height);
    this.renderer.onResize(this.sizes.width, this.sizes.height);
  }

  _wireSplashToResources() {
    if (!this.splash) return;
    const res = this.world?.resources;
    if (!res) return;

    // Übersetzung der Resource-Namen ins Deutsche damit der Loading-Text
    // nicht "Lädt island" sondern "Lädt Insel" zeigt.
    const RES_NAME_DE = {
      island: "Insel",
      bike:   "Fahrrad",
      ocean:  "Ozean",
      grass:  "Gras",
      sky:    "Himmel",
      world:  "Welt",
    };

    res.on?.("progress", (name, ratio) => {
      const lang = (typeof window !== "undefined" && window.__lang) || "de";
      const displayName = lang === "en" ? name : (RES_NAME_DE[name] || name);
      const msg = lang === "en" ? `Loading ${displayName}` : `Lädt ${displayName}`;
      this.splash.setProgress(ratio, msg);
    });

    res.on?.("ready", () => {
      this.splash.setProgress(1, this.splash._strings?.()?.ready || "Ready");
      this.splash.markReady();
    });

    // Splash hat eigene Start-Button-Logik — onStart wird gefeuert wenn User
    // klickt. Wir öffnen IMMER das Tour-Overlay (auch wenn der User schon
    // mal Tour gesehen hat — er kommt ja gerade frisch vom Splash und will
    // entscheiden Tour vs Frei-Fahren).
    this.splash.onStart = () => {
      if (typeof window !== "undefined") {
        window.__deferTourOverlay = false;
      }
      this.ui?.walkthrough?.showStartOverlayAfterSplash?.();
    };
  }

  _setupGlobalDebug() {
    if (!this.debug?.active) return;
    // Stats-Folder: FPS + Frame-Time + Renderer-Mode
    const f = this.debug.addFolder({ title: "Stats", expanded: true });
    this._debugStats = { fps: 0, dtMs: 0, renderer: this.renderer?.mode || "loading" };
    f.addBinding(this._debugStats, "fps", { readonly: true });
    f.addBinding(this._debugStats, "dtMs", { readonly: true, label: "frame ms" });
    f.addBinding(this._debugStats, "renderer", { readonly: true });

    // Renderer-Mode wird async resolved — Hint updaten
    if (this.renderer?.ready?.then) {
      this.renderer.ready.then(() => {
        this._debugStats.renderer = this.renderer.mode || "unknown";
      }).catch(() => {});
    }

    // FPS-EMA-Counter
    this._fpsAccum = 0;
    this._fpsFrames = 0;
    this._fpsLast = performance.now();

    // Tweakpane refresh — Readonly-Bindings updaten ihre Anzeige nur
    // bei pane.refresh(). Wir machen das 4x/Sekunde, kein per-Frame-Spam.
    this._debugRefreshAccum = 0;
  }

  _updateDebugStats() {
    if (!this.debug?.active || !this._debugStats) return;
    const now = performance.now();
    const dt = now - this._fpsLast;
    this._fpsLast = now;
    this._fpsAccum += dt;
    this._fpsFrames++;
    if (this._fpsAccum >= 250) {
      const avgMs = this._fpsAccum / this._fpsFrames;
      this._debugStats.fps = Math.round(1000 / avgMs);
      this._debugStats.dtMs = +avgMs.toFixed(2);
      this._fpsAccum = 0;
      this._fpsFrames = 0;
    }
    // Pane-Refresh ~4x/s — sonst zeigen Readouts (FPS, nightFactor, wind) stale Werte
    this._debugRefreshAccum += dt;
    if (this._debugRefreshAccum >= 250) {
      this._debugRefreshAccum = 0;
      try { this.debug.pane.refresh(); } catch (e) {}
    }
  }

  update() {
    // Reihenfolge: Inputs (passive) → Physics → World → Camera → Render → UI → Audio
    if (this.physics?.update) this.physics.update();
    if (this.world?.update) this.world.update();
    if (this.cameraRig?.update) this.cameraRig.update();
    this.renderer.render(this.scene, this.cameraRig.camera);
    if (this.ui?.update) this.ui.update();
    if (this.audio?.update) this.audio.update();
    this._updateDebugStats();
  }

  destroy() {
    this.time?.destroy?.();
    this.sizes?.destroy?.();
    this.inputs?.destroy?.();
    this.world?.destroy?.();
    this.physics?.destroy?.();
    this.renderer?.destroy?.();
    this.ui?.destroy?.();
    this.audio?.destroy?.();
    this.splash?.destroy?.();
    this.debug?.destroy?.();
    Game.instance = null;
  }
}
