/**
 * SettingsPanel — Zahnrad oben links, klappbares Panel.
 *
 * Inhalt:
 *   - Sprache: DE / EN (Toggle)
 *   - Audio: Volume-Slider 0-100
 *   - Grafik: Low / High (Toggle — beeinflusst Shadow-Map-Size + AA)
 *
 * State wird in localStorage gespeichert damit's Reloads übersteht.
 */

const STORAGE_KEY = "numan-portfolio-settings-v1";

const DEFAULTS = {
  lang: "de",
  volume: 0.7,
  graphics: "high",     // "low" | "high"
  renderer: "webgl",    // "webgl" (default) oder "webgpu"
};

export class SettingsPanel {
  constructor(game) {
    this.game = game;
    this.settings = this._loadSettings();
    this.isOpen = false;

    this._buildUI();
    this._applySettings();

    // K1-Fix: Renderer ist evtl. async (WebGPU). _applySettings setzt
    // PixelRatio + shadowMap, was nur funktioniert wenn renderer.instance
    // existiert. Wir hängen uns an renderer.ready und re-applyen.
    if (this.game?.renderer?.ready?.then) {
      this.game.renderer.ready.then(() => {
        this._applySettings();
        if (this._rendererHint) {
          this._rendererHint.textContent =
            "Active: " + (this.game?.renderer?.mode || "unknown");
        }
      }).catch((err) => {
        console.warn("[Settings] renderer.ready failed:", err?.message);
        if (this._rendererHint) {
          this._rendererHint.textContent = "Renderer init failed — using WebGL fallback";
        }
      });
    }
  }

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

  _buildUI() {
    // ── Zahnrad-Button ──
    this.btn = document.createElement("button");
    this.btn.innerHTML = "⚙";
    this.btn.title = "Settings";
    Object.assign(this.btn.style, {
      position: "fixed",
      top: "20px",
      left: "20px",
      width: "42px",
      height: "42px",
      borderRadius: "50%",
      border: "1px solid rgba(255, 255, 255, 0.18)",
      background: "rgba(0, 0, 0, 0.45)",
      backdropFilter: "blur(10px)",
      color: "rgba(240, 245, 250, 0.92)",
      fontSize: "22px",
      cursor: "pointer",
      zIndex: "12",
      transition: "transform 0.2s, background 0.15s",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      lineHeight: "1",
    });
    this.btn.addEventListener("mouseenter", () => {
      this.btn.style.background = "rgba(255, 255, 255, 0.12)";
    });
    this.btn.addEventListener("mouseleave", () => {
      this.btn.style.background = "rgba(0, 0, 0, 0.45)";
    });
    this.btn.addEventListener("click", () => this.toggle());
    document.body.appendChild(this.btn);

    // ── Panel ──
    this.panel = document.createElement("div");
    Object.assign(this.panel.style, {
      position: "fixed",
      top: "72px",
      left: "20px",
      width: "240px",
      padding: "16px",
      borderRadius: "14px",
      border: "1px solid rgba(255, 255, 255, 0.14)",
      background: "rgba(10, 18, 32, 0.78)",
      backdropFilter: "blur(14px)",
      color: "rgba(240, 245, 250, 0.92)",
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: "13px",
      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.45)",
      zIndex: "12",
      display: "none",
      flexDirection: "column",
      gap: "16px",
    });

    this.panel.appendChild(this._buildLanguageRow());
    this.panel.appendChild(this._buildVolumeRow());
    this.panel.appendChild(this._buildGraphicsRow());
    this.panel.appendChild(this._buildRendererRow());

