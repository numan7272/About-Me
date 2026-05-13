/**
 * Wind — globaler Wind-Singleton à la Bruno's folio-2025.
 *
 * Eine zentrale Wind-Quelle. Konsumenten (Grass, Trees, Banner) lesen
 * `wind.direction`, `wind.speed`, `wind.strength` — und sehen alle dieselbe
 * Welle. Das gibt der Welt visuelle Kohärenz: wenn ein Sturm aufzieht,
 * bewegen sich alle Pflanzen synchron.
 *
 * Aktuell-Verhalten: konstante Default-Richtung mit langsamer Drift,
 * plus optionale Wind-Gust (kurze Stärke-Spikes).
 *
 * Public API:
 *   wind.direction  → THREE.Vector2 (normalisiert, X+Z)
 *   wind.speed      → float (wie schnell Wellen wandern)
 *   wind.strength   → float (wie stark Halme/Blätter wedeln)
 *   wind.time       → float (Sekunden seit Game-Start, akkumuliert)
 *
 * Konsumenten lesen jede Frame, kein Subscribe nötig.
 */

import * as THREE from "three";

const DEFAULT_DIR_X = 0.7;
const DEFAULT_DIR_Z = 0.3;
// Langsamere, weichere Defaults — User-Feedback: "smooth und langsam".
const DEFAULT_SPEED = 0.28;          // war 0.6 — Wellen wandern jetzt 2x langsamer
const DEFAULT_STRENGTH = 0.18;       // war 0.25 — weniger Auslenkung

// Langsame Drift in der Windrichtung (sin/cos) — gibt natürliche Wind-Shifts
const DIRECTION_DRIFT_AMP = 0.12;    // war 0.15
const DIRECTION_DRIFT_FREQ = 0.025;  // war 0.05 — 2x langsamere Richtungsänderung

// Gust-System: gelegentliche kurze Sturmböen — seltener, sanfter, länger
const GUST_INTERVAL_MIN = 14;       // war 8 — fast doppelte Pause zwischen Gusts
const GUST_INTERVAL_MAX = 32;       // war 20
const GUST_DURATION = 3.0;          // war 1.8 — Gust läuft länger aber sanfter
const GUST_STRENGTH_MULT = 1.55;    // war 2.0 — Peak weniger heftig

// Nacht-Modifikatoren — Wind wird sanfter, langsamer, seltener Gust
const NIGHT_SPEED_MULT = 0.35;      // 35% der Tag-Speed
const NIGHT_STRENGTH_MULT = 0.55;   // 55% der Tag-Strength
const NIGHT_GUST_PROB = 0.25;       // 25% der Tag-Gust-Häufigkeit (durch längere Pausen)

export class Wind {
  constructor(game) {
    this.game = game;

    // Public State (alle Konsumenten lesen das)
    this.direction = new THREE.Vector2(DEFAULT_DIR_X, DEFAULT_DIR_Z).normalize();
    this.speed = DEFAULT_SPEED;
    this.strength = DEFAULT_STRENGTH;
    this.time = 0;

    // Gust-State
    this._gustActive = false;
    this._gustTimer = this._randomGustInterval();
    this._gustElapsed = 0;

    // Base values (vor Gust-Multiplikator)
    this._baseStrength = DEFAULT_STRENGTH;
    this._baseSpeed = DEFAULT_SPEED;
    this._baseDirX = DEFAULT_DIR_X;
    this._baseDirZ = DEFAULT_DIR_Z;

    this._setupDebug();
  }

  _randomGustInterval() {
    const base = GUST_INTERVAL_MIN + Math.random() * (GUST_INTERVAL_MAX - GUST_INTERVAL_MIN);
    // Nachts: längere Pausen zwischen Gusts (durch 1/prob Multiplikator)
    const night = this._currentNightFactor();
    const nightStretch = 1 + night * (1 / NIGHT_GUST_PROB - 1);
    return base * nightStretch;
  }

  _currentNightFactor() {
    return this.game?.world?.dayCycle?.live?.nightFactor ?? 0;
  }

