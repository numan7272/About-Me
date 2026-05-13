/**
 * LoadingSplash — Bruno-Simon-Style Start/Lade-Screen.
 *
 * Zwei Phasen:
 *
 *   1) LOADING — Progress-Bar während Resources geladen werden.
 *      Während dieser Phase läuft die 3D-Szene schon im Hintergrund mit
 *      CSS-blur(12px) — der User sieht die Insel verschwommen durchschimmern.
 *
 *   2) READY — sobald `resources.ready`-Event feuert:
 *      Settings (Sprache, Volume, Grafik, Renderer) werden eingeblendet,
 *      großer "Start"-Button erscheint, Progress-Bar wird ausgeblendet.
 *
 * Klick auf Start:
 *   - Splash fadet aus + Canvas-Blur runter
 *   - LoadingSplash.destroy() entfernt sich aus dem DOM
 *   - Das Walkthrough-Start-Overlay erscheint danach
 *
 * Public API:
 *   splash.setProgress(0..1, label?)
 *   splash.markReady()
 *   splash.onStart = () => {...}
 *   splash.destroy()
 *
 * State wird über window.__masterVolume / window.__lang / localStorage
 * gespiegelt — gleiches Verhalten wie SettingsPanel.
 */

const STORAGE_KEY = "numan-portfolio-settings-v1";

const DEFAULTS = {
  lang: "de",
  volume: 0.7,
  graphics: "high",
  renderer: "webgl",
};

const STRINGS = {
  de: {
    loading: "Welt wird geladen…",
    ready: "Bereit",
    sectionLang: "Sprache",
    sectionVolume: "Lautstärke",
    sectionGraphics: "Grafik",
    sectionRenderer: "Renderer",
    graphicsLow: "Niedrig",
    graphicsHigh: "Hoch",
    start: "Starten",
    welcome: "Willkommen",
    intro: "Bevor's losgeht — stell dir die Welt ein wie du sie willst.",
  },
  en: {
    loading: "Loading world…",
    ready: "Ready",
    sectionLang: "Language",
    sectionVolume: "Volume",
    sectionGraphics: "Graphics",
    sectionRenderer: "Renderer",
    graphicsLow: "Low",
    graphicsHigh: "High",
    start: "Start",
    welcome: "Welcome",
    intro: "Before we begin — set up the world the way you like it.",
  },
};

export class LoadingSplash {
  constructor(canvas) {
    this.canvas = canvas;
    this.onStart = null;
    this.ready = false;
    this.destroyed = false;

    this.settings = this._loadSettings();

    // Window-Globals früh setzen — andere Module können sie lesen sobald
    // Game.js seine Welt aufbaut.
    if (typeof window !== "undefined") {
      window.__masterVolume = this.settings.volume;
      window.__lang = this.settings.lang;
    }

    this._applyCanvasBlur(true);
    this._buildUI();
    this._render();
  }

  _strings() {
    return STRINGS[this.settings.lang === "en" ? "en" : "de"];
  }

  // ─── Persistence (gleich wie SettingsPanel) ────────────────────────────