    document.body.appendChild(this.panel);
  }

  _buildSectionLabel(text) {
    const lbl = document.createElement("div");
    lbl.textContent = text;
    Object.assign(lbl.style, {
      fontSize: "10px",
      textTransform: "uppercase",
      letterSpacing: "0.18em",
      color: "rgba(180, 195, 210, 0.7)",
      marginBottom: "6px",
    });
    return lbl;
  }

  _buildToggleGroup(options, currentValue, onChange) {
    const group = document.createElement("div");
    Object.assign(group.style, {
      display: "flex",
      gap: "6px",
      background: "rgba(0, 0, 0, 0.3)",
      padding: "4px",
      borderRadius: "8px",
    });
    const buttons = {};
    for (const opt of options) {
      const b = document.createElement("button");
      b.textContent = opt.label;
      Object.assign(b.style, {
        flex: "1",
        padding: "6px 10px",
        border: "none",
        borderRadius: "5px",
        background: "transparent",
        color: "rgba(220, 230, 240, 0.85)",
        cursor: "pointer",
        fontSize: "12px",
        transition: "background 0.15s",
      });
      b.addEventListener("click", () => {
        onChange(opt.value);
        for (const v in buttons) {
          buttons[v].style.background =
            v === opt.value ? "rgba(255, 255, 255, 0.16)" : "transparent";
          buttons[v].style.color =
            v === opt.value ? "white" : "rgba(220, 230, 240, 0.85)";
        }
      });
      buttons[opt.value] = b;
      group.appendChild(b);
    }
    // Initial styling
    for (const v in buttons) {
      buttons[v].style.background =
        v === currentValue ? "rgba(255, 255, 255, 0.16)" : "transparent";
      buttons[v].style.color =
        v === currentValue ? "white" : "rgba(220, 230, 240, 0.85)";
    }
    return group;
  }

  _buildLanguageRow() {
    const wrap = document.createElement("div");
    wrap.appendChild(this._buildSectionLabel("Language"));
    wrap.appendChild(this._buildToggleGroup(
      [
        { label: "Deutsch", value: "de" },
        { label: "English", value: "en" },
      ],
      this.settings.lang,
      (val) => {
        this.settings.lang = val;
        this._saveSettings();
        this._applySettings();
      },
    ));
    return wrap;
  }

  _buildVolumeRow() {
    const wrap = document.createElement("div");
    wrap.appendChild(this._buildSectionLabel("Volume"));

    const sliderRow = document.createElement("div");
    Object.assign(sliderRow.style, {
      display: "flex",
      alignItems: "center",
      gap: "10px",
    });

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "100";
    slider.value = String(this.settings.volume * 100);
    Object.assign(slider.style, {
      flex: "1",
      accentColor: "#7ec8ff",
    });

    const valueLabel = document.createElement("span");
    valueLabel.textContent = `${Math.round(this.settings.volume * 100)}%`;
    Object.assign(valueLabel.style, {
      width: "38px",
      textAlign: "right",
      fontVariantNumeric: "tabular-nums",
      color: "rgba(220, 230, 240, 0.85)",
    });

    slider.addEventListener("input", () => {
      const v = parseInt(slider.value, 10) / 100;
      this.settings.volume = v;
      valueLabel.textContent = `${Math.round(v * 100)}%`;
      this._saveSettings();
      this._applySettings();
    });

    sliderRow.appendChild(slider);
    sliderRow.appendChild(valueLabel);
    wrap.appendChild(sliderRow);
    return wrap;
  }

  _buildGraphicsRow() {
    const wrap = document.createElement("div");
    wrap.appendChild(this._buildSectionLabel("Graphics"));
    wrap.appendChild(this._buildToggleGroup(
      [
        { label: "Low", value: "low" },
        { label: "High", value: "high" },
      ],
      this.settings.graphics,
      (val) => {
        this.settings.graphics = val;
        this._saveSettings();
        this._applySettings();
      },
    ));
    return wrap;
  }

  _buildRendererRow() {
    const wrap = document.createElement("div");
    wrap.appendChild(this._buildSectionLabel("Renderer"));
    wrap.appendChild(this._buildToggleGroup(
      [
        { label: "WebGL", value: "webgl" },
        { label: "WebGPU", value: "webgpu" },
      ],
      this.settings.renderer,
      (val) => {
        if (val === this.settings.renderer) return;
        this.settings.renderer = val;
        this._saveSettings();
        // Render-Mode benötigt Page-Reload — wir geben ein subtiles Feedback
        if (this._rendererHint) {
          this._rendererHint.textContent = `Reload page to apply (${val})…`;
          this._rendererHint.style.opacity = "1";
          setTimeout(() => location.reload(), 500);
        }
      },
    ));
    const hint = document.createElement("div");
    hint.textContent = "";
    Object.assign(hint.style, {
      marginTop: "6px",
      fontSize: "10px",
      color: "rgba(180, 200, 220, 0.55)",
      transition: "opacity 0.2s",
      opacity: "0.55",
    });
    hint.textContent = "Active: " + (this.game?.renderer?.mode || "loading…");
    wrap.appendChild(hint);
    this._rendererHint = hint;
    return wrap;
  }

  _applySettings() {
    // Audio-Volume — global hooken + AudioManager refreshen
    if (typeof window !== "undefined") {
      window.__masterVolume = this.settings.volume;
    }
    this.game?.audio?.refreshVolume?.();

    // Grafik — Shadow-Map-Size + Pixel-Ratio anpassen
    // K1-Fix: renderer.instance ist evtl. noch null (WebGPU init läuft).
    // In dem Fall überspringen — renderer.ready-Hook re-applyt später.
    const renderer = this.game?.renderer?.instance;
    if (renderer) {
      try {
        if (this.settings.graphics === "low") {
          renderer.setPixelRatio(Math.min(1.0, window.devicePixelRatio || 1));
          if (renderer.shadowMap) renderer.shadowMap.enabled = false;
        } else {
          renderer.setPixelRatio(Math.min(2.0, window.devicePixelRatio || 1));
          if (renderer.shadowMap) renderer.shadowMap.enabled = true;
        }
      } catch (e) {
        console.warn("[Settings] graphics apply skipped:", e?.message);
      }
    }

    // Sprache — für i18n hooken + UI-Komponenten benachrichtigen
    if (typeof window !== "undefined") {
      const prevLang = window.__lang;
      window.__lang = this.settings.lang;
      // Nur refreshen wenn sich was geändert hat — vermeidet teure
      // CanvasTexture-Neuzeichnung beim initial Apply.
      if (prevLang && prevLang !== this.settings.lang) {
        this.game?.ui?.refreshLang?.();
      }
    }
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.panel.style.display = this.isOpen ? "flex" : "none";
    this.btn.style.transform = this.isOpen ? "rotate(60deg)" : "rotate(0deg)";
  }

  destroy() {
    this.btn?.remove?.();
    this.panel?.remove?.();
  }
}
