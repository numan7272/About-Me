/**
 * InfoCard — Slide-in-Panel rechts mit Werdegang- / Easter-Egg-Inhalten.
 *
 * Hybrid-Register:
 *   - Warme runde Karte, Hairlines, Station-Akzent links
 *   - Titel im Display-Font, Body warm/rund
 *   - Skills bleiben terminal-style `> tag` items (Mono-Erbe), keine Pills
 *
 * Public API:
 *   ui.infoCard.show({ title, subtitle, timeframe, text, skills }, id)
 *   ui.infoCard.hide()
 */

export class InfoCard {
  constructor(game) {
    this.game = game;
    this.visible = false;
    this.currentId = null;
    this._build();
    this._bindKeys();
  }

  _build() {
    // InfoCard ist ein Lese-Moment (Werdegang, Egg-Story). Bekommt die
    // Paper-Surface analog zu den 3D-Labels. Dunkle Tinte auf Cream,
    // Variety gegenüber dem ink-basierten HUD. Station-Akzent als 3px
    // links (wird in show() pro Karte gesetzt).
    this.root = document.createElement("aside");
    this.root.className = "hud-bracket paper";
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-labelledby", "info-card-title");
    this.root.setAttribute("aria-hidden", "true");
    Object.assign(this.root.style, {
      position: "fixed",
      top: "50%",
      right: "24px",
      transform: "translateY(-50%) translateX(calc(100% + 48px))",
      width: "min(380px, calc(100vw - 32px))",
      maxHeight: "82vh",
      overflow: "auto",
      padding: "22px 24px 20px",
      fontFamily: "var(--font-ui)",
      fontSize: "14px",
      color: "var(--ink-text)",
      zIndex: "13",
      pointerEvents: "auto",
      opacity: "0",
      transition: "transform 340ms var(--ease), opacity 220ms var(--ease)",
      borderLeft: "3px solid transparent",
    });
    this.root.append(this._cornerSpan("tr"), this._cornerSpan("bl"));

    this.closeBtn = document.createElement("button");
    this.closeBtn.type = "button";
    this.closeBtn.textContent = "[ esc ] close";
    this.closeBtn.setAttribute("aria-label", "close info card");
    Object.assign(this.closeBtn.style, {
      position: "absolute",
      top: "10px",
      right: "12px",
      background: "transparent",
      border: "0",
      color: "var(--ink-text-muted)",
      fontFamily: "var(--font-mono)",
      fontSize: "11px",
      cursor: "pointer",
      padding: "4px 6px",
      transition: "color 180ms var(--ease)",
    });
    this.closeBtn.addEventListener("mouseenter", () => {
      this.closeBtn.style.color = "var(--signal)";
    });
    this.closeBtn.addEventListener("mouseleave", () => {
      this.closeBtn.style.color = "var(--ink-text-muted)";
    });
    this.closeBtn.addEventListener("click", () => this.hide());
    this.root.appendChild(this.closeBtn);

    this.timeframeEl = document.createElement("div");
    this.timeframeEl.className = "hud-kicker";
    Object.assign(this.timeframeEl.style, {
      marginBottom: "10px",
      marginTop: "8px",
    });
    this.root.appendChild(this.timeframeEl);

    this.titleEl = document.createElement("div");
    this.titleEl.id = "info-card-title";
    Object.assign(this.titleEl.style, {
      fontFamily: "var(--font-display)",
      fontSize: "34px",
      fontWeight: "700",
      lineHeight: "1.05",
      marginBottom: "4px",
      letterSpacing: "0.02em",
      color: "var(--ink-text)",
    });
    this.root.appendChild(this.titleEl);

    this.subtitleEl = document.createElement("div");
    Object.assign(this.subtitleEl.style, {
      fontSize: "14px",
      color: "var(--ink-text-muted)",
      marginBottom: "14px",
    });
    this.root.appendChild(this.subtitleEl);

    const rule = document.createElement("hr");
    Object.assign(rule.style, {
      height: "1px",
      background: "var(--ink-rule)",
      border: "0",
      margin: "0 0 14px",
    });
    this.root.appendChild(rule);

    this.textEl = document.createElement("div");
    Object.assign(this.textEl.style, {
      fontSize: "14px",
      lineHeight: "1.6",
      marginBottom: "18px",
      color: "var(--ink-text)",
    });
    this.root.appendChild(this.textEl);

    this.skillsEl = document.createElement("ul");
    Object.assign(this.skillsEl.style, {
      listStyle: "none",
      padding: "0",
      margin: "0",
      display: "flex",
      flexDirection: "column",
      gap: "3px",
    });
    this.root.appendChild(this.skillsEl);

    document.body.appendChild(this.root);
  }

  _bindKeys() {
    this._onKey = (e) => {
      if (e.code === "Escape" && this.visible) this.hide();
    };
    window.addEventListener("keydown", this._onKey);
  }

  _cornerSpan(corner) {
    const s = document.createElement("span");
    s.className = `hud-bracket-${corner}`;
    return s;
  }

  show(card, id) {
    this.currentId = id;
    this.visible = true;
    this.root.setAttribute("aria-hidden", "false");

    // Station-Akzent als 3px linker Identitäts-Stripe. Fallback signal.
    const accent = card.accent || card.color || "var(--signal)";
    this.root.style.borderLeftColor = accent;

    this.timeframeEl.textContent = card.timeframe || "";
    this.titleEl.textContent = card.title || "";
    this.subtitleEl.textContent = card.subtitle || "";
    this.textEl.textContent = card.text || "";

    this.skillsEl.innerHTML = "";
    for (const s of (card.skills || [])) {
      const li = document.createElement("li");
      Object.assign(li.style, {
        fontSize: "12px",
        color: "var(--ink-text-muted)",
        fontFamily: "var(--font-mono)",
        lineHeight: "1.55",
      });
      li.textContent = `> ${s}`;
      this.skillsEl.appendChild(li);
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
    this.root.setAttribute("aria-hidden", "true");
    this.root.style.opacity = "0";
    this.root.style.transform =
      "translateY(-50%) translateX(calc(100% + 48px))";
    this.game.audio?.playInfoClose?.();
  }

  destroy() {
    window.removeEventListener("keydown", this._onKey);
    this.root?.remove?.();
  }
}
