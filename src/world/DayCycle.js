/**
 * DayCycle — Tag/Nacht-Zyklus.
 *
 * Portiert aus altem Next.js lib/dayCycle.js.
 *
 * Interpoliert smooth zwischen 4 Tageszeit-Presets (day → dusk → night → dawn).
 * Full Cycle dauert 4 Minuten. Cycle läuft selbständig basierend auf
 * performance.now(), kein Frame-Counting.
 *
 * Live-State (this.live):
 *   - skyColorA, skyColorB, sunColor, sunIntensity, sunPosition
 *   - ambientColor, ambientIntensity
 *   - hemiTop, hemiBottom, hemiIntensity
 *   - fogColor, fogNear, fogFar
 *   - bloomIntensity, bloomThreshold (für später)
 *
 * In update() werden die Three.js-Lights von World.js direkt aktualisiert,
 * plus StreetLamps.setLightLevel() und BikeHeadlight via nightFactor.
 */

import * as THREE from "three";

const CYCLE_DURATION_SEC = 240;   // 4 Minuten Full Day

// ─── Presets ─────────────────────────────────────────────────────────────────

const PRESETS = {
  day: {
    skyColorA: 0xa8d8ff, skyColorB: 0x4a8fd4,
    sunColor: 0xfff4d6, sunIntensity: 1.3,
    ambientColor: 0xddeeff, ambientIntensity: 0.35,
    hemiTop: 0xc8e8ff, hemiBottom: 0x3d6b44, hemiIntensity: 0.45,
    fogColor: 0xa8d8ff, fogNear: 60, fogFar: 200,
    sunPosition: [45, 65, 30],
    bloomIntensity: 0.35, bloomThreshold: 0.95,
  },
  dusk: {
    skyColorA: 0xffb380, skyColorB: 0x5b3a8c,
    sunColor: 0xffa867, sunIntensity: 0.9,
    ambientColor: 0xf8c5a0, ambientIntensity: 0.30,
    hemiTop: 0xe8b888, hemiBottom: 0x4a3024, hemiIntensity: 0.35,
    fogColor: 0xd89366, fogNear: 40, fogFar: 160,
    sunPosition: [60, 20, 10],
    bloomIntensity: 0.65, bloomThreshold: 0.78,
  },
  night: {
    skyColorA: 0x0a1428, skyColorB: 0x020410,
    sunColor: 0x6b80ff, sunIntensity: 0.25,
    ambientColor: 0x2a3a6a, ambientIntensity: 0.18,
    hemiTop: 0x3a4a8a, hemiBottom: 0x0a1424, hemiIntensity: 0.20,
    fogColor: 0x0a1428, fogNear: 25, fogFar: 110,
    sunPosition: [-30, 30, 20],
    bloomIntensity: 1.2, bloomThreshold: 0.55,
  },
  dawn: {
    skyColorA: 0xffc8a0, skyColorB: 0x8e6cb8,
    sunColor: 0xffcfa0, sunIntensity: 0.7,
    ambientColor: 0xe8c8b8, ambientIntensity: 0.28,
    hemiTop: 0xe8d4b8, hemiBottom: 0x4a3a40, hemiIntensity: 0.32,
    fogColor: 0xd8b8a8, fogNear: 45, fogFar: 170,
    sunPosition: [-50, 25, 15],
    bloomIntensity: 0.55, bloomThreshold: 0.82,
  },
};

