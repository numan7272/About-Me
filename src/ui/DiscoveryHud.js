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
    // Badge bewusst entfernt — kein "X/4" mehr im UI. Eggs sind versteckte
    // Surprises ohne Game-Counter. Toast bleibt für Achievement-Feedback.

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
    // Badge entfernt — siehe _build(). Kept als No-op für API-Kompatibilität.
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
