/**
 * DiscoveryHud — Toast oben-mitte bei Easter-Egg-Discovery.
 *
 * Brutalist-Game-HUD register:
 *   - Hairline-Akzent links (signal coral), kein glow shadow
 *   - Solid ink surface, kein backdrop-blur
 *   - Lowercase mono terminal-line: "> discovered. egg_title"
 *
 * Persistent via localStorage: gefundene IDs werden gespeichert.
 */

import { t } from "../data/content.js";

const STORAGE_KEY = "numan-portfolio-discoveries-v1";

export class DiscoveryHud {
  constructor(game, total = 4) {
    this.game = game;
    this.total = total;
    this.found = this._loadFound();
    this._build();
  }

  _loadFound() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return new Set(arr);
      }
    } catch (e) {}
    return new Set();
  }

  _saveFound() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.found]));
    } catch (e) {}
  }

  _build() {
    this.toast = document.createElement("div");
    this.toast.setAttribute("role", "status");
    this.toast.setAttribute("aria-live", "polite");
    Object.assign(this.toast.style, {
      position: "fixed",
      top: "70px",
      left: "50%",
      transform: "translateX(-50%) translateY(-200%)",
      padding: "10px 16px 10px 18px",
      background: "var(--ink-solid)",
      borderLeft: "2px solid var(--signal)",
      color: "var(--paper)",
      fontFamily: "var(--font-mono)",
      fontSize: "12px",
      letterSpacing: "0.02em",
      zIndex: "14",
      pointerEvents: "none",
      opacity: "0",
      transition: "transform 280ms var(--ease), opacity 200ms var(--ease)",
    });
    document.body.appendChild(this.toast);
    this._toastTimer = null;
  }

  markDiscovered(id, eggTitle) {
    if (this.found.has(id)) return false;
    this.found.add(id);
    this._saveFound();
    this._showToast(eggTitle || t("egg_found"));
    this.game.audio?.playDiscovery?.();
    return true;
  }

  _showToast(msg) {
    clearTimeout(this._toastTimer);
    this.toast.textContent = `> discovered. ${msg}`;
    requestAnimationFrame(() => {
      this.toast.style.opacity = "1";
      this.toast.style.transform = "translateX(-50%) translateY(0)";
    });
    this._toastTimer = setTimeout(() => {
      this.toast.style.opacity = "0";
      this.toast.style.transform = "translateX(-50%) translateY(-200%)";
    }, 2800);
  }

  isDiscovered(id) {
    return this.found.has(id);
  }

  destroy() {
    clearTimeout(this._toastTimer);
    this.toast?.remove?.();
  }
}