  update() {
    const dt = this.game?.time?.delta || 0.016;
    this.time += dt;

    // Langsame Richtungs-Drift
    const drift = Math.sin(this.time * DIRECTION_DRIFT_FREQ) * DIRECTION_DRIFT_AMP;
    const c = Math.cos(drift);
    const s = Math.sin(drift);
    const dx = this._baseDirX * c - this._baseDirZ * s;
    const dz = this._baseDirX * s + this._baseDirZ * c;
    this.direction.set(dx, dz).normalize();

    // Nacht-Modulation — wir interpolieren smooth zwischen Tag und Nacht.
    // nightFactor: 0 = voller Tag, 1 = volle Nacht.
    const night = this._currentNightFactor();
    const speedMult = 1 - night * (1 - NIGHT_SPEED_MULT);
    const strengthMult = 1 - night * (1 - NIGHT_STRENGTH_MULT);

    const effectiveSpeed = this._baseSpeed * speedMult;
    const effectiveStrength = this._baseStrength * strengthMult;

    // Gust-Logik — bestimmt Ziel-Strength und Ziel-Speed
    let targetStrength = effectiveStrength;
    let targetSpeed = effectiveSpeed;

    if (!this._gustActive) {
      this._gustTimer -= dt;
      if (this._gustTimer <= 0) {
        this._gustActive = true;
        this._gustElapsed = 0;
      }
    } else {
      this._gustElapsed += dt;
      const t = this._gustElapsed / GUST_DURATION;
      if (t >= 1) {
        this._gustActive = false;
        this._gustTimer = this._randomGustInterval();
      } else {
        // Glocke (sin-ease) — nachts auch der Gust-Peak schwächer
        const env = Math.sin(t * Math.PI);
        const nightGustDampen = 1 - night * 0.55;
        const mult = 1 + env * (GUST_STRENGTH_MULT - 1) * nightGustDampen;
        targetStrength = effectiveStrength * mult;
        targetSpeed = effectiveSpeed * (1 + env * 0.5 * nightGustDampen);
      }
    }

    // Exponential smoothing zur Vermeidung abrupter Übergänge.
    // Time-constant ~0.8s — Werte interpolieren weich statt zu zucken.
    const smoothK = 1 - Math.exp(-dt / 0.8);
    this.strength += (targetStrength - this.strength) * smoothK;
    this.speed += (targetSpeed - this.speed) * smoothK;

    this._updateDebugReadouts();
  }

  _setupDebug() {
    const debug = this.game?.debug;
    if (!debug?.active) return;
    const f = debug.addFolder({ title: "Wind", expanded: false });
    this._debugState = {
      baseStrength: this._baseStrength,
      baseSpeed: this._baseSpeed,
      dirX: this._baseDirX,
      dirZ: this._baseDirZ,
      // readouts
      currentStrength: this.strength,
      currentSpeed: this.speed,
      gust: false,
    };
    f.addBinding(this._debugState, "baseStrength", { min: 0, max: 1.5, step: 0.01, label: "strength" })
      .on("change", (ev) => { this._baseStrength = ev.value; });
    f.addBinding(this._debugState, "baseSpeed", { min: 0, max: 3, step: 0.05, label: "speed" })
      .on("change", (ev) => { this._baseSpeed = ev.value; });
    f.addBinding(this._debugState, "dirX", { min: -1, max: 1, step: 0.05 })
      .on("change", (ev) => { this._baseDirX = ev.value; });
    f.addBinding(this._debugState, "dirZ", { min: -1, max: 1, step: 0.05 })
      .on("change", (ev) => { this._baseDirZ = ev.value; });
    f.addBinding(this._debugState, "currentStrength", { readonly: true, label: "cur strength" });
    f.addBinding(this._debugState, "currentSpeed", { readonly: true, label: "cur speed" });
    f.addBinding(this._debugState, "gust", { readonly: true });
    f.addButton({ title: "Trigger Gust" }).on("click", () => {
      this._gustActive = true;
      this._gustElapsed = 0;
      this._gustTimer = this._randomGustInterval();
    });
    this._debugFolder = f;
  }

  _updateDebugReadouts() {
    if (!this._debugState) return;
    this._debugState.currentStrength = +this.strength.toFixed(3);
    this._debugState.currentSpeed = +this.speed.toFixed(3);
    this._debugState.gust = this._gustActive;
  }

  destroy() {
    // nichts zu cleanen — keine Listeners
  }
}
