/**
 * AudioManager — synthetisierte UI- + Engine-Sounds via WebAudio API,
 * plus prozedurale Zonen-Ambience (Wellen, Möwen, Wind, Grillen).
 *
 * Keine zusätzlichen Audio-Dateien nötig — alle Sounds werden via
 * Oscillator/Noise generiert. Einzige Ausnahme: der ambient.mp3-Musik-Loop
 * (vom User ausgewählt), der die Basis bleibt. Die Ambience liegt dezent
 * darunter und läuft komplett durch masterGain (window.__masterVolume).
 *
 * Public API:
 *   playClick()          — UI-Click (kurzer Beep)
 *   playDiscovery()      — Egg-Discovery-Jingle (3-Note Arpeggio)
 *   playInfoOpen()       — InfoCard öffnet
 *   playInfoClose()      — InfoCard schließt
 *   setEngineActive(on)  — Engine-Loop an/aus
 *   setEngineSpeed(0..1) — Engine-Pitch + Volume scale
 *
 * Zonen-Ambience (automatisch, via update()):
 *   Wellen  — gefiltertes Rauschen, hörbar Richtung Strand (r 24→40)
 *   Möwen   — synthetisierte Schreie, Strand (r>30) + tagsüber
 *   Wind    — Highpass-Rauschen mit Böen, inland (r<28 voll), × wind.strength
 *   Grillen — rhythmische Chirps, inland × nightFactor (zwei Stimmen)
 */

const AMBIENT_URL = "/audio/ambient.mp3";
const AMBIENT_VOLUME = 0.45;   // relativ zur masterGain

// Zonen-Radien (Insel: Zentrum (0,0), Küste ~38, Wasser ~48)
const WAVE_R_MIN = 24;         // Wellen unhörbar innerhalb
const WAVE_R_MAX = 40;         // Wellen voll ab hier
const INLAND_R_MIN = 28;       // Inland-Sounds voll innerhalb
const INLAND_R_MAX = 40;       // Inland-Sounds aus ab hier
const GULL_R_MIN = 30;         // Möwen nur in Strand-Zone
const GULL_NIGHT_MAX = 0.6;    // Möwen nur tagsüber

// Ziel-Lautstärken (relativ, alles läuft zusätzlich durch masterGain)
const WAVE_VOLUME = 0.10;
const GULL_VOLUME = 0.05;
const WIND_VOLUME = 0.04;
const CRICKET_VOLUME = 0.03;

const AMBIENCE_TICK = 0.2;     // Zonen-Update auf ~5Hz gedrosselt
const SMOOTH_TC = 0.35;        // setTargetAtTime-Zeitkonstante (keine Klicks)

