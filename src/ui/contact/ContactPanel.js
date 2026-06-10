/**
 * ContactPanel — der "Direkt zum Kontakt"-Pfad.
 *
 * Permanenter "Kontakt →"-Button oben rechts. Klick öffnet Side-Panel mit:
 *   - Numan + Standort
 *   - E-Mail (klickbar + Kopieren-Button)
 *   - LinkedIn
 *   - GitHub
 *
 * KEIN CV-Download — Lebenslauf wird auf Anfrage individuell verschickt
 * (DSGVO + saubere Bewerbungspraxis).
 *
 * Schließen: ESC, Klick außerhalb, X-Button.
 */

import { CONTACT, getWalkthroughStrings } from "../../data/stations.js";

const Z_INDEX_BTN = 13;
const Z_INDEX_PANEL = 17;

export class ContactPanel {
  constructor(game) {
    this.game = game;
    this.isOpen = false;

    this._buildButton();
    this._buildPanel();
    this._bindKeys();
  }

  _lang() {
    return (typeof window !== "undefined" && window.__lang) || "de";
  }

  _strings() {
    return getWalkthroughStrings(this._lang());
  }

  _buildButton() {
    this.btn = document.createElement("button");
    this.btn.type = "button";
    this.btn.className = "hud-btn";
    const isMobile = window.matchMedia?.("(max-width: 600px)")?.matches;
    Object.assign(this.btn.style, {
      position: "fixed",
      top: isMobile ? "12px" : "20px",
      right: isMobile ? "12px" : "20px",
      zIndex: String(Z_INDEX_BTN),
      background: "var(--ink-solid)",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    });

    // Caret-Cursor als "available"-Signal. Blinkt langsam, mono-terminal-feel.
    this._heartbeat = document.createElement("span");
    this._heartbeat.textContent = "▌";
    Object.assign(this._heartbeat.style, {
      color: "var(--signal)",
      fontSize: "13px",
      lineHeight: "1",
      animation: "contact-caret-blink 1.8s steps(2, end) infinite",
    });
    this.btn.appendChild(this._heartbeat);

    this._btnLabel = document.createElement("span");
    this.btn.appendChild(this._btnLabel);

    this.btn.addEventListener("click", () => this.toggle());

    document.body.appendChild(this.btn);

    if (!document.getElementById("contact-keyframes")) {
      const style = document.createElement("style");
      style.id = "contact-keyframes";
      style.textContent =
        "@keyframes contact-caret-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0.25; } }";
      document.head.appendChild(style);
    }

    this._updateButtonLabel();
  }

