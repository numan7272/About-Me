/**
 * DiscoveryHud — Easter-Egg-Counter + Toast-Notification.
 *
 * Zeigt:
 *   - Badge (oben rechts, unter MiniMap): "X / 4" gefundene Eier
 *   - Toast (oben mitte): kurzes "Easter Egg gefunden!" für ~3s
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
    this._updateBadge();
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
    // Badge — oben rechts, unter MiniMap
    this.badge = document.createElement("div");
    Object.assign(this.badge.style, {
      position: "fixed",
      top: "240px",
      right: "20px",
      padding: "8px 14px",
      borderRadius: "999px",
      border: "1px solid rgba(255, 255, 255, 0.16)",
      background: "rgba(10, 18, 32, 0.72)",
      backdropFilter: "blur(12px)",
      color: "rgba(240, 245, 250, 0.95)",
      fontFamily: "system-ui, sans-serif",
      fontSize: "12px",
      letterSpacing: "0.08em",
      zIndex: "11",
      pointerEvents: "none",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    });

    this.badgeIcon = document.createElement("span");
    this.badgeIcon.textContent = "✦";
    Object.assign(this.badgeIcon.style, {
      fontSize: "14px",
      color: "#fbbf24",
    });

    this.badgeLabel = document.createElement("span");

    this.badge.appendChild(this.badgeIcon);
    this.badge.appendChild(this.badgeLabel);
    document.body.appendChild(this.badge);

    // Toast — oben mitte, slide-down
    this.toast = document.createElement("div");
    Object.assign(this.toast.style, {
      position: "fixed",
      top: "70px",
      left: "50%",
      transform: "translateX(-50%) translateY(-150%)",
      padding: "12px 22px",
      borderRadius: "14px",
      border: "1px solid rgba(255, 200, 100, 0.35)",
      background: "rgba(40, 30, 10, 0.88)",
      backdropFilter: "blur(14px)",
      color: "#fff4d0",
      fontFamily: "system-ui, sans-serif",
      fontSize: "13px",
      fontWeight: "500",
      zIndex: "14",
      pointerEvents: "none",
      opacity: "0",
      transition: "transform 0.4s cubic-bezier(.2,.7,.2,1), opacity 0.3s",
      boxShadow: "0 8px 32px rgba(255, 180, 80, 0.2)",
    });
    document.body.appendChild(this.toast);

    this._toastTimer = null;
  }

  _updateBadge() {
    this.badgeLabel.textContent = `${this.found.size} / ${this.total}`;
    if (this.found.size === this.total) {
      this.badge.style.border = "1px solid #fbbf24";
      this.badge.style.background = "rgba(60, 40, 10, 0.85)";
    }
  }

  /** Wird vom EasterEggs.js gerufen wenn ein neues Egg gefunden wurde. */
  markDiscovered(id, eggTitle) {
    if (this.found.has(id)) return false;   // schon gefunden
    this.found.add(id);
    this._saveFound();
    this._updateBadge();
    this._showToast(eggTitle || t("egg_found"));
    this.game.audio?.playDiscovery?.();
    return true;
  }

  _showToast(msg) {
    clearTimeout(this._toastTimer);
    this.toast.textContent = "✦  " + msg;
    requestAnimationFrame(() => {
      this.toast.style.opacity = "1";
      this.toast.style.transform = "translateX(-50%) translateY(0)";
    });
    this._toastTimer = setTimeout(() => {
      this.toast.style.opacity = "0";
      this.toast.style.transform = "translateX(-50%) translateY(-150%)";
    }, 2800);
  }

  isDiscovered(id) {
    return this.found.has(id);
  }

  destroy() {
    clearTimeout(this._toastTimer);
    this.badge?.remove?.();
    this.toast?.remove?.();
  }
}
