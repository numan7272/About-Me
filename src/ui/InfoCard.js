/**
 * InfoCard — Slide-in-Karte am rechten Bildschirmrand mit
 * Werdegang-Station- oder Easter-Egg-Inhalten.
 *
 * Wird gerufen via:
 *   ui.infoCard.show({ title, subtitle, timeframe, text, skills, color, accent })
 *   ui.infoCard.hide()
 */

import { t } from "../data/content.js";

export class InfoCard {
  constructor(game) {
    this.game = game;
    this.visible = false;
    this.currentId = null;
    this._build();
  }

  _build() {
    this.root = document.createElement("div");
    Object.assign(this.root.style, {
      position: "fixed",
      top: "50%",
      right: "24px",
      transform: "translateY(-50%) translateX(120%)",
      width: "360px",
      maxHeight: "82vh",
      overflow: "auto",
      padding: "22px 24px",
      borderRadius: "16px",
      border: "1px solid rgba(255, 255, 255, 0.14)",
      background: "rgba(10, 18, 32, 0.85)",
      backdropFilter: "blur(16px)",
      color: "rgba(240, 245, 250, 0.95)",
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: "13px",
      boxShadow: "0 12px 40px rgba(0, 0, 0, 0.55)",
      zIndex: "13",
      pointerEvents: "auto",
      opacity: "0",
      transition: "transform 0.35s cubic-bezier(.2,.7,.2,1), opacity 0.25s",
    });

    // Close button
    this.closeBtn = document.createElement("button");
    this.closeBtn.innerHTML = "✕";
    Object.assign(this.closeBtn.style, {
      position: "absolute",
      top: "12px",
      right: "12px",
      width: "30px",
      height: "30px",
      borderRadius: "50%",
      border: "1px solid rgba(255, 255, 255, 0.14)",
      background: "rgba(0, 0, 0, 0.3)",
      color: "rgba(220, 230, 240, 0.85)",
      fontSize: "14px",
      cursor: "pointer",
      transition: "background 0.15s",
    });
    this.closeBtn.addEventListener("mouseenter", () => {
      this.closeBtn.style.background = "rgba(255, 80, 80, 0.25)";
    });
    this.closeBtn.addEventListener("mouseleave", () => {
      this.closeBtn.style.background = "rgba(0, 0, 0, 0.3)";
    });
    this.closeBtn.addEventListener("click", () => this.hide());
    this.root.appendChild(this.closeBtn);

    this.accentBar = document.createElement("div");
    Object.assign(this.accentBar.style, {
      width: "40px",
      height: "3px",
      borderRadius: "2px",
      background: "#888",
      marginBottom: "12px",
    });
    this.root.appendChild(this.accentBar);

    this.timeframeEl = document.createElement("div");
    Object.assign(this.timeframeEl.style, {
      fontSize: "10px",
      textTransform: "uppercase",
      letterSpacing: "0.22em",
      color: "rgba(180, 195, 210, 0.7)",
      marginBottom: "6px",
    });
    this.root.appendChild(this.timeframeEl);

    this.titleEl = document.createElement("div");
    Object.assign(this.titleEl.style, {
      fontSize: "20px",
      fontWeight: "600",
      lineHeight: "1.2",
      marginBottom: "4px",
    });
    this.root.appendChild(this.titleEl);

    this.subtitleEl = document.createElement("div");
    Object.assign(this.subtitleEl.style, {
      fontSize: "13px",
      color: "rgba(180, 200, 220, 0.78)",
      marginBottom: "14px",
    });
    this.root.appendChild(this.subtitleEl);

    this.textEl = document.createElement("div");
    Object.assign(this.textEl.style, {
      fontSize: "13px",
      lineHeight: "1.55",
      marginBottom: "16px",
      color: "rgba(230, 235, 240, 0.92)",
    });
    this.root.appendChild(this.textEl);

    this.skillsEl = document.createElement("div");
    Object.assign(this.skillsEl.style, {
      display: "flex",
      flexWrap: "wrap",
      gap: "6px",
    });
    this.root.appendChild(this.skillsEl);

    document.body.appendChild(this.root);
  }

  show(card, id) {
    this.currentId = id;
    this.visible = true;
    const color = card.color || "#7ec8ff";
    const accent = card.accent || color;

    this.accentBar.style.background = `linear-gradient(90deg, ${color}, ${accent})`;
    this.timeframeEl.textContent = card.timeframe || "";
    this.titleEl.textContent = card.title || "";
    this.subtitleEl.textContent = card.subtitle || "";
    this.textEl.textContent = card.text || "";

    this.skillsEl.innerHTML = "";
    for (const s of (card.skills || [])) {
      const chip = document.createElement("span");
      chip.textContent = s;
      Object.assign(chip.style, {
        padding: "4px 10px",
        borderRadius: "999px",
        fontSize: "11px",
        border: `1px solid ${color}40`,
        background: `${color}15`,
        color: "rgba(240, 245, 250, 0.95)",
      });
      this.skillsEl.appendChild(chip);
    }

    requestAnimationFrame(() => {
      this.root.style.opacity = "1";
      this.root.style.transform = "translateY(-50%) translateX(0)";
    });

    this.game.audio?.playInfoOpen?.();
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.currentId = null;
    this.root.style.opacity = "0";
    this.root.style.transform = "translateY(-50%) translateX(120%)";
    this.game.audio?.playInfoClose?.();
  }

  destroy() {
    this.root?.remove?.();
  }
}