  _loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return { ...DEFAULTS, ...JSON.parse(raw) };
      }
    } catch (e) {}
    return { ...DEFAULTS };
  }

  _saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (e) {}
  }

  // ─── Canvas-Blur ───────────────────────────────────────────────────────

  _applyCanvasBlur(on) {
    if (!this.canvas) return;
    this.canvas.style.transition = "filter 0.6s ease, transform 0.6s ease";
    if (on) {
      this.canvas.style.filter = "blur(14px) brightness(0.55) saturate(1.1)";
      this.canvas.style.transform = "scale(1.04)";   // verhindert sichtbare Blur-Ränder
    } else {
      this.canvas.style.filter = "blur(0) brightness(1) saturate(1)";
      this.canvas.style.transform = "scale(1)";
    }
  }

  // ─── UI-Aufbau ─────────────────────────────────────────────────────────

  _buildUI() {
    // Dunkler Tint-Overlay über dem geblurrten Canvas
    this.root = document.createElement("div");
    Object.assign(this.root.style, {
      position: "fixed",
      inset: "0",
      zIndex: "30",
      background: "radial-gradient(ellipse at center, rgba(8,14,26,0.55) 0%, rgba(4,8,16,0.78) 80%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: "system-ui, -apple-system, sans-serif",
      color: "rgba(240, 245, 250, 0.94)",
      transition: "opacity 0.55s",
      opacity: "0",
    });

    this.card = document.createElement("div");
    Object.assign(this.card.style, {
      width: "min(480px, 100%)",
      maxHeight: "calc(100vh - 48px)",
      overflowY: "auto",
      WebkitOverflowScrolling: "touch",
      padding: window.innerWidth < 500 ? "26px 22px 22px 22px" : "36px 36px 30px 36px",
      borderRadius: "20px",
      border: "1px solid rgba(255, 255, 255, 0.14)",
      background: "rgba(10, 18, 32, 0.78)",
      backdropFilter: "blur(18px)",
      WebkitBackdropFilter: "blur(18px)",
      boxShadow: "0 24px 60px rgba(0, 0, 0, 0.55)",
      textAlign: "center",
      pointerEvents: "auto",
    });
    this.root.appendChild(this.card);

    document.body.appendChild(this.root);

    requestAnimationFrame(() => {
      this.root.style.opacity = "1";
    });
  }

  // ─── Render basierend auf Phase ────────────────────────────────────────

  _render() {
    const s = this._strings();
    this.card.innerHTML = "";

    // Eyebrow
    const eyebrow = document.createElement("div");
    eyebrow.textContent = s.welcome;
    Object.assign(eyebrow.style, {
      fontSize: "11px",
      letterSpacing: "0.24em",
      textTransform: "uppercase",
      color: "rgba(126, 200, 255, 0.85)",
      marginBottom: "10px",
    });
    this.card.appendChild(eyebrow);

    // Name
    const name = document.createElement("div");
    name.textContent = "Numan Yesil";
    Object.assign(name.style, {
      fontSize: "32px",
      fontWeight: "700",
      lineHeight: "1.1",
      marginBottom: "6px",
    });
    this.card.appendChild(name);

    // Subtitle — generischer Studien-Hinweis, kein Fokus auf einen Bereich
    const sub = document.createElement("div");
    sub.textContent = this.settings.lang === "en"
      ? "Business Informatics · Kiel"
      : "Wirtschaftsinformatik · Kiel";
    Object.assign(sub.style, {
      fontSize: "13px",
      color: "rgba(170, 190, 210, 0.7)",
      marginBottom: "24px",
    });
    this.card.appendChild(sub);

    if (!this.ready) {
      this._renderLoading();
    } else {
      this._renderReady();
    }
  }

  // ─── Phase 1: Loading ──────────────────────────────────────────────────

  _renderLoading() {
    const s = this._strings();

    // Intro während Loading (Settings noch nicht klickbar)
    const intro = document.createElement("div");
    intro.textContent = s.intro;
    Object.assign(intro.style, {
      fontSize: "13.5px",
      lineHeight: "1.5",
      color: "rgba(210, 220, 235, 0.78)",
      marginBottom: "26px",
    });
    this.card.appendChild(intro);

    // Progress-Bar (Track)
    const track = document.createElement("div");
    Object.assign(track.style, {
      height: "4px",
      width: "100%",
      borderRadius: "999px",
      background: "rgba(255, 255, 255, 0.07)",
      overflow: "hidden",
      marginBottom: "10px",
    });
    this.card.appendChild(track);

    this.progressBar = document.createElement("div");
    Object.assign(this.progressBar.style, {
      height: "100%",
      width: `${(this._lastRatio || 0) * 100}%`,
      background: "linear-gradient(90deg, rgba(126, 200, 255, 0.85), rgba(180, 230, 255, 0.95))",
      borderRadius: "999px",
      transition: "width 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)",
      boxShadow: "0 0 12px rgba(126, 200, 255, 0.5)",
    });
    track.appendChild(this.progressBar);

    // Label unter der Bar
    this.progressLabel = document.createElement("div");
    this.progressLabel.textContent = this._lastLabel || s.loading;
    Object.assign(this.progressLabel.style, {
      fontSize: "11px",
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: "rgba(170, 190, 210, 0.6)",
      marginTop: "12px",
    });
    this.card.appendChild(this.progressLabel);
  }

  // ─── Phase 2: Ready (Settings + Start) ─────────────────────────────────

  _renderReady() {
    const s = this._strings();

    // Settings-Sektionen
    const settingsWrap = document.createElement("div");
    Object.assign(settingsWrap.style, {
      display: "flex",
      flexDirection: "column",
      gap: "18px",
      marginBottom: "28px",
      textAlign: "left",
    });
    this.card.appendChild(settingsWrap);

    settingsWrap.appendChild(this._buildLangSection());
    settingsWrap.appendChild(this._buildVolumeSection());
    settingsWrap.appendChild(this._buildGraphicsSection());
    settingsWrap.appendChild(this._buildRendererSection());

    // Start-Button
    const btn = document.createElement("button");
    btn.textContent = s.start + " →";
    Object.assign(btn.style, {
      width: "100%",
      padding: "14px 24px",
      borderRadius: "12px",
      border: "1px solid rgba(126, 200, 255, 0.55)",
      background: "linear-gradient(135deg, rgba(126,200,255,0.35), rgba(126,200,255,0.18))",
      color: "rgba(245, 250, 255, 0.98)",
      fontSize: "16px",
      fontWeight: "700",
      letterSpacing: "0.04em",
      cursor: "pointer",
      transition: "background 0.15s, transform 0.1s",
    });
    btn.addEventListener("mouseenter", () => {
      btn.style.background = "linear-gradient(135deg, rgba(126,200,255,0.50), rgba(126,200,255,0.26))";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.background = "linear-gradient(135deg, rgba(126,200,255,0.35), rgba(126,200,255,0.18))";
    });
    btn.addEventListener("click", () => this._handleStart());
    this.card.appendChild(btn);
  }

  // ─── Setting-Sections ──────────────────────────────────────────────────

  _sectionLabel(text) {
    const lbl = document.createElement("div");
    lbl.textContent = text;
    Object.assign(lbl.style, {
      fontSize: "10px",
      textTransform: "uppercase",
      letterSpacing: "0.20em",
      color: "rgba(160, 180, 200, 0.65)",
      marginBottom: "8px",
    });
    return lbl;
  }

  _toggleGroup(options, currentValue, onChange) {
    const group = document.createElement("div");
    Object.assign(group.style, {
      display: "flex",
      gap: "6px",
      background: "rgba(0, 0, 0, 0.3)",
      padding: "4px",
      borderRadius: "10px",
    });
    const buttons = {};
    for (const opt of options) {
      const b = document.createElement("button");
      b.textContent = opt.label;
      Object.assign(b.style, {
        flex: "1",
        // 12px Vertikal-Padding → ~44px Höhe (Apple HIG Touch-Mindestmaß)
        padding: "12px 14px",
        border: "none",
        borderRadius: "7px",
        background: "transparent",
        color: "rgba(220, 230, 240, 0.85)",
        cursor: "pointer",
        fontSize: "13px",
        fontWeight: "500",
        transition: "background 0.15s",
      });
      b.addEventListener("click", () => {
        onChange(opt.value);
        for (const v in buttons) {
          buttons[v].style.background =
            v === opt.value ? "rgba(255, 255, 255, 0.18)" : "transparent";
          buttons[v].style.color =
            v === opt.value ? "white" : "rgba(220, 230, 240, 0.85)";
        }
      });
      buttons[opt.value] = b;
      group.appendChild(b);
    }
    for (const v in buttons) {
      buttons[v].style.background =
        v === currentValue ? "rgba(255, 255, 255, 0.18)" : "transparent";
      buttons[v].style.color =
        v === currentValue ? "white" : "rgba(220, 230, 240, 0.85)";
    }
    return group;
  }

  _buildLangSection() {
    const wrap = document.createElement("div");
    wrap.appendChild(this._sectionLabel(this._strings().sectionLang));
    wrap.appendChild(this._toggleGroup(
      [
        { label: "Deutsch", value: "de" },
        { label: "English", value: "en" },
      ],
      this.settings.lang,
      (val) => {
        if (val === this.settings.lang) return;
        this.settings.lang = val;
        if (typeof window !== "undefined") window.__lang = val;
        this._saveSettings();
        // Komplettes Re-Render der Card mit neuer Sprache
        this._render();
        // Auch die UI dahinter (Kontakt-Button, 3D-Labels, etc.) refreshen
        try {
          const game = typeof window !== "undefined" ? window.__game : null;
          game?.ui?.refreshLang?.();
        } catch (e) {}
      },
    ));
    return wrap;
  }

  _buildVolumeSection() {
    const wrap = document.createElement("div");
    wrap.appendChild(this._sectionLabel(this._strings().sectionVolume));

    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex",
      alignItems: "center",
      gap: "12px",
    });

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "100";
    slider.value = String(Math.round(this.settings.volume * 100));
    Object.assign(slider.style, {
      flex: "1",
      accentColor: "#7ec8ff",
    });

    const val = document.createElement("span");
    val.textContent = `${Math.round(this.settings.volume * 100)}%`;
    Object.assign(val.style, {
      width: "40px",
      textAlign: "right",
      fontVariantNumeric: "tabular-nums",
      color: "rgba(220, 230, 240, 0.85)",
      fontSize: "13px",
    });

    slider.addEventListener("input", () => {
      const v = parseInt(slider.value, 10) / 100;
      this.settings.volume = v;
      val.textContent = `${Math.round(v * 100)}%`;
      if (typeof window !== "undefined") window.__masterVolume = v;
      this._saveSettings();
      // AudioManager direkt benachrichtigen damit Ambient sofort umschaltet
      try {
        const game = typeof window !== "undefined" ? window.__game : null;
        game?.audio?.refreshVolume?.();
      } catch (e) {}
    });

    row.appendChild(slider);
    row.appendChild(val);
    wrap.appendChild(row);
    return wrap;
  }

  _buildGraphicsSection() {
    const s = this._strings();
    const wrap = document.createElement("div");
    wrap.appendChild(this._sectionLabel(s.sectionGraphics));
    wrap.appendChild(this._toggleGroup(
      [
        { label: s.graphicsLow, value: "low" },
        { label: s.graphicsHigh, value: "high" },
      ],
      this.settings.graphics,
      (val) => {
        this.settings.graphics = val;
        this._saveSettings();
        // SettingsPanel im laufenden Game refreshen damit die Änderung
        // sofort auf den Renderer wirkt (PixelRatio + ShadowMap).
        try {
          const game = typeof window !== "undefined" ? window.__game : null;
          if (game?.ui?.settings) {
            game.ui.settings.settings.graphics = val;
            game.ui.settings._applySettings?.();
          }
        } catch (e) {}
      },
    ));
    return wrap;
  }

  _buildRendererSection() {
    const wrap = document.createElement("div");
    wrap.appendChild(this._sectionLabel(this._strings().sectionRenderer));
    // WebGL zuerst (Standard, stabiler), WebGPU als optionale Alternative
    wrap.appendChild(this._toggleGroup(
      [
        { label: "WebGL", value: "webgl" },
        { label: "WebGPU", value: "webgpu" },
      ],
      this.settings.renderer,
      (val) => {
        if (val === this.settings.renderer) return;
        this.settings.renderer = val;
        this._saveSettings();
        // Renderer-Mode-Wechsel braucht Page-Reload (wie im alten SettingsPanel)
        const hint = document.createElement("div");
        hint.textContent = this.settings.lang === "en"
          ? "Reloading to apply renderer change…"
          : "Seite wird neu geladen für Renderer-Wechsel…";
        Object.assign(hint.style, {
          marginTop: "10px",
          fontSize: "11px",
          color: "rgba(180, 200, 220, 0.7)",
          textAlign: "center",
        });
        this.card.appendChild(hint);
        setTimeout(() => location.reload(), 700);
      },
    ));
    return wrap;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────

  /** Externer Aufruf vom Game.js bei Resources-Progress. */
  setProgress(ratio, label) {
    this._lastRatio = ratio;
    this._lastLabel = label;
    if (this.progressBar) {
      this.progressBar.style.width = `${Math.round(ratio * 100)}%`;
    }
    if (this.progressLabel && label) {
      this.progressLabel.textContent = label;
    }
  }

  /** Externer Aufruf vom Game.js wenn alle Assets geladen sind. */
  markReady() {
    if (this.ready) return;
    this.ready = true;
    // Render Phase 2 mit kurzem Stagger damit Progress-Bar bei 100% sichtbar war
    setTimeout(() => this._render(), 350);
  }

  _handleStart() {
    if (this.destroyed) return;

    // Canvas-Blur entfernen
    this._applyCanvasBlur(false);

    // Splash fade-out
    this.root.style.opacity = "0";
    setTimeout(() => {
      this.destroy();
      this.onStart?.();
    }, 600);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    // Sicherheitshalber Blur off, falls destroy ohne handleStart gerufen wird
    this._applyCanvasBlur(false);
    this.root?.remove?.();
  }
}
