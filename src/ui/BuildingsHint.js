/**
 * BuildingsHint — One-Time-Toast: "Jedes Gebäude ist anklickbar".
 *
 * Erscheint 6 Sekunden nach dem ersten Mal Free-Roam (also nicht während
 * der Tour, nicht im LoadingSplash). Schließt sich automatisch nach 7 Sekunden
 * oder bei Klick auf X. Wird nur EINMAL pro User gezeigt (localStorage).
 *
 * Trigger zum permanenten Wegblenden:
 *   - User klickt das erste Building → wir merken's
 *   - User klickt den Close-X am Toast
 *   - User klickt "Start Tour" (Tour-Hinweis enthält die Info eh)
 */

const STORAGE_KEY = "numan-portfolio-buildings-hint-seen-v1";
const SHOW_DELAY_MS = 6000;     // 6s nach Init warten
const AUTO_HIDE_MS = 9000;      // 9s sichtbar

export class BuildingsHint {
  constructor(game) {
    this.game = game;
    this.dom = null;
    this._timer = null;
    this._hideTimer = null;

    if (this._alreadySeen()) return;

    // Warte bis Free-Roam (kein LoadingSplash, kein Tour) und zeig dann
    this._timer = setTimeout(() => this._maybeShow(), SHOW_DELAY_MS);
  }

  _alreadySeen() {
    try { return !!localStorage.getItem(STORAGE_KEY); } catch { return false; }
  }

  _markSeen() {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
  }

  _maybeShow() {
    // Nicht zeigen wenn gerade Tour läuft oder ein Mini-Game offen ist
    if (this.game?.ui?.walkthrough?.active) {
      // Warte nochmal 6s
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
      ? "Tip: each building on the island is clickable. Try riding up + tapping one."
      : "Tipp: Jedes Gebäude auf der Insel ist anklickbar. Fahr hin und klick drauf.";

    const closeLabel = lang === "en" ? "Got it" : "Verstanden";
    const root = document.createElement("div");
    root.className = "bld-hint";
    root.innerHTML = `
      <div class="bld-hint-icon">🏢</div>
      <div class="bld-hint-text">${text}</div>
      <button class="bld-hint-close" title="${closeLabel}">✕</button>
    `;
    Object.assign(root.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      maxWidth: "320px",
      padding: "12px 14px",
      paddingRight: "40px",
      background: "rgba(10, 18, 32, 0.92)",
      backdropFilter: "blur(14px)",
      WebkitBackdropFilter: "blur(14px)",
      border: "1px solid rgba(126, 200, 255, 0.35)",
      borderRadius: "10px",
      color: "rgba(240, 245, 250, 0.94)",
      fontSize: "13px",
      lineHeight: "1.4",
      zIndex: "15",
      boxShadow: "0 8px 28px rgba(0, 0, 0, 0.45)",
      display: "flex",
      gap: "10px",
      alignItems: "flex-start",
      fontFamily: "system-ui, -apple-system, sans-serif",
      transform: "translateY(-10px)",
      opacity: "0",
      transition: "opacity 320ms ease, transform 320ms ease",
    });
    // Sub-elements stylen
    const style = document.createElement("style");
    style.textContent = `
      .bld-hint-icon { font-size: 22px; line-height: 1; flex-shrink: 0; }
      .bld-hint-text { flex: 1; }
      .bld-hint-close {
        position: absolute;
        top: 6px; right: 8px;
        background: transparent;
        border: 0;
        color: rgba(220, 230, 240, 0.55);
        font-size: 14px;
        cursor: pointer;
        padding: 4px 6px;
        border-radius: 4px;
        line-height: 1;
      }
      .bld-hint-close:hover {
        background: rgba(255, 255, 255, 0.08);
        color: rgba(240, 245, 250, 0.95);
      }

      /* Auf Mobile etwas anders positionieren — unter MiniMap + Egg-Counter */
      @media (max-width: 640px) {
        .bld-hint {
          top: auto !important;
          bottom: 100px !important;
          right: 14px !important;
          left: 14px !important;
          max-width: none !important;
        }
      }
    `;
    document.head.appendChild(style);
    this._extraStyle = style;
    document.body.appendChild(root);
    this.dom = root;

    requestAnimationFrame(() => {
      root.style.opacity = "1";
      root.style.transform = "translateY(0)";
    });

    root.querySelector(".bld-hint-close").addEventListener("click", () => this._dismiss());
    this._hideTimer = setTimeout(() => this._dismiss(), AUTO_HIDE_MS);
  }

  _dismiss() {
    if (!this.dom) return;
    this._markSeen();
    this.dom.style.opacity = "0";
    this.dom.style.transform = "translateY(-10px)";
    const r = this.dom;
    const s = this._extraStyle;
    this.dom = null;
    setTimeout(() => { r?.remove?.(); s?.remove?.(); }, 320);
    clearTimeout(this._hideTimer);
  }

  /** Wird von EggClickHandler gerufen wenn der User ein Building geklickt hat. */
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
