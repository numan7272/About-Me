/**
 * ControlModePicker — Welcome-Overlay beim ersten Mobile-Start.
 *
 * Zeigt 2 Karten:
 *   - "Joystick" — In-World-3D-Steuerung wie Bruno Simon
 *   - "Tap-to-Move" — League-of-Legends-Style: tap → Bike fährt hin
 *
 * Nur einmal sichtbar (localStorage). Im Settings-Panel jederzeit änderbar.
 * Auf Desktop standardmäßig nicht angezeigt — Settings bleibt dort der Weg.
 */

import { setControlMode, markPickerSeen, hasPickerBeenSeen } from "./controlMode.js";

const SHOW_DELAY_MS = 900;     // kurz warten bis Splash weg ist

export class ControlModePicker {
  constructor(game) {
    this.game = game;
    this.dom = null;
    this._timer = null;

    // Wann zeigen? Nur auf Mobile/Touch + nur wenn noch nie gesehen.
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
      title: "Choose your controls",
      sub: "How do you want to ride the bike? You can switch any time in settings.",
      joystickTitle: "On-Bike Joystick",
      joystickDesc: "A virtual joystick lives around the bike. Drag in any direction to steer. Recommended.",
      tapTitle: "Tap to Move",
      tapDesc: "Tap a spot on the ground — the bike rides there on its own. Like a top-down RPG.",
      pick: "Pick",
    } : {
      title: "Wähl deine Steuerung",
      sub: "Wie willst du das Fahrrad steuern? Du kannst jederzeit in den Einstellungen wechseln.",
      joystickTitle: "Joystick am Bike",
      joystickDesc: "Ein virtueller Joystick liegt unter dem Fahrrad. Ziehe in eine Richtung zum Lenken. Empfohlen.",
      tapTitle: "Tippen statt Steuern",
      tapDesc: "Tippe eine Stelle am Boden — das Fahrrad fährt von selbst dorthin. Wie bei einem Top-Down-RPG.",
      pick: "Wählen",
    };

    const root = document.createElement("div");
    root.className = "cmp-overlay";
    root.style.cssText = `
      position: fixed; inset: 0; z-index: 9998;
      background: rgba(4, 8, 16, 0.86);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      display: flex; align-items: center; justify-content: center;
      padding: 20px;
      opacity: 0; transition: opacity 280ms ease;
      font-family: system-ui, -apple-system, sans-serif;
      color: #f0f5fa;
    `;

    const card = document.createElement("div");
    card.style.cssText = `
      max-width: 720px; width: 100%;
      background: rgba(10, 18, 32, 0.95);
      border: 1px solid rgba(126, 200, 255, 0.20);
      border-radius: 18px;
      padding: 28px 26px;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
    `;

    card.innerHTML = `
      <div style="font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:#7ec8ff;margin-bottom:10px;">
        TUTORIAL
      </div>
      <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;line-height:1.15;">${strings.title}</h2>
      <p style="margin:0 0 22px;font-size:14px;line-height:1.5;color:rgba(200,212,228,0.85);">
        ${strings.sub}
      </p>
      <div class="cmp-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
        ${this._renderCard("joystick", strings.joystickTitle, strings.joystickDesc, strings.pick, true)}
        ${this._renderCard("tap", strings.tapTitle, strings.tapDesc, strings.pick, false)}
      </div>
    `;

    const style = document.createElement("style");
    style.textContent = `
      .cmp-card {
        padding: 18px 16px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.10);
        border-radius: 12px;
        display: flex; flex-direction: column;
        gap: 10px;
        text-align: left;
      }
      .cmp-card.recommended {
        border-color: rgba(126, 200, 255, 0.40);
        background: rgba(126, 200, 255, 0.06);
      }
      .cmp-card-icon { font-size: 32px; line-height: 1; }
      .cmp-card-title { font-size: 16px; font-weight: 700; margin: 0; }
      .cmp-card-desc { font-size: 12.5px; line-height: 1.5; color: rgba(200,212,228,0.78); margin: 0; }
      .cmp-card-pick {
        margin-top: auto;
        padding: 11px 14px;
        background: linear-gradient(135deg, rgba(126,200,255,0.30), rgba(126,200,255,0.12));
        border: 1px solid rgba(126, 200, 255, 0.50);
        color: #f0f5fa;
        font-weight: 600;
        font-size: 13px;
        border-radius: 8px;
        cursor: pointer;
        font-family: inherit;
        min-height: 44px;
      }
      .cmp-card-pick:hover { filter: brightness(1.15); }
      .cmp-badge {
        display: inline-block;
        padding: 2px 8px;
        font-size: 10px;
        letter-spacing: 0.06em;
        color: #7ec8ff;
        background: rgba(126, 200, 255, 0.15);
        border-radius: 999px;
        font-weight: 600;
        text-transform: uppercase;
      }
      @media (max-width: 640px) {
        .cmp-grid { grid-template-columns: 1fr !important; }
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

  _renderCard(mode, title, desc, pickLabel, recommended) {
    const icon = mode === "joystick" ? "🕹️" : "🎯";
    const badge = recommended ? `<span class="cmp-badge">Empfohlen</span>` : "";
    return `
      <div class="cmp-card ${recommended ? "recommended" : ""}">
        <div class="cmp-card-icon">${icon}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <h3 class="cmp-card-title">${title}</h3>
          ${badge}
        </div>
        <p class="cmp-card-desc">${desc}</p>
        <button class="cmp-card-pick" data-mode="${mode}">${pickLabel}</button>
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