/** smoothstep: 0 bei x<=e0, 1 bei x>=e1, weich dazwischen. */
function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

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

    // Prozedurale Zonen-Ambience (Wellen/Möwen/Wind/Grillen)
    this.ambienceBus = null;   // ein Bus → masterGain, vereinfacht destroy()
    this.waveNoise = null;
    this.waveLfo1 = null;
    this.waveLfo2 = null;
    this.waveZone = null;      // Zonen-Gain Wellen
    this.windNoise = null;
    this.windLfo = null;
    this.windLfoDepth = null;
    this.windZone = null;      // Zonen-Gain Wind
    this.gullBus = null;       // One-Shot-Möwen hängen hier dran
    this.crickets = null;      // [{osc, pulse, zone, ...}, ...]
    this._zoneAccum = 0;       // Zeit-Akkumulator für 5Hz-Tick
    this._nextGullAt = 0;      // ctx.currentTime der nächsten Möwe
    this._nextGustDriftAt = 0; // wann die Böen-LFO-Rate neu driftet

    // WebAudio darf erst nach User-Interaction starten (Autoplay-Policy).
    // pointerUP statt pointerdown: auf Mobile zählt Chrome erst das
    // Loslassen (pointerup/touchend/click) als User-Aktivierung — bei
    // pointerdown startet der Context suspendiert und play() wird geblockt.
    this._onFirstInteract = () => this._init();
    window.addEventListener("pointerup", this._onFirstInteract, { once: true });
    window.addEventListener("keydown", this._onFirstInteract, { once: true });
  }

  _init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this._volume();
      this.masterGain.connect(this.ctx.destination);
      this._initAmbient();
      this._initAmbience();
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

      // Loop starten — fängt evtl. erst spät an wenn Browser noch lädt.
      // Wird play() trotzdem geblockt (z.B. synthetisches Event), bei der
      // nächsten echten Geste erneut versuchen.
      const tryPlay = () => el.play().catch(() => {
        window.addEventListener("pointerup", tryPlay, { once: true });
      });
      tryPlay();

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

  // ─── Prozedurale Zonen-Ambience ───────────────────────────────────────────

  /**
   * Baut den kompletten Ambience-Graph. Startet (wie ambient.mp3) erst nach
   * der ersten User-Interaction via _init(). Alle Zonen-Gains beginnen bei 0
   * und werden im 5Hz-Tick via setTargetAtTime weich nachgeführt.
   */
  _initAmbience() {
    try {
      const ctx = this.ctx;
      this.ambienceBus = ctx.createGain();
      this.ambienceBus.gain.value = 1;
      this.ambienceBus.connect(this.masterGain);

      // Ein geteilter ~2s Noise-Buffer für Wellen + Wind
      const noiseBuf = this._createNoiseBuffer(2);

      // — Wellen: Noise → Bandpass 500Hz → LFO-modulierter Gain → Zonen-Gain —
      this.waveNoise = ctx.createBufferSource();
      this.waveNoise.buffer = noiseBuf;
      this.waveNoise.loop = true;
      const waveBp = ctx.createBiquadFilter();
      waveBp.type = "bandpass";
      waveBp.frequency.value = 500;
      waveBp.Q.value = 0.8;
      const waveMod = ctx.createGain();
      waveMod.gain.value = 0.55;       // Basis, LFOs addieren ±
      // LFO 1 (~0.08Hz) = Haupt-Wellenrhythmus, LFO 2 (~0.13Hz) moduliert
      // dagegen → unregelmäßiges An- und Abschwellen statt Metronom.
      this.waveLfo1 = ctx.createOscillator();
      this.waveLfo1.type = "sine";
      this.waveLfo1.frequency.value = 0.08;
      const lfo1Depth = ctx.createGain();
      lfo1Depth.gain.value = 0.30;
      this.waveLfo1.connect(lfo1Depth).connect(waveMod.gain);
      this.waveLfo2 = ctx.createOscillator();
      this.waveLfo2.type = "sine";
      this.waveLfo2.frequency.value = 0.13;
      const lfo2Depth = ctx.createGain();
      lfo2Depth.gain.value = 0.18;
      this.waveLfo2.connect(lfo2Depth).connect(waveMod.gain);
      this.waveZone = ctx.createGain();
      this.waveZone.gain.value = 0;
      this.waveNoise.connect(waveBp).connect(waveMod)
        .connect(this.waveZone).connect(this.ambienceBus);
      this.waveNoise.start();
      this.waveLfo1.start();
      this.waveLfo2.start();

      // — Wind/Gras: Noise → Highpass 2.5kHz → Böen-Gain → Zonen-Gain —
      this.windNoise = ctx.createBufferSource();
      this.windNoise.buffer = noiseBuf;
      this.windNoise.loop = true;
      this.windNoise.playbackRate.value = 1.07;  // dekorreliert vom Wellen-Loop
      const windHp = ctx.createBiquadFilter();
      windHp.type = "highpass";
      windHp.frequency.value = 2500;
      const windMod = ctx.createGain();
      windMod.gain.value = 0.65;       // Basis, Böen-LFO addiert ±
      this.windLfo = ctx.createOscillator();
      this.windLfo.type = "sine";
      this.windLfo.frequency.value = 0.11;
      this.windLfoDepth = ctx.createGain();
      this.windLfoDepth.gain.value = 0.35;
      this.windLfo.connect(this.windLfoDepth).connect(windMod.gain);
      this.windZone = ctx.createGain();
      this.windZone.gain.value = 0;
      this.windNoise.connect(windHp).connect(windMod)
        .connect(this.windZone).connect(this.ambienceBus);
      this.windNoise.start();
      this.windLfo.start();

      // — Möwen: One-Shots hängen an eigenem Bus —
      this.gullBus = ctx.createGain();
      this.gullBus.gain.value = 1;
      this.gullBus.connect(this.ambienceBus);
      this._nextGullAt = ctx.currentTime + 4 + Math.random() * 8;
      this._nextGustDriftAt = ctx.currentTime + 5;

      // — Grillen: zwei Stimmen, verschiedener Pan, Pitch + Tempo —
      this.crickets = [
        this._createCricket(4250, -0.55, 0.40, 0.85),
        this._createCricket(4420, 0.6, 0.6, 1.2),
      ];

      console.log("[Audio] procedural ambience started");
    } catch (e) {
      console.warn("[Audio] ambience init failed:", e);
      this.ambienceBus = null;
    }
  }

  /** Geteilter Mono-Noise-Buffer (weißes Rauschen, `seconds` lang). */
  _createNoiseBuffer(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Eine Grillen-Stimme: Dauer-Oscillator, rhythmisch via pulse-Gain gegated. */
  _createCricket(freq, pan, minPause, maxPause) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const pulse = ctx.createGain();
    pulse.gain.value = 0;            // gated — nur während Chirp-Bursts > 0
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    const zone = ctx.createGain();
    zone.gain.value = 0;             // nightFactor × inland × CRICKET_VOLUME
    osc.connect(pulse).connect(panner).connect(zone).connect(this.ambienceBus);
    osc.start();
    return {
      osc, pulse, zone, baseFreq: freq, minPause, maxPause,
      nextChirpAt: ctx.currentTime + 1 + Math.random() * 1.5,
    };
  }

  /**
   * Synthetisierter Möwen-Schrei: 2-4 absteigende Sweeps. Pro Sweep:
   * schneller Pitch-Anstieg (~45ms), kurzes Plateau mit 25Hz-Vibrato,
   * dann Abfall Richtung ~700Hz — Sawtooth durch Bandpass 1.5kHz für den
   * kehligen Charakter. Spätere Sweeps etwas tiefer + leiser (natürlich).
   */
  _playGullCry(t0, pan, loudness) {
    const ctx = this.ctx;
    const sweeps = 2 + Math.floor(Math.random() * 3);   // 2-4
    const pitchMul = 0.92 + Math.random() * 0.16;       // jede Möwe klingt anders

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1500;
    bp.Q.value = 1.2;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    bp.connect(panner).connect(this.gullBus);

    // Ein Vibrato-LFO für den ganzen Schrei, auf alle Sweep-Frequenzen
    const vib = ctx.createOscillator();
    vib.type = "sine";
    vib.frequency.value = 25;
    const vibDepth = ctx.createGain();
    vibDepth.gain.value = 45;        // ±45Hz aufs Plateau
    vib.connect(vibDepth);

    let t = t0;
    for (let i = 0; i < sweeps; i++) {
      const peak = (1200 - i * 60) * pitchMul;
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      const g = ctx.createGain();
      osc.connect(g).connect(bp);
      vibDepth.connect(osc.frequency);
      // Pitch-Hüllkurve: rauf → Plateau (Vibrato) → runter. Der schnelle
      // Anstieg + Plateau verhindern den Sirenen-Effekt eines reinen Sweeps.
      osc.frequency.setValueAtTime(820 * pitchMul, t);
      osc.frequency.exponentialRampToValueAtTime(peak, t + 0.045);
      osc.frequency.setValueAtTime(peak, t + 0.13);
      osc.frequency.exponentialRampToValueAtTime(700 * pitchMul, t + 0.32);
      // Amp: kurze Attack, leicht abfallendes Plateau, Ausklang
      const a = loudness * (1 - i * 0.18);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(a, t + 0.015);
      g.gain.setValueAtTime(a * 0.85, t + 0.16);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      osc.start(t);
      osc.stop(t + 0.36);
      t += 0.35 + 0.05 + Math.random() * 0.1;   // ~350ms Sweep + kleine Pause
    }
    vib.start(t0);
    vib.stop(t);
  }

  /** ~5Hz-Tick: Zonen-Faktoren berechnen + Gains nachführen + Events planen. */
  _updateAmbience() {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const pos = this.game.world?.player?.body?.translation?.();
    if (!pos) return;   // Welt noch nicht bereit — letzte Gains behalten
    const r = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
    const nightFactor = this.game.world?.dayCycle?.live?.nightFactor ?? 0;
    const windStrength = this.game.world?.wind?.strength ?? 0.25;

    // Zonen-Faktoren: Strand außen, Inland innen (überlappen weich)
    const beach = smoothstep(WAVE_R_MIN, WAVE_R_MAX, r);
    const inland = 1 - smoothstep(INLAND_R_MIN, INLAND_R_MAX, r);

    // Gras-Rascheln etwas stärker in Baumnähe (Blätterwerk)
    let treeBoost = 0;
    const trees = this.game.world?.island?.worldColliders?.trees;
    if (trees && trees.length) {
      let best = Infinity;
      const n = Math.min(trees.length, 200);
      for (let i = 0; i < n; i++) {
        const dx = trees[i].x - pos.x;
        const dz = trees[i].z - pos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < best) best = d2;
      }
      treeBoost = Math.max(0, 1 - Math.sqrt(best) / 8) * 0.5;
    }

    // Gains weich nachführen (setTargetAtTime → keine Klicks)
    this.waveZone.gain.setTargetAtTime(beach * WAVE_VOLUME, now, SMOOTH_TC);
    this.windZone.gain.setTargetAtTime(
      windStrength * inland * WIND_VOLUME * (1 + treeBoost), now, SMOOTH_TC);
    for (let i = 0; i < this.crickets.length; i++) {
      this.crickets[i].zone.gain.setTargetAtTime(
        nightFactor * inland * CRICKET_VOLUME, now, SMOOTH_TC);
    }

    // Böen: LFO-Rate driftet alle paar Sekunden zufällig
    if (now >= this._nextGustDriftAt) {
      this.windLfo.frequency.setTargetAtTime(0.05 + Math.random() * 0.15, now, 2);
      this.windLfoDepth.gain.setTargetAtTime(0.2 + Math.random() * 0.3, now, 2);
      this._nextGustDriftAt = now + 4 + Math.random() * 6;
    }

    // Möwen: zufällig alle 7-20s, nur Strand-Zone + tagsüber
    if (now >= this._nextGullAt) {
      if (r > GULL_R_MIN && nightFactor < GULL_NIGHT_MAX) {
        const pan = (Math.random() * 2 - 1) * 0.7;
        this._playGullCry(now + 0.05, pan, GULL_VOLUME);
        if (Math.random() < 0.35) {
          // zweite Möwe antwortet von der anderen Seite, etwas leiser
          this._playGullCry(now + 0.85, -pan * (0.6 + Math.random() * 0.4),
            GULL_VOLUME * 0.8);
        }
        this._nextGullAt = now + 7 + Math.random() * 13;
      } else {
        this._nextGullAt = now + 3;   // außerhalb der Zone: später neu prüfen
      }
    }

    // Grillen-Chirps planen (Burst aus 3-4 Pulsen à 30ms)
    for (let i = 0; i < this.crickets.length; i++) {
      const c = this.crickets[i];
      if (now < c.nextChirpAt) continue;
      const pulses = 3 + (Math.random() < 0.4 ? 1 : 0);
      c.osc.frequency.setValueAtTime(
        c.baseFreq * (0.99 + Math.random() * 0.02), now);
      let t = now + 0.02;
      for (let p = 0; p < pulses; p++) {
        c.pulse.gain.setValueAtTime(0, t);
        c.pulse.gain.linearRampToValueAtTime(1, t + 0.008);
        c.pulse.gain.setValueAtTime(1, t + 0.022);
        c.pulse.gain.linearRampToValueAtTime(0, t + 0.03);
        t += 0.03 + 0.03 + Math.random() * 0.012;
      }
      c.nextChirpAt = t + c.minPause + Math.random() * (c.maxPause - c.minPause);
    }
  }

  _destroyAmbience() {
    const stop = (node) => {
      if (!node) return;
      try { node.stop(); } catch (e) {}
      try { node.disconnect(); } catch (e) {}
    };
    stop(this.waveNoise); this.waveNoise = null;
    stop(this.waveLfo1); this.waveLfo1 = null;
    stop(this.waveLfo2); this.waveLfo2 = null;
    stop(this.windNoise); this.windNoise = null;
    stop(this.windLfo); this.windLfo = null;
    this.windLfoDepth = null;
    if (this.crickets) {
      for (const c of this.crickets) stop(c.osc);
      this.crickets = null;
    }
    if (this.gullBus) {
      try { this.gullBus.disconnect(); } catch (e) {}
      this.gullBus = null;
    }
    if (this.ambienceBus) {
      // trennt auch alle Filter/Mod-Gains + evtl. noch klingende Möwen
      try { this.ambienceBus.disconnect(); } catch (e) {}
      this.ambienceBus = null;
    }
    this.waveZone = null;
    this.windZone = null;
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

    // Zonen-Ambience: auf ~5Hz gedrosselt, keine Allokationen pro Frame.
    if (!this.ctx || !this.ambienceBus) return;
    this._zoneAccum += this.game.time?.delta ?? 1 / 60;
    if (this._zoneAccum < AMBIENCE_TICK) return;
    this._zoneAccum = 0;
    this._updateAmbience();
  }

  destroy() {
    // K6-Fix: alle Listeners + WebAudio-Nodes sauber freigeben.
    window.removeEventListener("pointerup", this._onFirstInteract);
    window.removeEventListener("keydown", this._onFirstInteract);
    this._destroyAmbience();
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
