/**
 * LoadingSplash — Lade-Screen + Start-CTA im warmen Spiel-Register.
 *
 * Phase 1 LOADING:
 *   Runder Progress-Bar + Label der gerade ladenden Resource.
 *   3D-Szene läuft im Hintergrund leicht abgedunkelt, kein heavy blur.
 *
 * Phase 2 READY:
 *   Settings (Lang / Volume / Graphics / Renderer) erscheinen.
 *   Großer Start-Button, outlined im Signal-Peach.
 *
 * State über window.__masterVolume / window.__lang / localStorage gespiegelt.
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
    loading: "Lädt …",
    ready: "Bereit!",
    sectionLang: "Sprache",
    sectionVolume: "Lautstärke",
    sectionGraphics: "Grafik",
    sectionRenderer: "Renderer",
    graphicsLow: "Niedrig",
    graphicsHigh: "Hoch",
    start: "Los geht's",
    welcome: "Hi, willkommen!",
    intro: "Stell dir die Welt ein, wie du magst.",
  },
  en: {
    loading: "Loading …",
    ready: "Ready!",
    sectionLang: "Language",
    sectionVolume: "Volume",
    sectionGraphics: "Graphics",
    sectionRenderer: "Renderer",
    graphicsLow: "Low",
    graphicsHigh: "High",
    start: "Start ride",
    welcome: "Hi, welcome!",
    intro: "Set the world the way you like it.",
  },
};

export class LoadingSplash {
  constructor(canvas) {
    this.canvas = canvas;
    this.onStart = null;
    this.ready = false;
    this.destroyed = false;

    this.settings = this._loadSettings();
    this._currentLabel = null;

    if (typeof window !== "undefined") {
      window.__masterVolume = this.settings.volume;
      window.__lang = this.settings.lang;
    }

    this._applyCanvasDim(true);
    this._buildUI();
    this._render();
  }

  _strings() {
    return STRINGS[this.settings.lang === "en" ? "en" : "de"];
  }

  _loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch (e) {}
    return { ...DEFAULTS };
  }

  _saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (e) {}
  }

  /** Light scene-dim instead of heavy blur. 3D still visible behind. */
  _applyCanvasDim(on) {
    if (!this.canvas) return;
    this.canvas.style.transition = "filter 0.55s ease";
    this.canvas.style.filter = on ? "brightness(0.35) saturate(0.85)" : "none";
  }

  _buildUI() {
    this.root = document.createElement("div");
    Object.assign(this.root.style, {
      position: "fixed",
      inset: "0",
      zIndex: "30",
      background: "rgba(20, 15, 25, 0.55)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: "var(--font-ui)",
      color: "var(--paper)",
      transition: "opacity 0.55s var(--ease)",
      opacity: "0",
    });

    this.card = document.createElement("section");
    this.card.className = "hud-bracket splash-card";
    this.card.setAttribute("role", "dialog");
    this.card.setAttribute("aria-modal", "true");
    this.card.setAttribute("aria-labelledby", "splash-title");
    Object.assign(this.card.style, {
      width: "min(520px, 100%)",
      maxHeight: "calc(100vh - 48px)",
      overflowY: "auto",
      overflowX: "hidden",
      scrollbarWidth: "none",
      msOverflowStyle: "none",
      WebkitOverflowScrolling: "touch",
      padding: window.innerWidth < 500
        ? "26px 22px 22px 22px"
        : "32px 32px 26px 32px",
      background: "var(--ink-solid)",
      color: "var(--paper)",
      textAlign: "left",
      pointerEvents: "auto",
    });
    this.card.append(this._cornerSpan("tr"), this._cornerSpan("bl"));
    this.root.appendChild(this.card);

    document.body.appendChild(this.root);

    requestAnimationFrame(() => {
      this.root.style.opacity = "1";
    });
  }

  _cornerSpan(corner) {
    const s = document.createElement("span");
    s.className = `hud-bracket-${corner}`;
    return s;
  }

  _render() {
    const s = this._strings();
    this.card.innerHTML = "";
    this.card.append(this._cornerSpan("tr"), this._cornerSpan("bl"));

    const top = document.createElement("div");
    Object.assign(top.style, {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: "24px",
      gap: "16px",
    });

    const left = document.createElement("div");

    const meta = document.createElement("div");
    meta.className = "hud-kicker";
    meta.textContent = s.welcome;
    meta.style.marginBottom = "6px";
    left.appendChild(meta);

    const name = document.createElement("h1");
    name.id = "splash-title";
    name.textContent = "Numan Yesil";
    Object.assign(name.style, {
      margin: "0",
      fontFamily: "var(--font-display)",
      fontSize: "52px",
      fontWeight: "700",
      lineHeight: "1.0",
      letterSpacing: "0.02em",
      color: "var(--paper)",
    });
    left.appendChild(name);

    const sub = document.createElement("div");
    sub.textContent = this.settings.lang === "en"
      ? "Business Informatics · Kiel"
      : "Wirtschaftsinformatik · Kiel";
    Object.assign(sub.style, {
      fontSize: "14px",
      color: "var(--paper-muted)",
      marginTop: "6px",
    });
    left.appendChild(sub);

    const right = document.createElement("div");
    right.className = "hud-kicker";
    right.textContent = this.ready ? s.ready : s.loading;
    Object.assign(right.style, {
      color: this.ready ? "var(--success)" : "var(--paper-muted)",
      whiteSpace: "nowrap",
    });
    this._statusEl = right;

    top.append(left, right);
    this.card.appendChild(top);

    const rule = document.createElement("hr");
    rule.className = "hud-rule";
    rule.style.margin = "0 0 18px";
    this.card.appendChild(rule);

    if (!this.ready) {
      this._renderLoading();
    } else {
      this._renderReady();
    }
  }

  _renderLoading() {
    const s = this._strings();

    const intro = document.createElement("p");
    intro.textContent = s.intro;
    Object.assign(intro.style, {
      margin: "0 0 20px",
      fontSize: "15px",
      lineHeight: "1.5",
      color: "var(--paper-muted)",
    });
    this.card.appendChild(intro);

    // Runder Progress-Bar statt Terminal-Boot-Log
    const barOuter = document.createElement("div");
    Object.assign(barOuter.style, {
      height: "10px",
      borderRadius: "5px",
      border: "1px solid var(--rule)",
      overflow: "hidden",
    });
    this._barInner = document.createElement("div");
    Object.assign(this._barInner.style, {
      height: "100%",
      width: `${Math.round((this._lastRatio || 0) * 100)}%`,
      background: "var(--signal)",
      borderRadius: "5px",
      transition: "width 280ms var(--ease)",
    });
    barOuter.appendChild(this._barInner);
    this.card.appendChild(barOuter);

    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex",
      justifyContent: "space-between",
      marginTop: "10px",
      fontSize: "13px",
      color: "var(--paper-muted)",
    });
    this._loadLabel = document.createElement("span");
    this._loadLabel.textContent = this._currentLabel || s.loading;
    this.progressRatio = document.createElement("span");
    this.progressRatio.style.fontVariantNumeric = "tabular-nums";
    this.progressRatio.textContent = this._formatProgress();
    row.append(this._loadLabel, this.progressRatio);
    this.card.appendChild(row);
  }

  _formatProgress() {
    return `${Math.round((this._lastRatio || 0) * 100)}%`;
  }

  _renderReady() {
    const s = this._strings();

    const settingsWrap = document.createElement("div");
    Object.assign(settingsWrap.style, {
      display: "flex",
      flexDirection: "column",
      gap: "16px",
      marginBottom: "24px",
    });
    this.card.appendChild(settingsWrap);

    settingsWrap.appendChild(this._buildLangSection());
    settingsWrap.appendChild(this._hairline());
    settingsWrap.appendChild(this._buildVolumeSection());
    settingsWrap.appendChild(this._hairline());
    settingsWrap.appendChild(this._buildGraphicsSection());
    settingsWrap.appendChild(this._hairline());
    settingsWrap.appendChild(this._buildRendererSection());

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hud-btn";
    btn.textContent = `${s.start} →`;
    Object.assign(btn.style, {
      width: "100%",
      padding: "16px",
      fontSize: "17px",
      fontWeight: "700",
      color: "var(--signal)",
      background: "transparent",
      border: "1px solid var(--signal)",
      cursor: "pointer",
      minHeight: "52px",
    });
    btn.addEventListener("mouseenter", () => {
      btn.style.background = "var(--signal-dim)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.background = "transparent";
    });
    btn.addEventListener("click", () => this._handleStart());
    this.card.appendChild(btn);

    setTimeout(() => btn.focus(), 50);
  }

  _hairline() {
    const hr = document.createElement("hr");
    hr.className = "hud-rule";
    hr.style.margin = "0";
    return hr;
  }

  _sectionLabel(text) {
    const lbl = document.createElement("div");
    lbl.className = "hud-kicker";
    lbl.textContent = text;
    lbl.style.marginBottom = "8px";
    return lbl;
  }

  _textToggleGroup(options, currentValue, onChange) {
    const group = document.createElement("div");
    group.setAttribute("role", "radiogroup");
    Object.assign(group.style, {
      display: "flex",
      gap: "4px",
      margin: "0 -10px",
    });
    const buttons = {};
    const apply = (active) => {
      for (const v in buttons) {
        buttons[v].dataset.active = String(v === active);
        buttons[v].setAttribute("aria-checked", String(v === active));
      }
    };
    for (const opt of options) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "hud-btn";
      b.textContent = opt.label;
      b.setAttribute("role", "radio");
      Object.assign(b.style, {
        flex: "1",
        padding: "10px 12px",
        minHeight: "44px",
      });
      b.addEventListener("click", () => {
        onChange(opt.value);
        apply(opt.value);
      });
      buttons[opt.value] = b;
      group.appendChild(b);
    }
    apply(currentValue);
    return group;
  }

  _buildLangSection() {
    const wrap = document.createElement("div");
    wrap.appendChild(this._sectionLabel(this._strings().sectionLang));
    wrap.appendChild(this._textToggleGroup(
      [
        { label: "DE", value: "de" },
        { label: "EN", value: "en" },
      ],
      this.settings.lang,
      (val) => {
        if (val === this.settings.lang) return;
        this.settings.lang = val;
        if (typeof window !== "undefined") window.__lang = val;
        this._saveSettings();
        this._render();
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
    slider.setAttribute("aria-label", "volume");
    Object.assign(slider.style, {
      flex: "1",
      accentColor: "var(--signal)",
    });

    const val = document.createElement("span");
    val.textContent = `${Math.round(this.settings.volume * 100)}`;
    Object.assign(val.style, {
      width: "32px",
      textAlign: "right",
      fontVariantNumeric: "tabular-nums",
      color: "var(--paper-muted)",
      fontSize: "12px",
    });

    slider.addEventListener("input", () => {
      const v = parseInt(slider.value, 10) / 100;
      this.settings.volume = v;
      val.textContent = `${Math.round(v * 100)}`;
      if (typeof window !== "undefined") window.__masterVolume = v;
      this._saveSettings();
      try {
        const game = typeof window !== "undefined" ? window.__game : null;
        game?.audio?.refreshVolume?.();
      } catch (e) {}
    });

    row.append(slider, val);
    wrap.appendChild(row);
    return wrap;
  }

  _buildGraphicsSection() {
    const s = this._strings();
    const wrap = document.createElement("div");
    wrap.appendChild(this._sectionLabel(s.sectionGraphics));
    wrap.appendChild(this._textToggleGroup(
      [
        { label: s.graphicsLow, value: "low" },
        { label: s.graphicsHigh, value: "high" },
      ],
      this.settings.graphics,
      (val) => {
        this.settings.graphics = val;
        this._saveSettings();
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
    wrap.appendChild(this._textToggleGroup(
      [
        { label: "WebGL", value: "webgl" },
        { label: "WebGPU", value: "webgpu" },
      ],
      this.settings.renderer,
      (val) => {
        if (val === this.settings.renderer) return;
        this.settings.renderer = val;
        this._saveSettings();
        const hint = document.createElement("div");
        hint.textContent = this.settings.lang === "en"
          ? "Reloading to apply the new renderer …"
          : "Lade neu, Renderer wechselt …";
        Object.assign(hint.style, {
          marginTop: "10px",
          fontSize: "13px",
          color: "var(--signal)",
          textAlign: "center",
        });
        this.card.appendChild(hint);
        setTimeout(() => location.reload(), 700);
      },
    ));
    return wrap;
  }

  /** External call from Game.js on resources progress. */
  setProgress(ratio, label) {
    this._lastRatio = ratio;
    if (label) this._currentLabel = label;
    if (this._barInner) {
      this._barInner.style.width = `${Math.round(ratio * 100)}%`;
    }
    if (this._loadLabel && this._currentLabel) {
      this._loadLabel.textContent = this._currentLabel;
    }
    if (this.progressRatio) {
      this.progressRatio.textContent = this._formatProgress();
    }
  }

  /** External call from Game.js when all assets loaded. */
  markReady() {
    if (this.ready) return;
    this.ready = true;
    setTimeout(() => this._render(), 350);
  }

  _handleStart() {
    if (this.destroyed) return;
    this._applyCanvasDim(false);
    this.root.style.opacity = "0";
    setTimeout(() => {
      this.destroy();
      this.onStart?.();
    }, 600);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this._applyCanvasDim(false);
    this.root?.remove?.();
  }
}
