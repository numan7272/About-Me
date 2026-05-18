/**
 * SettingsPanel — Text-Button oben-links, ausklappbares Panel.
 *
 * Brutalist-Game-HUD register:
 *   - "settings" als Lowercase-Wort statt rotierender Zahnrad
 *   - Toggle-Groups als plain text-buttons mit Hairline-Underline auf active
 *   - Solid ink surface, kein backdrop-blur
 *
 * State wird in localStorage gespeichert.
 */

import { getControlMode, setControlMode } from "./controlMode.js";

const STORAGE_KEY = "numan-portfolio-settings-v1";

const DEFAULTS = {
  lang: "de",
  volume: 0.7,
  graphics: "high",
  renderer: "webgl",
};

export class SettingsPanel {
  constructor(game) {
    this.game = game;
    this.settings = this._loadSettings();
    this.isOpen = false;

    this._buildUI();
    this._applySettings();

    if (this.game?.renderer?.ready?.then) {
      this.game.renderer.ready.then(() => {
        this._applySettings();
        if (this._rendererHint) {
          this._rendererHint.textContent =
            "active: " + (this.game?.renderer?.mode || "unknown");
        }
      }).catch((err) => {
        console.warn("[Settings] renderer.ready failed:", err?.message);
        if (this._rendererHint) {
          this._rendererHint.textContent =
            "renderer init failed. using webgl fallback";
        }
      });
    }
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

  _buildUI() {
    this.btn = document.createElement("button");
    this.btn.type = "button";
    this.btn.className = "hud-btn";
    this.btn.textContent = "settings";
    this.btn.setAttribute("aria-expanded", "false");
    this.btn.setAttribute("aria-controls", "settings-panel");
    Object.assign(this.btn.style, {
      position: "fixed",
      top: "20px",
      left: "20px",
      zIndex: "12",
      background: "var(--ink-solid)",
    });
    this.btn.addEventListener("click", () => this.toggle());
    document.body.appendChild(this.btn);

    this.panel = document.createElement("div");
    this.panel.id = "settings-panel";
    this.panel.className = "hud-bracket";
    Object.assign(this.panel.style, {
      position: "fixed",
      top: "76px",
      left: "20px",
      width: "240px",
      padding: "16px 16px 14px",
      fontFamily: "var(--font-mono)",
      fontSize: "12px",
      color: "var(--paper)",
      zIndex: "12",
      display: "none",
      flexDirection: "column",
      gap: "16px",
    });
    this.panel.append(this._cornerSpan("tr"), this._cornerSpan("bl"));

    this.panel.appendChild(this._buildLanguageRow());
    this.panel.appendChild(this._hairline());
    this.panel.appendChild(this._buildVolumeRow());
    this.panel.appendChild(this._hairline());
    this.panel.appendChild(this._buildGraphicsRow());
    this.panel.appendChild(this._hairline());
    this.panel.appendChild(this._buildRendererRow());
    this.panel.appendChild(this._hairline());
    this.panel.appendChild(this._buildControlModeRow());

    document.body.appendChild(this.panel);
  }

  _cornerSpan(corner) {
    const s = document.createElement("span");
    s.className = `hud-bracket-${corner}`;
    return s;
  }

  _hairline() {
    const hr = document.createElement("hr");
    hr.className = "hud-rule";
    hr.style.margin = "0";
    return hr;
  }

  _sectionLabel(text) {
    const lbl = document.createElement("div");
    lbl.textContent = `> ${text}`;
    Object.assign(lbl.style, {
      fontSize: "11px",
      color: "var(--paper-muted)",
      marginBottom: "8px",
    });
    return lbl;
  }

  _buildControlModeRow() {
    const wrap = document.createElement("div");
    wrap.appendChild(this._sectionLabel("bike control"));
    wrap.appendChild(this._textToggleGroup(
      [
        { value: "joystick", label: "joystick" },
        { value: "tap",      label: "tap-to-move" },
      ],
      getControlMode(),
      (val) => setControlMode(val),
    ));
    return wrap;
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
        padding: "8px 10px",
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

  _buildLanguageRow() {
    const wrap = document.createElement("div");
    wrap.appendChild(this._sectionLabel("language"));
    wrap.appendChild(this._textToggleGroup(
      [
        { label: "de", value: "de" },
        { label: "en", value: "en" },
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
    wrap.appendChild(this._sectionLabel("volume"));

    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex",
      alignItems: "center",
      gap: "10px",
    });

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "100";
    slider.value = String(this.settings.volume * 100);
    slider.setAttribute("aria-label", "volume");
    Object.assign(slider.style, {
      flex: "1",
      accentColor: "oklch(72% 0.22 25)",
    });

    const valueLabel = document.createElement("span");
    valueLabel.textContent = `${Math.round(this.settings.volume * 100)}`;
    Object.assign(valueLabel.style, {
      width: "32px",
      textAlign: "right",
      fontVariantNumeric: "tabular-nums",
      color: "var(--paper-muted)",
    });

    slider.addEventListener("input", () => {
      const v = parseInt(slider.value, 10) / 100;
      this.settings.volume = v;
      valueLabel.textContent = `${Math.round(v * 100)}`;
      this._saveSettings();
      this._applySettings();
    });

    row.appendChild(slider);
    row.appendChild(valueLabel);
    wrap.appendChild(row);
    return wrap;
  }

  _buildGraphicsRow() {
    const wrap = document.createElement("div");
    wrap.appendChild(this._sectionLabel("graphics"));
    wrap.appendChild(this._textToggleGroup(
      [
        { label: "low", value: "low" },
        { label: "high", value: "high" },
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
    wrap.appendChild(this._sectionLabel("renderer"));
    wrap.appendChild(this._textToggleGroup(
      [
        { label: "webgl", value: "webgl" },
        { label: "webgpu", value: "webgpu" },
      ],
      this.settings.renderer,
      (val) => {
        if (val === this.settings.renderer) return;
        this.settings.renderer = val;
        this._saveSettings();
        if (this._rendererHint) {
          this._rendererHint.textContent = `reloading. ${val}`;
          setTimeout(() => location.reload(), 500);
        }
      },
    ));
    const hint = document.createElement("div");
    Object.assign(hint.style, {
      marginTop: "6px",
      fontSize: "10px",
      color: "var(--paper-dim)",
    });
    hint.textContent = "active: " + (this.game?.renderer?.mode || "loading");
    wrap.appendChild(hint);
    this._rendererHint = hint;
    return wrap;
  }

  _applySettings() {
    if (typeof window !== "undefined") {
      window.__masterVolume = this.settings.volume;
    }
    this.game?.audio?.refreshVolume?.();

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

    if (typeof window !== "undefined") {
      const prevLang = window.__lang;
      window.__lang = this.settings.lang;
      if (prevLang && prevLang !== this.settings.lang) {
        this.game?.ui?.refreshLang?.();
      }
    }
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.panel.style.display = this.isOpen ? "flex" : "none";
    this.btn.setAttribute("aria-expanded", String(this.isOpen));
    this.btn.dataset.active = String(this.isOpen);
  }

  destroy() {
    this.btn?.remove?.();
    this.panel?.remove?.();
  }
}
