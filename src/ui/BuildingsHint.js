/**
 * BuildingsHint — One-Time-Toast: "Jedes Gebäude ist anklickbar".
 *
 * Brutalist-Game-HUD register:
 *   - Solid ink, hairline signal border-left, kein blur/glow
 *   - Lowercase mono text, "[x] dismiss" affordance
 *
 * Erscheint 6s nach Free-Roam-Start, autodismiss nach 9s, einmalig.
 */

const STORAGE_KEY = "numan-portfolio-buildings-hint-seen-v1";
const SHOW_DELAY_MS = 6000;
const AUTO_HIDE_MS = 9000;

export class BuildingsHint {
  constructor(game) {
    this.game = game;
    this.dom = null;
    this._timer = null;
    this._hideTimer = null;

    if (this._alreadySeen()) return;
    this._timer = setTimeout(() => this._maybeShow(), SHOW_DELAY_MS);
  }

  _alreadySeen() {
    try { return !!localStorage.getItem(STORAGE_KEY); } catch { return false; }
  }

  _markSeen() {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
  }

  _maybeShow() {
    if (this.game?.ui?.walkthrough?.active) {
      this._timer = setTimeout(() => this._maybeShow(), 6000);
      return;
    }
    if (this.game?.ui?.miniGames?.active) {
      this._timer = setTimeout(() => this._maybeShow(), 6000);
      return;
    }
    this._show();
  }

  _show() {
    if (this.dom) return;
    const lang = (typeof window !== "undefined" && window.__lang === "en") ? "en" : "de";
    const text = lang === "en"
      ? "tip. every building on the island is clickable. ride up, tap one."
      : "tipp. jedes gebäude auf der insel ist anklickbar. fahr hin, klick drauf.";

    const root = document.createElement("div");
    root.setAttribute("role", "status");
    Object.assign(root.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      maxWidth: "320px",
      padding: "12px 16px 12px 18px",
      background: "var(--ink-solid)",
      borderLeft: "2px solid var(--signal)",
      color: "var(--paper)",
      fontFamily: "var(--font-mono)",
      fontSize: "12px",
      lineHeight: "1.5",
      zIndex: "15",
      display: "flex",
      gap: "12px",
      alignItems: "flex-start",
      transform: "translateY(-12px)",
      opacity: "0",
      transition: "opacity 320ms var(--ease), transform 320ms var(--ease)",
    });

    const textEl = document.createElement("div");
    textEl.textContent = text;
    textEl.style.flex = "1";
    root.appendChild(textEl);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "[x]";
    closeBtn.setAttribute("aria-label", "dismiss hint");
    Object.assign(closeBtn.style, {
      background: "transparent",
      border: "0",
      color: "var(--paper-muted)",
      fontFamily: "var(--font-mono)",
      fontSize: "11px",
      cursor: "pointer",
      padding: "0 4px",
      transition: "color 180ms var(--ease)",
    });
    closeBtn.addEventListener("mouseenter", () => {
      closeBtn.style.color = "var(--signal)";
    });
    closeBtn.addEventListener("mouseleave", () => {
      closeBtn.style.color = "var(--paper-muted)";
    });
    closeBtn.addEventListener("click", () => this._dismiss());
    root.appendChild(closeBtn);

    const style = document.createElement("style");
    style.textContent = `
      @media (max-width: 640px) {
        [data-bld-hint] {
          top: auto !important;
          bottom: 100px !important;
          right: 14px !important;
          left: 14px !important;
          max-width: none !important;
        }
      }
    `;
    root.dataset.bldHint = "1";
    document.head.appendChild(style);
    this._extraStyle = style;
    document.body.appendChild(root);
    this.dom = root;

    requestAnimationFrame(() => {
      root.style.opacity = "1";
      root.style.transform = "translateY(0)";
    });

    this._hideTimer = setTimeout(() => this._dismiss(), AUTO_HIDE_MS);
  }

  _dismiss() {
    if (!this.dom) return;
    this._markSeen();
    this.dom.style.opacity = "0";
    this.dom.style.transform = "translateY(-12px)";
    const r = this.dom;
    const s = this._extraStyle;
    this.dom = null;
    setTimeout(() => { r?.remove?.(); s?.remove?.(); }, 320);
    clearTimeout(this._hideTimer);
  }

  acknowledge() {
    this._markSeen();
    this._dismiss();
    clearTimeout(this._timer);
  }

  destroy() {
    clearTimeout(this._timer);
    clearTimeout(this._hideTimer);
    this._dismiss();
  }
}