  _updateButtonLabel() {
    const strings = this._strings();
    const raw = strings.contact || "Contact";
    this._btnLabel.textContent = raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  _buildPanel() {
    // ── Backdrop ──
    this.backdrop = document.createElement("div");
    Object.assign(this.backdrop.style, {
      position: "fixed",
      inset: "0",
      zIndex: String(Z_INDEX_PANEL - 1),
      background: "rgba(20, 15, 25, 0.55)",
      opacity: "0",
      pointerEvents: "none",
      transition: "opacity 220ms var(--ease)",
    });
    this.backdrop.addEventListener("click", () => this.close());
    document.body.appendChild(this.backdrop);

    // ── Panel ──
    this.panel = document.createElement("aside");
    this.panel.setAttribute("role", "dialog");
    this.panel.setAttribute("aria-modal", "true");
    this.panel.setAttribute("aria-label", "contact");
    Object.assign(this.panel.style, {
      position: "fixed",
      top: "0",
      right: "0",
      bottom: "0",
      width: "min(420px, 92vw)",
      zIndex: String(Z_INDEX_PANEL),
      background: "var(--surface)",
      borderLeft: "1px solid var(--rule-strong)",
      transform: "translateX(100%)",
      transition: "transform 320ms var(--ease)",
      display: "flex",
      flexDirection: "column",
      padding: "26px 26px 22px",
      fontFamily: "var(--font-ui)",
      color: "var(--paper)",
      overflowY: "auto",
    });
    document.body.appendChild(this.panel);

    this._renderPanelContent();
  }

  _renderPanelContent() {
    this.panel.innerHTML = "";
    const isEn = this._lang() === "en";

    // ── Close-Button ──
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "[ esc ] close";
    closeBtn.setAttribute("aria-label", "close contact panel");
    Object.assign(closeBtn.style, {
      position: "absolute",
      top: "12px",
      right: "12px",
      background: "transparent",
      border: "0",
      color: "var(--paper-muted)",
      fontFamily: "var(--font-mono)",
      fontSize: "11px",
      cursor: "pointer",
      padding: "4px 6px",
      transition: "color 180ms var(--ease)",
    });
    closeBtn.addEventListener("mouseenter", () => {
      closeBtn.style.color = "var(--signal)";
    });
    closeBtn.addEventListener("mouseleave", () => {
      closeBtn.style.color = "var(--paper-muted)";
    });
    closeBtn.addEventListener("click", () => this.close());
    this.panel.appendChild(closeBtn);

    // ── Header ──
    const eyebrow = document.createElement("div");
    eyebrow.className = "hud-kicker";
    eyebrow.textContent = isEn ? "> get in touch" : "> kontakt aufnehmen";
    Object.assign(eyebrow.style, {
      marginBottom: "10px",
      marginTop: "8px",
    });
    this.panel.appendChild(eyebrow);

    const name = document.createElement("div");
    name.textContent = "Numan Yesil";
    Object.assign(name.style, {
      fontFamily: "var(--font-display)",
      fontSize: "42px",
      fontWeight: "700",
      lineHeight: "1.0",
      letterSpacing: "0.02em",
      marginBottom: "4px",
      color: "var(--paper)",
    });
    this.panel.appendChild(name);

    const loc = document.createElement("div");
    loc.textContent = CONTACT.location || "";
    Object.assign(loc.style, {
      fontSize: "14px",
      color: "var(--paper-muted)",
      marginBottom: "20px",
    });
    this.panel.appendChild(loc);

    const rule = document.createElement("hr");
    rule.className = "hud-rule";
    rule.style.margin = "0 0 18px";
    this.panel.appendChild(rule);

    // ── E-Mail-Block ──
    this.panel.appendChild(this._buildEmailRow());

    // ── Buttons-Block ──
    const buttonsWrap = document.createElement("div");
    Object.assign(buttonsWrap.style, {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      marginTop: "16px",
    });

    buttonsWrap.appendChild(this._buildLinkRow({
      label: "linkedin",
      sub: "/in/numan-yesil",
      url: CONTACT.linkedin,
      icon: this._svgLinkedIn(),
    }));
    buttonsWrap.appendChild(this._buildLinkRow({
      label: "github",
      sub: "@numan7272",
      url: CONTACT.github,
      icon: this._svgGitHub(),
    }));
    this.panel.appendChild(buttonsWrap);

    // ── Footer-Hint ──
    const footer = document.createElement("div");
    footer.textContent = isEn
      ? "[ esc ] close · reply usually within a day."
      : "[ esc ] schließen · antwort meist innerhalb eines tages.";
    Object.assign(footer.style, {
      marginTop: "auto",
      paddingTop: "20px",
      fontSize: "11px",
      color: "var(--paper-dim)",
      textAlign: "left",
    });
    this.panel.appendChild(footer);
  }

  _buildEmailRow() {
    const wrap = document.createElement("div");
    Object.assign(wrap.style, {
      display: "flex",
      gap: "8px",
      alignItems: "stretch",
      borderLeft: "2px solid var(--signal)",
      padding: "12px 14px",
      background: "transparent",
    });

    const mailto = document.createElement("a");
    mailto.href = `mailto:${CONTACT.email}`;
    mailto.textContent = CONTACT.email;
    Object.assign(mailto.style, {
      flex: "1",
      fontSize: "14px",
      fontWeight: "400",
      color: "var(--signal)",
      textDecoration: "none",
      lineHeight: "1.4",
      wordBreak: "break-all",
      display: "flex",
      alignItems: "center",
      fontFamily: "var(--font-mono)",
    });
    wrap.appendChild(mailto);

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.textContent = this._lang() === "en" ? "copy" : "kopieren";
    Object.assign(copyBtn.style, {
      padding: "6px 12px",
      border: "1px solid var(--rule-strong)",
      borderRadius: "var(--radius)",
      background: "transparent",
      color: "var(--paper-muted)",
      fontFamily: "var(--font-ui)",
      fontSize: "13px",
      fontWeight: "700",
      cursor: "pointer",
      whiteSpace: "nowrap",
      transition: "color 180ms var(--ease), border-color 180ms var(--ease)",
    });
    copyBtn.addEventListener("mouseenter", () => {
      copyBtn.style.color = "var(--paper)";
      copyBtn.style.borderColor = "var(--paper-muted)";
    });
    copyBtn.addEventListener("mouseleave", () => {
      copyBtn.style.color = "var(--paper-muted)";
      copyBtn.style.borderColor = "var(--rule-strong)";
    });
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(CONTACT.email);
        const original = copyBtn.textContent;
        copyBtn.textContent = "[ ok ]";
        copyBtn.style.color = "var(--signal)";
        copyBtn.style.borderColor = "var(--signal)";
        setTimeout(() => {
          copyBtn.textContent = original;
          copyBtn.style.color = "var(--paper-muted)";
          copyBtn.style.borderColor = "var(--rule-strong)";
        }, 1200);
      } catch (e) {
        console.warn("[Contact] clipboard write failed:", e);
      }
    });
    wrap.appendChild(copyBtn);

    return wrap;
  }

  _buildLinkRow({ label, sub, url, icon }) {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    Object.assign(a.style, {
      display: "flex",
      alignItems: "center",
      gap: "14px",
      padding: "12px 14px",
      border: "1px solid var(--rule)",
      borderRadius: "var(--radius)",
      background: "transparent",
      color: "var(--paper)",
      textDecoration: "none",
      transition: "border-color 180ms var(--ease), color 180ms var(--ease)",
      fontFamily: "var(--font-ui)",
    });
    a.addEventListener("mouseenter", () => {
      a.style.borderColor = "var(--signal)";
    });
    a.addEventListener("mouseleave", () => {
      a.style.borderColor = "var(--rule)";
    });

    const iconWrap = document.createElement("span");
    iconWrap.innerHTML = icon;
    Object.assign(iconWrap.style, {
      width: "20px",
      height: "20px",
      flexShrink: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--paper-muted)",
    });
    a.appendChild(iconWrap);

    const txt = document.createElement("div");
    Object.assign(txt.style, { display: "flex", flexDirection: "column", gap: "1px" });
    const t1 = document.createElement("div");
    t1.textContent = label;
    Object.assign(t1.style, {
      fontSize: "13px",
      fontWeight: "400",
      color: "var(--paper)",
    });
    const t2 = document.createElement("div");
    t2.textContent = sub;
    Object.assign(t2.style, {
      fontSize: "11px",
      color: "var(--paper-muted)",
    });
    txt.appendChild(t1);
    txt.appendChild(t2);
    a.appendChild(txt);

    const arrow = document.createElement("span");
    arrow.textContent = "→";
    Object.assign(arrow.style, {
      marginLeft: "auto",
      color: "var(--paper-dim)",
      fontSize: "14px",
    });
    a.appendChild(arrow);

    return a;
  }

  _svgLinkedIn() {
    return '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M19 3A2 2 0 0 1 21 5V19A2 2 0 0 1 19 21H5A2 2 0 0 1 3 19V5A2 2 0 0 1 5 3H19M18.5 18.5V13.2A3.26 3.26 0 0 0 15.24 9.94C14.39 9.94 13.4 10.46 12.92 11.24V10.13H10.13V18.5H12.92V13.57C12.92 12.8 13.54 12.17 14.31 12.17A1.4 1.4 0 0 1 15.71 13.57V18.5H18.5M6.88 8.56A1.68 1.68 0 0 0 8.56 6.88C8.56 5.95 7.81 5.19 6.88 5.19A1.69 1.69 0 0 0 5.19 6.88C5.19 7.81 5.95 8.56 6.88 8.56M8.27 18.5V10.13H5.5V18.5H8.27Z"/></svg>';
  }

  _svgGitHub() {
    return '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2A10 10 0 0 0 2 12C2 16.42 4.87 20.17 8.84 21.5C9.34 21.58 9.5 21.27 9.5 21C9.5 20.77 9.5 20.14 9.5 19.31C6.73 19.91 6.14 17.97 6.14 17.97C5.68 16.81 5.03 16.5 5.03 16.5C4.12 15.88 5.1 15.9 5.1 15.9C6.1 15.97 6.63 16.93 6.63 16.93C7.5 18.45 8.97 18 9.54 17.76C9.63 17.11 9.89 16.67 10.17 16.42C7.95 16.17 5.62 15.31 5.62 11.5C5.62 10.39 6 9.5 6.65 8.79C6.55 8.54 6.2 7.5 6.75 6.15C6.75 6.15 7.59 5.88 9.5 7.17C10.29 6.95 11.15 6.84 12 6.84C12.85 6.84 13.71 6.95 14.5 7.17C16.41 5.88 17.25 6.15 17.25 6.15C17.8 7.5 17.45 8.54 17.35 8.79C18 9.5 18.38 10.39 18.38 11.5C18.38 15.32 16.04 16.16 13.81 16.41C14.17 16.72 14.5 17.33 14.5 18.26C14.5 19.6 14.5 20.68 14.5 21C14.5 21.27 14.66 21.59 15.17 21.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2Z"/></svg>';
  }

  _bindKeys() {
    this._onKey = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (e.code === "Escape" && this.isOpen) {
        e.preventDefault();
        this.close();
      }
    };
    window.addEventListener("keydown", this._onKey);
  }

  open() {
    this.isOpen = true;
    this.panel.style.transform = "translateX(0%)";
    this.backdrop.style.opacity = "1";
    this.backdrop.style.pointerEvents = "auto";
  }

  close() {
    this.isOpen = false;
    this.panel.style.transform = "translateX(100%)";
    this.backdrop.style.opacity = "0";
    this.backdrop.style.pointerEvents = "none";
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  /** Sprache hat sich geändert → Button-Label + Panel-Content re-rendern */
  refresh() {
    this._updateButtonLabel();
    this._renderPanelContent();
  }

  destroy() {
    window.removeEventListener("keydown", this._onKey);
    this.btn?.remove?.();
    this.panel?.remove?.();
    this.backdrop?.remove?.();
  }
}
