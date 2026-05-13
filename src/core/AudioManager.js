/**
 * AudioManager — synthetisierte UI- + Engine-Sounds via WebAudio API.
 *
 * Keine MP3/WAV-Dateien nötig — alle Sounds werden via Oscillator/Noise
 * generiert. Volume aus Settings (window.__masterVolume).
 *
 * Public API:
 *   playClick()          — UI-Click (kurzer Beep)
 *   playDiscovery()      — Egg-Discovery-Jingle (3-Note Arpeggio)
 *   playInfoOpen()       — InfoCard öffnet
 *   playInfoClose()      — InfoCard schließt
 *   setEngineActive(on)  — Engine-Loop an/aus
 *   setEngineSpeed(0..1) — Engine-Pitch + Volume scale
 */

const AMBIENT_URL = "/audio/ambient.mp3";
const AMBIENT_VOLUME = 0.45;   // relativ zur masterGain

export class AudioManager {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.masterGain = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineActive = false;

    // Ambient (gloop)
    this.ambientEl = null;     // HTMLAudioElement
    this.ambientSrc = null;    // MediaElementSourceNode
    this.ambientGain = null;

    // WebAudio darf erst nach User-Interaction starten (Autoplay-Policy)
    this._onFirstInteract = () => this._init();
    window.addEventListener("pointerdown", this._onFirstInteract, { once: true });
    window.addEventListener("keydown", this._onFirstInteract, { once: true });
  }

  _init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this._volume();
      this.masterGain.connect(this.ctx.destination);
      this._initAmbient();
      console.log("[Audio] initialized");
    } catch (e) {
      console.warn("[Audio] init failed:", e);
    }
  }

  _initAmbient() {
    // HTMLAudioElement-Loop, durch WebAudio gerouted für Volume-Kontrolle
    try {
      const el = document.createElement("audio");
      el.src = AMBIENT_URL;
      el.loop = true;
      el.preload = "auto";
      el.crossOrigin = "anonymous";
      el.volume = 1.0;   // wir steuern Volume via gain node

      const src = this.ctx.createMediaElementSource(el);
      const g = this.ctx.createGain();
      g.gain.value = AMBIENT_VOLUME;
      src.connect(g).connect(this.masterGain);

      // Loop starten — fängt evtl. erst spät an wenn Browser noch lädt
      el.play().catch(err => {
        console.warn("[Audio] ambient autoplay blocked, will retry:", err?.message);
      });

      this.ambientEl = el;
      this.ambientSrc = src;
      this.ambientGain = g;
      console.log("[Audio] ambient loop started");
    } catch (e) {
      console.warn("[Audio] ambient init failed:", e);
    }
  }

  _volume() {
    return (typeof window !== "undefined" && window.__masterVolume != null)
      ? window.__masterVolume
      : 0.7;
  }

  /** Wird vom SettingsPanel gerufen wenn Volume-Slider sich ändert. */
  refreshVolume() {
    if (this.masterGain) {
      this.masterGain.gain.value = this._volume();
    }
  }

  // ─── UI-Sounds ─────────────────────────────────────────────────────────────

  playClick() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(880, t);
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.08 * this._volume(), t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    osc.connect(g).connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  playDiscovery() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    // 3-Note rising arpeggio (C5 → E5 → G5)
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const t = t0 + i * 0.08;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18 * this._volume(), t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(g).connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  }

  playInfoOpen() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(660, t + 0.15);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12 * this._volume(), t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(g).connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  playInfoClose() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, t);
    osc.frequency.exponentialRampToValueAtTime(330, t + 0.15);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.10 * this._volume(), t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(g).connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  // ─── Engine-Loop ───────────────────────────────────────────────────────────

  setEngineActive(on) {
    if (!this.ctx) return;
    if (on && !this.engineActive) {
      // Start engine
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      this.engineOsc.type = "sawtooth";
      this.engineOsc.frequency.value = 80;
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineGain).connect(this.masterGain);
      this.engineOsc.start();
      this.engineActive = true;
    } else if (!on && this.engineActive) {
      // Stop engine smooth
      const t = this.ctx.currentTime;
      this.engineGain.gain.cancelScheduledValues(t);
      this.engineGain.gain.setValueAtTime(this.engineGain.gain.value, t);
      this.engineGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      const osc = this.engineOsc;
      setTimeout(() => osc?.stop?.(), 200);
      this.engineActive = false;
      this.engineOsc = null;
      this.engineGain = null;
    }
  }

  /** speed: 0..1 — Engine-Pitch + Volume scaling */
  setEngineSpeed(speed) {
    if (!this.engineActive || !this.engineGain || !this.engineOsc) return;
    const s = Math.max(0, Math.min(1, speed));
    const t = this.ctx.currentTime;
    // Pitch 60Hz → 180Hz mit Speed
    this.engineOsc.frequency.linearRampToValueAtTime(60 + s * 120, t + 0.05);
    // Volume sehr leise (Engine soll subtil sein)
    const vol = (0.02 + s * 0.05) * this._volume();
    this.engineGain.gain.linearRampToValueAtTime(vol, t + 0.05);
  }

  update() {
    // Engine-Loop deaktiviert — User fand's nervig.
    // Falls Engine noch läuft (z.B. Hot-Reload während aktiv), stoppen.
    if (this.engineActive) this.setEngineActive(false);
  }

  destroy() {
    // K6-Fix: alle Listeners + WebAudio-Nodes sauber freigeben.
    window.removeEventListener("pointerdown", this._onFirstInteract);
    window.removeEventListener("keydown", this._onFirstInteract);
    if (this.engineOsc) {
      try { this.engineOsc.stop(); } catch (e) {}
      try { this.engineOsc.disconnect(); } catch (e) {}
      this.engineOsc = null;
    }
    if (this.engineGain) {
      try { this.engineGain.disconnect(); } catch (e) {}
      this.engineGain = null;
    }
    if (this.ambientSrc) {
      try { this.ambientSrc.disconnect(); } catch (e) {}
      this.ambientSrc = null;
    }
    if (this.ambientGain) {
      try { this.ambientGain.disconnect(); } catch (e) {}
      this.ambientGain = null;
    }
    if (this.ambientEl) {
      try { this.ambientEl.pause(); } catch (e) {}
      this.ambientEl.removeAttribute("src");
      this.ambientEl.load?.();
      this.ambientEl = null;
    }
    if (this.masterGain) {
      try { this.masterGain.disconnect(); } catch (e) {}
      this.masterGain = null;
    }
    if (this.ctx) {
      try { this.ctx.close(); } catch (e) {}
      this.ctx = null;
    }
  }
}
