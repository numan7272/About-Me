/**
 * ContactPanel — der "Direkt zum Kontakt"-Pfad.
 *
 * Vom HR-Recruiter-Audit als überlebenswichtig markiert:
 *   "Permanenter 'Direkt zum Kontakt'-Button oben rechts neben der MiniMap,
 *    sichtbar in jedem Modus. Klick öffnet ein schlankes Side-Panel mit
 *    E-Mail, LinkedIn, GitHub und CV-Download als PDF."
 *
 * Zwei Komponenten in einem File (eng gekoppelt):
 *   - ContactButton  — kleiner Pill-Button oben rechts ("Kontakt →")
 *   - ContactPanel   — Side-Panel das von rechts reinslidet
 *
 * Side-Panel-Inhalte:
 *   - Numan + Standort
 *   - E-Mail (klickbar + Kopieren-Button)
 *   - LinkedIn-Button
 *   - GitHub-Button
 *   - CV-Download (DE + EN, Sprache-abhängig hervorgehoben)
 *
 * Schließen: ESC-Taste, Klick außerhalb, X-Button.
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
    const isMobile = window.matchMedia?.("(max-width: 600px)")?.matches;
    Object.assign(this.btn.style, {
      position: "fixed",
      top: isMobile ? "12px" : "20px",
      right: isMobile ? "12px" : "20px",
      zIndex: String(Z_INDEX_BTN),
      padding: isMobile ? "12px 16px 12px 18px" : "10px 18px 10px 20px",
      borderRadius: "999px",
      border: "1px solid rgba(126, 200, 255, 0.45)",
      background: "linear-gradient(135deg, rgba(126,200,255,0.25), rgba(126,200,255,0.10))",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      color: "rgba(245, 250, 255, 0.96)",
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: "13px",
      fontWeight: "600",
      letterSpacing: "0.02em",
      cursor: "pointer",
      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.35)",
      transition: "background 0.15s, transform 0.15s, box-shadow 0.15s",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    });

    // Heartbeat-Indicator (kleiner pulsierender Dot)
    this._heartbeat = document.createElement("span");
    Object.assign(this._heartbeat.style, {
      width: "8px",
      height: "8px",
      borderRadius: "50%",
      background: "#7ec8ff",
      boxShadow: "0 0 8px rgba(126, 200, 255, 0.9)",
      animation: "contact-pulse 2.2s ease-in-out infinite",
    });
    this.btn.appendChild(this._heartbeat);

    this._btnLabel = document.createElement("span");
    this.btn.appendChild(this._btnLabel);

    this.btn.addEventListener("mouseenter", () => {
      this.btn.style.background = "linear-gradient(135deg, rgba(126,200,255,0.38), rgba(126,200,255,0.18))";
      this.btn.style.transform = "translateY(-1px)";
    });
    this.btn.addEventListener("mouseleave", () => {
      this.btn.style.background = "linear-gradient(135deg, rgba(126,200,255,0.25), rgba(126,200,255,0.10))";
      this.btn.style.transform = "translateY(0)";
    });
    this.btn.addEventListener("click", () => this.toggle());

    document.body.appendChild(this.btn);

    // Pulse-Keyframe injizieren
    if (!document.getElementById("contact-keyframes")) {
      const style = document.createElement("style");
      style.id = "contact-keyframes";
      style.textContent =
        "@keyframes contact-pulse { 0%, 100% { opacity: 0.7; transform: scale(1); } 50% { opacity: 1; transform: scale(1.18); } }";
      document.head.appendChild(style);
    }

    this._updateButtonLabel();
  }

  _updateButtonLabel() {
    const strings = this._strings();
    this._btnLabel.textContent = strings.contact;
  }

  _buildPanel() {
    // ── Backdrop ──
    this.backdrop = document.createElement("div");
    Object.assign(this.backdrop.style, {
      position: "fixed",
      inset: "0",
      zIndex: String(Z_INDEX_PANEL - 1),
      background: "rgba(4, 8, 16, 0.45)",
      backdropFilter: "blur(4px)",
      WebkitBackdropFilter: "blur(4px)",
      opacity: "0",
      pointerEvents: "none",
      transition: "opacity 0.25s",
    });
    this.backdrop.addEventListener("click", () => this.close());
    document.body.appendChild(this.backdrop);

    // ── Panel ──
    this.panel = document.createElement("div");
    Object.assign(this.panel.style, {
      position: "fixed",
      top: "0",
      right: "0",
      bottom: "0",
      width: "min(420px, 92vw)",
      zIndex: String(Z_INDEX_PANEL),
      background: "rgba(8, 14, 26, 0.92)",
      backdropFilter: "blur(18px)",
      WebkitBackdropFilter: "blur(18px)",
      borderLeft: "1px solid rgba(255, 255, 255, 0.12)",
      boxShadow: "-12px 0 36px rgba(0, 0, 0, 0.55)",
      transform: "translateX(100%)",
      transition: "transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1)",
      display: "flex",
      flexDirection: "column",
      padding: "28px 28px 24px 28px",
      fontFamily: "system-ui, -apple-system, sans-serif",
      color: "rgba(240, 245, 250, 0.92)",
      overflowY: "auto",
    });
    document.body.appendChild(this.panel);

    this._renderPanelContent();
  }

  _renderPanelContent() {
    this.panel.innerHTML = "";

    // ── Close-Button ──
    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = "&times;";
    Object.assign(closeBtn.style, {
      position: "absolute",
      top: "16px",
      right: "16px",
      width: "32px",
      height: "32px",
      borderRadius: "50%",
      border: "1px solid rgba(255, 255, 255, 0.14)",
      background: "rgba(255, 255, 255, 0.05)",
      color: "rgba(220, 230, 240, 0.85)",
      fontSize: "20px",
      cursor: "pointer",
      lineHeight: "1",
    });
    closeBtn.addEventListener("click", () => this.close());
    this.panel.appendChild(closeBtn);

    // ── Header ──
    const eyebrow = document.createElement("div");
    eyebrow.textContent = this._lang() === "en" ? "Get in touch" : "Kontakt aufnehmen";
    Object.assign(eyebrow.style, {
      fontSize: "11px",
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      color: "rgba(126, 200, 255, 0.85)",
      marginBottom: "8px",
    });
    this.panel.appendChild(eyebrow);

    const name = document.createElement("div");
    name.textContent = "Numan Yesil";
    Object.assign(name.style, {
      fontSize: "28px",
      fontWeight: "700",
      lineHeight: "1.1",
      marginBottom: "4px",
    });
    this.panel.appendChild(name);

    const loc = document.createElement("div");
    loc.textContent = CONTACT.location;
    Object.assign(loc.style, {
      fontSize: "13px",
      color: "rgba(170, 190, 210, 0.7)",
      marginBottom: "24px",
    });
    this.panel.appendChild(loc);

    // ── E-Mail-Block ──
    this.panel.appendChild(this._buildEmailRow());

    // ── Buttons-Block ──
    const buttonsWrap = document.createElement("div");
    Object.assign(buttonsWrap.style, {
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      marginTop: "20px",
    });

    buttonsWrap.appendChild(this._buildLinkRow({
      label: "LinkedIn",
      sub: "/in/numan-yesil",
      url: CONTACT.linkedin,
      icon: this._svgLinkedIn(),
    }));
    buttonsWrap.appendChild(this._buildLinkRow({
      label: "GitHub",
      sub: "@numan7272",
      url: CONTACT.github,
      icon: this._svgGitHub(),
    }));
    this.panel.appendChild(buttonsWrap);

    // ── CV-Download-Block ──
    const cvHeader = document.createElement("div");
    cvHeader.textContent = this._strings().cv_download;
    Object.assign(cvHeader.style, {
      fontSize: "10px",
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      color: "rgba(170, 190, 210, 0.7)",
      marginTop: "28px",
      marginBottom: "10px",
    });
    this.panel.appendChild(cvHeader);

    const cvRow = document.createElement("div");
    Object.assign(cvRow.style, {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "10px",
    });

    const lang = this._lang();
    const primaryDe = lang === "de";
    cvRow.appendChild(this._buildCvBtn("Lebenslauf · DE", CONTACT.cvDe, primaryDe));
    cvRow.appendChild(this._buildCvBtn("CV · EN", CONTACT.cvEn, !primaryDe));
    this.panel.appendChild(cvRow);

    // ── Footer-Hint ──
    const footer = document.createElement("div");
    footer.textContent = lang === "en"
      ? "Press ESC to close · I usually reply within a day."
      : "ESC zum Schließen · Antwort meistens innerhalb eines Tages.";
    Object.assign(footer.style, {
      marginTop: "auto",
      paddingTop: "20px",
      fontSize: "11px",
      color: "rgba(140, 160, 180, 0.55)",
      textAlign: "center",
    });
    this.panel.appendChild(footer);
  }

  _buildEmailRow() {
    const wrap = document.createElement("div");
    Object.assign(wrap.style, {
      display: "flex",
      gap: "8px",
      alignItems: "stretch",
      background: "rgba(126, 200, 255, 0.08)",
      border: "1px solid rgba(126, 200, 255, 0.28)",
      borderRadius: "12px",
      padding: "12px 14px",
    });

    const mailto = document.createElement("a");
    mailto.href = `mailto:${CONTACT.email}`;
    mailto.textContent = CONTACT.email;
    Object.assign(mailto.style, {
      flex: "1",
      fontSize: "15px",
      fontWeight: "600",
      color: "rgba(126, 200, 255, 0.96)",
      textDecoration: "none",
      lineHeight: "1.4",
      wordBreak: "break-all",
      display: "flex",
      alignItems: "center",
    });
    wrap.appendChild(mailto);

    const copyBtn = document.createElement("button");
    copyBtn.textContent = this._lang() === "en" ? "Copy" : "Kopieren";
    Object.assign(copyBtn.style, {
      padding: "6px 12px",
      borderRadius: "6px",
      border: "1px solid rgba(255, 255, 255, 0.14)",
      background: "rgba(255, 255, 255, 0.04)",
      color: "rgba(220, 230, 240, 0.85)",
      fontSize: "12px",
      cursor: "pointer",
      whiteSpace: "nowrap",
    });
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(CONTACT.email);
        const original = copyBtn.textContent;
        copyBtn.textContent = "✓";
        copyBtn.style.color = "#34d399";
        setTimeout(() => {
          copyBtn.textContent = original;
          copyBtn.style.color = "rgba(220, 230, 240, 0.85)";
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
      borderRadius: "10px",
      border: "1px solid rgba(255, 255, 255, 0.12)",
      background: "rgba(255, 255, 255, 0.04)",
      color: "rgba(240, 245, 250, 0.92)",
      textDecoration: "none",
      transition: "background 0.15s, border-color 0.15s",
    });
    a.addEventListener("mouseenter", () => {
      a.style.background = "rgba(255, 255, 255, 0.10)";
      a.style.borderColor = "rgba(126, 200, 255, 0.35)";
    });
    a.addEventListener("mouseleave", () => {
      a.style.background = "rgba(255, 255, 255, 0.04)";
      a.style.borderColor = "rgba(255, 255, 255, 0.12)";
    });

    const iconWrap = document.createElement("span");
    iconWrap.innerHTML = icon;
    Object.assign(iconWrap.style, {
      width: "22px",
      height: "22px",
      flexShrink: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "rgba(220, 230, 240, 0.82)",
    });
    a.appendChild(iconWrap);

    const txt = document.createElement("div");
    Object.assign(txt.style, { display: "flex", flexDirection: "column", gap: "1px" });
    const t1 = document.createElement("div");
    t1.textContent = label;
    t1.style.fontSize = "14px";
    t1.style.fontWeight = "600";
    const t2 = document.createElement("div");
    t2.textContent = sub;
    t2.style.fontSize = "12px";
    t2.style.color = "rgba(160, 180, 200, 0.7)";
    txt.appendChild(t1);
    txt.appendChild(t2);
    a.appendChild(txt);

    const arrow = document.createElement("span");
    arrow.textContent = "→";
    Object.assign(arrow.style, {
      marginLeft: "auto",
      color: "rgba(170, 190, 210, 0.55)",
      fontSize: "16px",
    });
    a.appendChild(arrow);

    return a;
  }

  _buildCvBtn(label, url, primary) {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.download = "";   // Browser zeigt Save-Dialog statt inline-PDF
    a.textContent = label;
    Object.assign(a.style, {
      padding: "11px 12px",
      borderRadius: "10px",
      textAlign: "center",
      textDecoration: "none",
      fontSize: "13px",
      fontWeight: "600",
      border: primary
        ? "1px solid rgba(126, 200, 255, 0.55)"
        : "1px solid rgba(255, 255, 255, 0.14)",
      background: primary
        ? "linear-gradient(135deg, rgba(126,200,255,0.28), rgba(126,200,255,0.14))"
        : "rgba(255, 255, 255, 0.04)",
      color: primary ? "rgba(245, 250, 255, 0.98)" : "rgba(220, 230, 240, 0.85)",
      transition: "background 0.15s, border-color 0.15s",
    });
    a.addEventListener("mouseenter", () => {
      a.style.background = primary
        ? "linear-gradient(135deg, rgba(126,200,255,0.42), rgba(126,200,255,0.22))"
        : "rgba(255, 255, 255, 0.10)";
    });
    a.addEventListener("mouseleave", () => {
      a.style.background = primary
        ? "linear-gradient(135deg, rgba(126,200,255,0.28), rgba(126,200,255,0.14))"
        : "rgba(255, 255, 255, 0.04)";
    });
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