// Keyframe-Folge (Progress 0..1)
const KEYFRAMES = [
  { stop: 0.00, preset: "day" },
  { stop: 0.18, preset: "day" },
  { stop: 0.28, preset: "dusk" },
  { stop: 0.40, preset: "night" },
  { stop: 0.60, preset: "night" },
  { stop: 0.72, preset: "dawn" },
  { stop: 0.82, preset: "day" },
  { stop: 1.00, preset: "day" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function smoothstep(x, e0, e1) {
  if (e1 <= e0) return x < e0 ? 0 : 1;
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

const _colorA = new THREE.Color();
const _colorB = new THREE.Color();

function lerpColor(target, hexA, hexB, t) {
  _colorA.set(hexA);
  _colorB.set(hexB);
  target.r = lerp(_colorA.r, _colorB.r, t);
  target.g = lerp(_colorA.g, _colorB.g, t);
  target.b = lerp(_colorA.b, _colorB.b, t);
  return target;
}

// ─── DayCycle-Klasse ─────────────────────────────────────────────────────────

export class DayCycle {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;

    // Cycle-State
    this._startTime = performance.now() / 1000;
    this._overrideProgress = null;
    this._paused = false;

    // ── Smooth-Transition-State (für Yek-Killer-Moment u.a.) ──
    // Wird via transitionTo() gesetzt. Während eines aktiven Transition wird
    // der effektive Progress geblendet zwischen "aktueller Wert" (auto oder
    // override) und "Ziel" über duration Sekunden.
    this._transition = null;   // { from, to, durationSec, startTime, releaseAfter }

    // Live-State — wird jeden Frame aktualisiert
    this.live = {
      progress: 0,
      phase: "day",
      skyColorA: new THREE.Color(PRESETS.day.skyColorA),
      skyColorB: new THREE.Color(PRESETS.day.skyColorB),
      sunColor: new THREE.Color(PRESETS.day.sunColor),
      sunIntensity: PRESETS.day.sunIntensity,
      ambientColor: new THREE.Color(PRESETS.day.ambientColor),
      ambientIntensity: PRESETS.day.ambientIntensity,
      hemiTop: new THREE.Color(PRESETS.day.hemiTop),
      hemiBottom: new THREE.Color(PRESETS.day.hemiBottom),
      hemiIntensity: PRESETS.day.hemiIntensity,
      fogColor: new THREE.Color(PRESETS.day.fogColor),
      fogNear: PRESETS.day.fogNear,
      fogFar: PRESETS.day.fogFar,
      sunPosition: [...PRESETS.day.sunPosition],
      bloomIntensity: PRESETS.day.bloomIntensity,
      bloomThreshold: PRESETS.day.bloomThreshold,
      // Praktischer abgeleiteter Wert: 0=Tag, 1=Nacht (für Lamp/Headlight)
      nightFactor: 0,
    };

    // Scene-Fog initialisieren
    this.scene.fog = new THREE.Fog(
      this.live.fogColor.getHex(),
      this.live.fogNear,
      this.live.fogFar,
    );

    // Tasten zum Cycle-Override (Debug/Demo):
    //  T = Toggle Pause
    //  N = Smooth-Transition zu Night (3s)
    //  M = Smooth-Transition zu Day  (3s)
    //  B = Resume automatic cycle
    // Smooth statt snap, damit der Übergang sich filmisch anfühlt.
    this._onKey = (e) => {
      // Nicht auf Inputs/Textareas reagieren (User tippt vielleicht im
      // SQLi-Lab oder einem anderen Mini-Game).
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.target?.isContentEditable) return;

      if (e.code === "KeyT") {
        this._paused = !this._paused;
        console.log(`[DayCycle] ${this._paused ? "paused" : "resumed"}`);
      } else if (e.code === "KeyN") {
        this.transitionTo?.(0.5, 3, false);
      } else if (e.code === "KeyM") {
        this.transitionTo?.(0, 3, true);
      } else if (e.code === "KeyB") {
        this._overrideProgress = null;
        console.log("[DayCycle] resumed automatic cycle");
      }
    };
    window.addEventListener("keydown", this._onKey);

    this._setupDebug();
  }

  _setupDebug() {
    const debug = this.game?.debug;
    if (!debug?.active) return;
    const f = debug.addFolder({ title: "DayCycle", expanded: false });

    // Override-Progress als Slider (null = Auto-Cycle)
    this._debugState = {
      override: false,
      progress: 0,
      paused: false,
      phase: "day",
      nightFactor: 0,
    };
    f.addBinding(this._debugState, "override", { label: "manual" })
      .on("change", (ev) => {
        this._overrideProgress = ev.value ? this._debugState.progress : null;
      });
    f.addBinding(this._debugState, "progress", { min: 0, max: 1, step: 0.001 })
      .on("change", (ev) => {
        if (this._debugState.override) this._overrideProgress = ev.value;
      });
    f.addBinding(this._debugState, "paused")
      .on("change", (ev) => { this._paused = ev.value; });
    f.addBinding(this._debugState, "phase", { readonly: true });
    f.addBinding(this._debugState, "nightFactor", { readonly: true });

    f.addButton({ title: "Snap Day" }).on("click", () => {
      this._debugState.override = true;
      this._debugState.progress = 0.0;
      this._overrideProgress = 0;
      f.refresh();
    });
    f.addButton({ title: "Snap Dusk" }).on("click", () => {
      this._debugState.override = true;
      this._debugState.progress = 0.28;
      this._overrideProgress = 0.28;
      f.refresh();
    });
    f.addButton({ title: "Snap Night" }).on("click", () => {
      this._debugState.override = true;
      this._debugState.progress = 0.5;
      this._overrideProgress = 0.5;
      f.refresh();
    });
    f.addButton({ title: "Snap Dawn" }).on("click", () => {
      this._debugState.override = true;
      this._debugState.progress = 0.75;
      this._overrideProgress = 0.75;
      f.refresh();
    });
    this._debugFolder = f;
  }

  /**
   * Wird von World.update() pro Frame aufgerufen.
   * Updates Live-State + apply auf alle externen Lights/Fog.
   */
  update() {
    if (this._paused) return;

    // Progress berechnen
    let progress;
    if (this._overrideProgress !== null) {
      progress = this._overrideProgress;
    } else {
      const elapsed = performance.now() / 1000 - this._startTime;
      progress = (elapsed / CYCLE_DURATION_SEC) % 1;
    }

    // Smooth-Transition aktiv? Dann zwischen current-progress und target lerpen
    if (this._transition) {
      const tr = this._transition;
      const elapsed = performance.now() / 1000 - tr.startTime;
      const t = Math.min(1, elapsed / tr.durationSec);
      // smoothstep für natürlich wirkenden Übergang
      const eased = t * t * (3 - 2 * t);
      // Smart-Lerp für Cyclic-Werte: wenn from=0.1 und to=0.28 → lerp(0.1, 0.28).
      // Aber wenn from=0.9 und to=0.05 → Cycle-Wrap (kürzester Weg).
      let from = tr.from;
      let to = tr.to;
      let delta = to - from;
      if (Math.abs(delta) > 0.5) {
        if (delta > 0) from += 1; else to += 1;
        delta = to - from;
      }
      progress = (from + delta * eased + 1) % 1;
      if (t >= 1) {
        // Transition beendet — entweder auf override stehen lassen oder freigeben
        if (tr.releaseAfter) {
          this._overrideProgress = null;
        } else {
          this._overrideProgress = tr.to;
        }
        this._transition = null;
      }
    }

    this.live.progress = progress;

    // Keyframe-Pair finden
    let kfA = KEYFRAMES[0];
    let kfB = KEYFRAMES[1];
    for (let i = 0; i < KEYFRAMES.length - 1; i++) {
      if (progress >= KEYFRAMES[i].stop && progress <= KEYFRAMES[i + 1].stop) {
        kfA = KEYFRAMES[i];
        kfB = KEYFRAMES[i + 1];
        break;
      }
    }

    const t = smoothstep(progress, kfA.stop, kfB.stop);
    const pA = PRESETS[kfA.preset];
    const pB = PRESETS[kfB.preset];

    this.live.phase = t < 0.5 ? kfA.preset : kfB.preset;

    // Lerp alles
    lerpColor(this.live.skyColorA, pA.skyColorA, pB.skyColorA, t);
    lerpColor(this.live.skyColorB, pA.skyColorB, pB.skyColorB, t);
    lerpColor(this.live.sunColor, pA.sunColor, pB.sunColor, t);
    this.live.sunIntensity = lerp(pA.sunIntensity, pB.sunIntensity, t);
    lerpColor(this.live.ambientColor, pA.ambientColor, pB.ambientColor, t);
    this.live.ambientIntensity = lerp(pA.ambientIntensity, pB.ambientIntensity, t);
    lerpColor(this.live.hemiTop, pA.hemiTop, pB.hemiTop, t);
    lerpColor(this.live.hemiBottom, pA.hemiBottom, pB.hemiBottom, t);
    this.live.hemiIntensity = lerp(pA.hemiIntensity, pB.hemiIntensity, t);
    lerpColor(this.live.fogColor, pA.fogColor, pB.fogColor, t);
    this.live.fogNear = lerp(pA.fogNear, pB.fogNear, t);
    this.live.fogFar = lerp(pA.fogFar, pB.fogFar, t);
    this.live.sunPosition[0] = lerp(pA.sunPosition[0], pB.sunPosition[0], t);
    this.live.sunPosition[1] = lerp(pA.sunPosition[1], pB.sunPosition[1], t);
    this.live.sunPosition[2] = lerp(pA.sunPosition[2], pB.sunPosition[2], t);
    this.live.bloomIntensity = lerp(pA.bloomIntensity, pB.bloomIntensity, t);
    this.live.bloomThreshold = lerp(pA.bloomThreshold, pB.bloomThreshold, t);

    // nightFactor: 0 wenn Tag (hohe sunIntensity), 1 wenn Nacht (niedrig)
    // smoothstep(x, 0.3, 0.85) = 0 wenn x<0.3, 1 wenn x>0.85.
    // Wir wollen umgekehrt: hohe sunIntensity → 0, niedrig → 1.
    this.live.nightFactor = 1 - THREE.MathUtils.smoothstep(
      this.live.sunIntensity, 0.3, 0.85,
    );

    // Anwenden auf Scene-Lights (Refs werden in World gesetzt)
    if (this.sun) {
      this.sun.color.copy(this.live.sunColor);
      this.sun.intensity = this.live.sunIntensity;
      this.sun.position.set(
        this.live.sunPosition[0],
        this.live.sunPosition[1],
        this.live.sunPosition[2],
      );
    }
    if (this.ambient) {
      this.ambient.color.copy(this.live.ambientColor);
      this.ambient.intensity = this.live.ambientIntensity;
    }
    if (this.hemi) {
      this.hemi.color.copy(this.live.hemiTop);
      this.hemi.groundColor.copy(this.live.hemiBottom);
      this.hemi.intensity = this.live.hemiIntensity;
    }

    // Flacher Background als Fallback bis das SkyDome-Material async ready
    // ist — der Gradient (skyColorA Horizont → skyColorB Zenit) läuft im
    // SkyDome-Shader, der die Kuppel über den Background zeichnet.
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(this.live.skyColorA);
    }

    // Fog
    if (this.scene.fog) {
      this.scene.fog.color.copy(this.live.fogColor);
      this.scene.fog.near = this.live.fogNear;
      this.scene.fog.far = this.live.fogFar;
    }

    // Externe Konsumenten — StreetLamps + BikeHeadlight
    // Nur callen wenn sich nightFactor relevant geändert hat (>0.5%).
    // Spart pro-Frame Material-Mutations + WebGPU-Pipeline-Refresh.
    const nf = this.live.nightFactor;
    if (this.game.world?.streetLamps?.setLightLevel) {
      if (this._lastNightFactor === undefined || Math.abs(nf - this._lastNightFactor) > 0.005) {
        this.game.world.streetLamps.setLightLevel(nf);
        this._lastNightFactor = nf;
      }
    }

    // Debug-Readouts updaten (nur wenn aktiv)
    if (this._debugState) {
      this._debugState.phase = this.live.phase;
      this._debugState.nightFactor = +this.live.nightFactor.toFixed(3);
      if (!this._debugState.override) {
        this._debugState.progress = +progress.toFixed(3);
      }
    }
  }

  /**
   * Smooth-Transition zu einem festen Progress-Wert über `durationSec`.
   * Nach Ablauf bleibt der DayCycle auf diesem Wert stehen (Override).
   * Mit `releaseAfter: true` läuft der Auto-Cycle nach dem Übergang weiter.
   *
   * Beispiel — Yek-Killer-Moment:
   *   dayCycle.transitionTo(0.28, 4);    // 4s ramp to dusk, freezes there
   *   dayCycle.transitionTo(0, 4, true); // 4s ramp back to day, then auto
   */
  transitionTo(targetProgress, durationSec = 4, releaseAfter = false) {
    const currentProgress = this.live.progress ?? 0;
    this._transition = {
      from: currentProgress,
      to: ((targetProgress % 1) + 1) % 1,
      durationSec: Math.max(0.1, durationSec),
      startTime: performance.now() / 1000,
      releaseAfter,
    };
  }

  /** Aktuellen Override-Lock loslassen → Auto-Cycle läuft weiter. */
  releaseOverride() {
    this._overrideProgress = null;
    this._transition = null;
  }

  /** Refs zu den Scene-Lights setzen (von World aus aufgerufen). */
  bindLights({ sun, ambient, hemi }) {
    this.sun = sun;
    this.ambient = ambient;
    this.hemi = hemi;
  }

  /** Externer Zugriff für andere Module (z.B. BikeHeadlight). */
  getNightFactor() {
    return this.live.nightFactor;
  }

  destroy() {
    window.removeEventListener("keydown", this._onKey);
  }
}
