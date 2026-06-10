/**
 * ControlModePicker — Welcome-Overlay beim ersten Mobile-Start.
 *
 * Brutalist-Game-HUD register:
 *   - Solid ink dialog mit corner-brackets
 *   - Zwei Optionen als hairline-Rahmen-Boxen, recommended = signal-border
 *   - Plain mono text-buttons, kein gradient, kein blur
 *
 * Nur Mobile/Touch, einmalig pro User (localStorage).
 */

import { setControlMode, markPickerSeen, hasPickerBeenSeen } from "./controlMode.js";

const SHOW_DELAY_MS = 900;

export class ControlModePicker {
  constructor(game) {
    this.game = game;
    this.dom = null;
    this._timer = null;

    if (hasPickerBeenSeen()) return;
    if (!this._isTouchDevice()) return;

    this._timer = setTimeout(() => this._show(), SHOW_DELAY_MS);
  }

  _isTouchDevice() {
    if (typeof window === "undefined") return false;
    const url = new URL(window.location.href);
    if (url.searchParams.has("touch")) return true;
    if (window.matchMedia?.("(hover: none)")?.matches) return true;
    if (window.matchMedia?.("(max-width: 767px)")?.matches) return true;
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }

  _show() {
    if (this.dom) return;
    if (hasPickerBeenSeen()) return;

    const lang = (typeof window !== "undefined" && window.__lang === "en") ? "en" : "de";
    const strings = lang === "en" ? {
      meta: "> tutorial",
      title: "choose your controls",
      sub: "how do you want to ride the bike. you can switch any time in settings.",
      joystickTitle: "on-bike joystick",
      joystickDesc: "a virtual joystick sits under the bike. drag in any direction to steer. recommended.",
      tapTitle: "tap to move",
      tapDesc: "tap a spot on the ground. the bike rides there on its own. like a top-down rpg.",
      pick: "pick",
      recommended: "recommended",
    } : {
      meta: "> tutorial",
      title: "wähl deine steuerung",
      sub: "wie willst du das fahrrad steuern. du kannst jederzeit in den einstellungen wechseln.",
      joystickTitle: "joystick am bike",
      joystickDesc: "ein virtueller joystick liegt unter dem fahrrad. ziehe in eine richtung zum lenken. empfohlen.",
      tapTitle: "tippen statt steuern",
      tapDesc: "tippe eine stelle am boden. das fahrrad fährt von selbst dorthin. wie bei einem top-down-rpg.",
      pick: "wählen",
      recommended: "empfohlen",
    };

    const root = document.createElement("div");
    root.style.cssText = `
      position: fixed; inset: 0; z-index: 9998;
      background: rgba(20, 15, 25, 0.55);
      display: flex; align-items: center; justify-content: center;
      padding: 20px;
      opacity: 0;
      transition: opacity 280ms var(--ease);
      font-family: var(--font-ui);
      color: var(--paper);
    `;

    const card = document.createElement("div");
    card.className = "hud-bracket";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-labelledby", "cmp-title");
    card.style.cssText = `
      max-width: 720px; width: 100%;
      background: var(--ink-solid);
      color: var(--paper);
      padding: 26px 24px 22px;
    `;

    card.innerHTML = `
      <span class="hud-bracket-tr"></span>
      <span class="hud-bracket-bl"></span>
      <div class="hud-kicker" style="margin-bottom:10px;">${strings.meta}</div>
      <h2 id="cmp-title" style="margin:0 0 8px;font-family:var(--font-display);font-size:36px;font-weight:700;line-height:1.05;letter-spacing:0.02em;color:var(--paper);">${strings.title}</h2>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.5;color:var(--paper-muted);">${strings.sub}</p>
      <hr class="hud-rule" style="margin:0 0 18px;" />
      <div data-cmp-grid style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
        ${this._renderCard("joystick", strings.joystickTitle, strings.joystickDesc, strings.pick, strings.recommended, true)}
        ${this._renderCard("tap", strings.tapTitle, strings.tapDesc, strings.pick, strings.recommended, false)}
      </div>
    `;

    const style = document.createElement("style");
    style.textContent = `
      .cmp-card {
        padding: 16px 14px;
        background: transparent;
        border: 1px solid var(--rule);
        border-radius: var(--radius);
        display: flex; flex-direction: column;
        gap: 10px;
        text-align: left;
        font-family: var(--font-ui);
      }
      .cmp-card.recommended { border-color: var(--signal); }
      .cmp-card-title { font-size: 16px; font-weight: 700; margin: 0; color: var(--paper); }
      .cmp-card-desc { font-size: 14px; line-height: 1.5; color: var(--paper-muted); margin: 0; flex: 1; }
      .cmp-card-pick {
        margin-top: auto;
        padding: 12px 14px;
        background: transparent;
        border: 1px solid var(--rule-strong);
        border-radius: var(--radius);
        color: var(--paper);
        font-family: var(--font-ui);
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        min-height: 44px;
        transition: border-color 180ms var(--ease), color 180ms var(--ease);
      }
      .cmp-card-pick:hover,
      .cmp-card-pick:focus-visible {
        border-color: var(--signal);
        color: var(--signal);
      }
      .cmp-card.recommended .cmp-card-pick { border-color: var(--signal); color: var(--signal); }
      .cmp-badge {
        display: inline-block;
        font-size: 10px;
        color: var(--signal);
        padding: 0;
      }
      @media (max-width: 640px) {
        [data-cmp-grid] { grid-template-columns: 1fr !important; }
      }
    `;
    root.appendChild(style);
    root.appendChild(card);
    document.body.appendChild(root);
    this.dom = root;
    this._extraStyle = style;

    requestAnimationFrame(() => { root.style.opacity = "1"; });

    card.querySelectorAll(".cmp-card-pick").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.mode;
        setControlMode(mode);
        markPickerSeen();
        this._close();
      });
    });
  }

  _renderCard(mode, title, desc, pickLabel, recommendedLabel, recommended) {
    const badge = recommended
      ? `<span class="cmp-badge">[ ${recommendedLabel} ]</span>`
      : "";
    return `
      <div class="cmp-card ${recommended ? "recommended" : ""}">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;">
          <h3 class="cmp-card-title">${title}</h3>
          ${badge}
        </div>
        <p class="cmp-card-desc">${desc}</p>
        <button class="cmp-card-pick" data-mode="${mode}">${pickLabel}  →</button>
      </div>
    `;
  }

  _close() {
    if (!this.dom) return;
    this.dom.style.opacity = "0";
    const r = this.dom;
    const s = this._extraStyle;
    this.dom = null;
    setTimeout(() => { r?.remove?.(); s?.remove?.(); }, 320);
  }

  destroy() {
    clearTimeout(this._timer);
    this._close();
  }
}
