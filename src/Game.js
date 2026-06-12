/**
 * Game.js — Singleton-Hauptklasse für die 3D-Welt.
 *
 * Architektur:
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
import { BootReveal } from "./world/BootReveal.js";

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
    // Splash deckt den Canvas zu (Canvas gedimmt), Settings
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

    // Intro-Inszenierung: enge Kamera-Kreisfahrt um den Spawn-Kreis —
    // der Ladescreen ist eine Bühne, kein Formular. Bei reduced-motion
    // bleibt alles statisch.
    this._reducedMotion = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (!this._reducedMotion) {
      this.cameraRig.startIntroOrbit();
    }

    this.renderer = new Renderer(this);
    this.physics = new Physics(this);
    this.inputs = new Inputs();

    // Audio-System (WebAudio) — startet bei erster User-Interaction
    this.audio = new AudioManager(this);

    // Welt-Inhalt
    this.world = new World(this);

    // Boot-Bühne: 3D-Skeleton-Screen — die Welt existiert nur in einem
    // leuchtenden Kreis um den Spawn, außenrum Blueprint-Gitter. Der
    // Ring füllt sich mit dem Lade-Fortschritt, beim Klick expandiert
    // die Welt (BootReveal.reveal()). Tageslicht von Anfang an.
    if (!this._reducedMotion) {
      this.bootReveal = new BootReveal(this);
    }

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
      this.bootReveal?.setProgress?.(ratio);
    });

    res.on?.("ready", () => {
      this.splash.setProgress(1, this.splash._strings?.()?.ready || "Ready");
      this.bootReveal?.setProgress?.(1);
      this.splash.markReady();
    });

    // Splash hat eigene Start-Button-Logik — onStart wird gefeuert wenn User
    // klickt. Choreografie: Bike fällt aus 5m auf die Insel, die Kamera
    // schwingt aus dem Orbit dahinter ein, DANN kommt das Tour-Overlay.
    // Der Start ist der Payoff des Intros, kein Formularwechsel.
    this.splash.onStart = () => {
      if (typeof window !== "undefined") {
        window.__deferTourOverlay = false;
      }

      const showOverlay = () => {
        this.ui?.walkthrough?.showStartOverlayAfterSplash?.();
      };

      if (this._reducedMotion) {
        this.cameraRig.followMode = true;
        showOverlay();
      } else {
        // Welt aufdecken: Gras-Radius expandiert, Gebäude poppen rein,
        // Ring + Blueprint blenden aus.
        this.bootReveal?.reveal();

        // Bike-Drop: kurz anheben, Physik lässt es einfedern während die
        // Kamera anfliegt. Nur wenn der Body schon existiert.
        const body = this.world?.player?.body;
        if (body) {
          const t = body.translation();
          body.setTranslation({ x: t.x, y: t.y + 4, z: t.z }, true);
          body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        }
        this.cameraRig.endIntroOrbit(showOverlay);
      }

      // Sobald die Welt sichtbar ist, preloaden wir die Mini-Game-Chunks
      // im Hintergrund. So fühlt sich der erste Building-Click instant an,
      // statt erst den 30-100KB-Chunk laden zu müssen. Network ist eh idle
      // weil der User entweder Tour-Overlay liest oder fährt.
      this._preloadMiniGames();
    };
  }

  _preloadMiniGames() {
    if (this._miniGamesPreloaded) return;
    this._miniGamesPreloaded = true;
    // requestIdleCallback (oder setTimeout-Fallback) damit der eigentliche
    // First-Paint nicht durch den Preload blockiert wird.
    const schedule = window.requestIdleCallback
      || ((cb) => setTimeout(cb, 800));
    schedule(() => {
      const loaders = [
        () => import("./ui/miniGames/NumanOS.js"),
        () => import("./ui/miniGames/DesignaOS.js"),
        () => import("./ui/miniGames/HAWMoodle.js"),
        () => import("./ui/miniGames/THGQuiz.js"),
        () => import("./ui/miniGames/YekKasse.js"),
        () => import("./ui/miniGames/RouterPentest.js"),
      ];
      // Sequenziell mit kleinem Stagger statt parallel — wir wollen die
      // Browser-Verbindungen nicht für 6 Chunks gleichzeitig blocken.
      let i = 0;
      const next = () => {
        if (i >= loaders.length) return;
        loaders[i++]().catch(() => {}).then(() => setTimeout(next, 60));
      };
      next();
    });
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
    // Reihenfolge: Inputs (passive) → Physics → World → BootReveal →
    // Camera → Render → UI → Audio. BootReveal NACH world, damit es
    // Background/Sichtbarkeit nach dem DayCycle-Write übersteuern kann.
    if (this.physics?.update) this.physics.update();
    if (this.world?.update) this.world.update();
    if (this.bootReveal?.update) this.bootReveal.update();
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
    this.bootReveal?.destroy?.();
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
