/**
 * BottomDrawer — persistentes DOM-Overlay am unteren Rand.
 *
 * Vom HR-Recruiter-Audit als Pop-up-Ersatz spezifiziert:
 *   "Persistenter Bottom-Drawer, halbtransparent mit Backdrop-Blur,
 *    Links: Stationsname + Zeitraum,
 *    Mitte: 2-3 Kern-Statements (drei Klick-Stufen),
 *    Rechts: Weiter-Button."
 *
 * Drei Step-Stufen pro Station:
 *   1) "Was" — Title + Subtitle + Headline
 *   2) "Konkret gemacht" — Bullet-Liste der Aufgaben
 *   3) "Tech & Skills" — Skill-Chips
 *
 * Public API:
 *   drawer.show(station)        — komplette Station rein
 *   drawer.nextStep()           — von 1 → 2 → 3, gibt true zurück solange
 *                                 noch Steps übrig
 *   drawer.prevStep()           — analog rückwärts
 *   drawer.hide()
 *   drawer.onNext = (cb) =>     — callback wenn user "Weiter" drückt UND
 *                                 alle 3 Steps durch sind (Station fertig)
 *   drawer.onPrev = (cb) =>
 *   drawer.onSkip = (cb) =>
 */

import { getWalkthroughStrings } from "../../data/stations.js";

const Z_INDEX = 14;

export class BottomDrawer {
  constructor(game) {
    this.game = game;
    this.station = null;
    this.step = 0;          // 0..2 entspricht "what", "how", "stack"
    this.visible = false;

    this.onNext = null;     // fires beim letzten Step "Weiter" (Station-Done)
    this.onPrev = null;     // analog
    this.onSkip = null;
    this.onStepChange = null;

    this._buildUI();
  }

  _lang() {
    return (typeof window !== "undefined" && window.__lang) || "de";
  }

  _strings() {
    return getWalkthroughStrings(this._lang());
  }

  _buildUI() {
    this.root = document.createElement("div");
    Object.assign(this.root.style, {
      position: "fixed",
      left: "0",
      right: "0",
      bottom: "0",
      zIndex: String(Z_INDEX),
      padding: "0 16px 16px 16px",
      pointerEvents: "none",       // Container ist click-through, nur Panel fängt
      fontFamily: "system-ui, -apple-system, sans-serif",
      color: "rgba(240, 245, 250, 0.92)",
      transition: "transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.25s",
      transform: "translateY(110%)",
      opacity: "0",
    });

    this.panel = document.createElement("div");
    Object.assign(this.panel.style, {
      maxWidth: "1080px",
      margin: "0 auto",
      pointerEvents: "auto",
      background: "rgba(8, 14, 26, 0.78)",
      backdropFilter: "blur(14px)",
      WebkitBackdropFilter: "blur(14px)",
      border: "1px solid rgba(255, 255, 255, 0.12)",
      borderRadius: "16px",
      boxShadow: "0 16px 40px rgba(0, 0, 0, 0.5)",
      display: "grid",
      gridTemplateColumns: "minmax(160px, 220px) 1fr minmax(140px, 200px)",
      gap: "20px",
      padding: "18px 22px",
      alignItems: "center",
    });

    // ── Left: Station-Identifier ──
    this.leftCol = document.createElement("div");
    Object.assign(this.leftCol.style, {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
    });

    this.stepDots = document.createElement("div");
    Object.assign(this.stepDots.style, {
      display: "flex",
      gap: "6px",
      marginBottom: "4px",
    });
    this.leftCol.appendChild(this.stepDots);

    this.stationLabel = document.createElement("div");
    Object.assign(this.stationLabel.style, {
      fontSize: "11px",
      letterSpacing: "0.16em",
      textTransform: "uppercase",
      color: "rgba(170, 190, 210, 0.7)",
    });
    this.leftCol.appendChild(this.stationLabel);

    this.stationTitle = document.createElement("div");
    Object.assign(this.stationTitle.style, {
      fontSize: "15px",
      fontWeight: "700",
      lineHeight: "1.25",
      color: "rgba(240, 245, 250, 0.96)",
    });
    this.leftCol.appendChild(this.stationTitle);

    this.stationTimeframe = document.createElement("div");
    Object.assign(this.stationTimeframe.style, {
      fontSize: "12px",
      color: "rgba(160, 180, 200, 0.7)",
    });
    this.leftCol.appendChild(this.stationTimeframe);

    this.panel.appendChild(this.leftCol);

    // ── Center: Content für aktuellen Step ──
    this.center = document.createElement("div");
    Object.assign(this.center.style, {
      minHeight: "70px",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      justifyContent: "center",
    });
    this.panel.appendChild(this.center);

    // ── Right: Nav-Buttons ──
    this.rightCol = document.createElement("div");
    Object.assign(this.rightCol.style, {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      alignItems: "stretch",
    });

    this.btnNext = this._makePrimaryBtn();
    this.btnNext.addEventListener("click", () => this._handleNextClick());
    this.rightCol.appendChild(this.btnNext);

    const navRow = document.createElement("div");
    Object.assign(navRow.style, {
      display: "flex",
      gap: "8px",
    });
    this.btnPrev = this._makeSecondaryBtn();
    this.btnPrev.addEventListener("click", () => this._handlePrevClick());
    this.btnSkip = this._makeSecondaryBtn();
    this.btnSkip.addEventListener("click", () => this._handleSkipClick());
    navRow.appendChild(this.btnPrev);
    navRow.appendChild(this.btnSkip);
    this.rightCol.appendChild(navRow);

    this.panel.appendChild(this.rightCol);

    this.root.appendChild(this.panel);
    document.body.appendChild(this.root);

    // Mobile-Anpassung: Layout in Spalten brechen
    this._mq = window.matchMedia("(max-width: 720px)");
    this._applyResponsive();
    this._onResize = () => this._applyResponsive();
    if (this._mq.addEventListener) this._mq.addEventListener("change", this._onResize);
    else this._mq.addListener?.(this._onResize);
  }

  _makePrimaryBtn() {
    const b = document.createElement("button");
    Object.assign(b.style, {
      padding: "13px 20px",
      minHeight: "44px",          // WCAG Touch-Target
      borderRadius: "10px",
      border: "1px solid rgba(126, 200, 255, 0.45)",
      background: "linear-gradient(135deg, rgba(126,200,255,0.22), rgba(126,200,255,0.10))",
      color: "rgba(240, 245, 250, 0.98)",
      fontSize: "14px",
      fontWeight: "600",
      cursor: "pointer",
      transition: "background 0.15s, transform 0.1s",
    });
    b.addEventListener("mouseenter", () => {
      b.style.background = "linear-gradient(135deg, rgba(126,200,255,0.35), rgba(126,200,255,0.18))";
    });
    b.addEventListener("mouseleave", () => {
      b.style.background = "linear-gradient(135deg, rgba(126,200,255,0.22), rgba(126,200,255,0.10))";
    });
    return b;
  }

  _makeSecondaryBtn() {
    const b = document.createElement("button");
    Object.assign(b.style, {
      flex: "1",
      padding: "11px 14px",
      minHeight: "44px",          // WCAG Touch-Target
      borderRadius: "8px",
      border: "1px solid rgba(255, 255, 255, 0.14)",
      background: "rgba(255, 255, 255, 0.04)",
      color: "rgba(220, 230, 240, 0.82)",
      fontSize: "12px",
      cursor: "pointer",
      transition: "background 0.15s",
    });
    b.addEventListener("mouseenter", () => {
      b.style.background = "rgba(255, 255, 255, 0.12)";
    });
    b.addEventListener("mouseleave", () => {
      b.style.background = "rgba(255, 255, 255, 0.04)";
    });
    return b;
  }

  _applyResponsive() {
    if (this._mq.matches) {
      // Mobile: 1-Spalten-Layout + 120px Bottom-Abstand für Brake-Button/Joystick
      this.root.style.padding = "0 12px 130px 12px";
      this.panel.style.gridTemplateColumns = "1fr";
      this.panel.style.gap = "12px";
      this.panel.style.padding = "14px 16px";
      this.leftCol.style.flexDirection = "row";
      this.leftCol.style.flexWrap = "wrap";
      this.leftCol.style.alignItems = "baseline";
      this.leftCol.style.gap = "8px";
      this.center.style.minHeight = "auto";
    } else {
      this.root.style.padding = "0 16px 16px 16px";
      this.panel.style.gridTemplateColumns = "minmax(160px, 220px) 1fr minmax(140px, 200px)";
      this.panel.style.gap = "20px";
      this.panel.style.padding = "18px 22px";
      this.leftCol.style.flexDirection = "column";
      this.leftCol.style.flexWrap = "nowrap";
      this.leftCol.style.gap = "6px";
      this.center.style.minHeight = "70px";
    }
  }

  show(station) {
    this.station = station;
    this.step = 0;
    this._endCardMode = false;
    this._render();
    requestAnimationFrame(() => {
      this.root.style.transform = "translateY(0%)";
      this.root.style.opacity = "1";
    });
    this.visible = true;
  }

  /**
   * Spezial-Modus für Tour-Ende: Full-Width-Card statt Step-Layout.
   * Wird vom WalkthroughController nach der HQ-Station aufgerufen.
   *
   * @param {{ onContact: fn, onRestart: fn, onClose: fn }} handlers
   */
  showEndCard(handlers = {}) {
    this.station = null;
    this.step = 0;
    this._endCardMode = true;
    this._endHandlers = handlers;
    this._renderEndCard();
    requestAnimationFrame(() => {
      this.root.style.transform = "translateY(0%)";
      this.root.style.opacity = "1";
    });
    this.visible = true;
  }

  hide() {
    this.root.style.transform = "translateY(110%)";
    this.root.style.opacity = "0";
    this.visible = false;
  }

  goToStep(step) {
    this.step = Math.max(0, Math.min(2, step));
    this._render();
  }

  /** True = step advanced internally; False = was at final step → caller should advance station */
  nextStep() {
    if (this.step < 2) {
      this.step++;
      this._render();
      return true;
    }
    return false;
  }

  prevStep() {
    if (this.step > 0) {
      this.step--;
      this._render();
      return true;
    }
    return false;
  }

  _handleNextClick() {
    const advanced = this.nextStep();
    if (advanced) {
      this.onStepChange?.(this.step);
    } else {
      // Letzter Step → Station-Done, Controller entscheidet was passiert
      this.onNext?.();
    }
  }

  _handlePrevClick() {
    const went = this.prevStep();
    if (went) {
      this.onStepChange?.(this.step);
    } else {
      // Erster Step → Controller entscheidet (z.B. zur vorigen Station)
      this.onPrev?.();
    }
  }

  _handleSkipClick() {
    this.onSkip?.();
  }

  _render() {
    if (!this.station) return;
    const s = this.station;
    const strings = this._strings();
    const accent = s.accent || s.color || "#7ec8ff";

    // Layout zurücksetzen falls wir vorher in End-Card-Modus waren
    this._applyResponsive();
    this.panel.style.textAlign = "";

    // Linke/Center/Right-Col leeren — wir bauen sie unten neu auf.
    // Wichtig: nicht aus der DOM lösen, nur Inhalte clearen.
    this.leftCol.innerHTML = "";
    this.center.innerHTML = "";
    this.rightCol.innerHTML = "";

    // Step-Dots wieder anhängen (waren initial in leftCol)
    this.leftCol.appendChild(this.stepDots);
    this.leftCol.appendChild(this.stationLabel);
    this.leftCol.appendChild(this.stationTitle);
    this.leftCol.appendChild(this.stationTimeframe);
    this.rightCol.appendChild(this.btnNext);
    const navRow = document.createElement("div");
    Object.assign(navRow.style, { display: "flex", gap: "8px" });
    navRow.appendChild(this.btnPrev);
    navRow.appendChild(this.btnSkip);
    this.rightCol.appendChild(navRow);

    // Step-Dots
    this.stepDots.innerHTML = "";
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement("span");
      Object.assign(dot.style, {
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        background: i === this.step ? accent : "rgba(255,255,255,0.18)",
        transition: "background 0.18s",
      });
      this.stepDots.appendChild(dot);
    }

    this.stationLabel.textContent = s.subtitle || "";
    this.stationLabel.style.color = accent;
    this.stationTitle.textContent = s.title || "";
    this.stationTimeframe.textContent = s.timeframe || "";

    // Center-Content je nach Step
    this.center.innerHTML = "";
    if (this.step === 0) {
      this._renderWhat(s, strings);
    } else if (this.step === 1) {
      this._renderHow(s, strings);
    } else {
      this._renderStack(s, strings);
    }

    // Button-Labels
    const isLastStep = this.step === 2;
    this.btnNext.textContent = isLastStep ? strings.next + " →" : strings.next;
    this.btnPrev.textContent = "← " + strings.prev;
    this.btnSkip.textContent = strings.skip;
  }

  _stepHeader(text, color) {
    const h = document.createElement("div");
    h.textContent = text;
    Object.assign(h.style, {
      fontSize: "10px",
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      color: color || "rgba(170, 190, 210, 0.7)",
    });
    return h;
  }

  _renderWhat(s, strings) {
    this.center.appendChild(this._stepHeader(strings.step_what, s.color));
    const headline = document.createElement("div");
    headline.textContent = s.headline || "";
    Object.assign(headline.style, {
      fontSize: "17px",
      fontWeight: "600",
      lineHeight: "1.4",
      color: "rgba(245, 250, 255, 0.96)",
    });
    this.center.appendChild(headline);
  }

  _renderHow(s, strings) {
    this.center.appendChild(this._stepHeader(strings.step_how, s.color));
    const list = document.createElement("ul");
    Object.assign(list.style, {
      margin: "0",
      padding: "0",
      listStyle: "none",
      display: "flex",
      flexDirection: "column",
      gap: "5px",
    });
    for (const bullet of (s.bullets || []).slice(0, 4)) {
      const li = document.createElement("li");
      Object.assign(li.style, {
        fontSize: "13.5px",
        lineHeight: "1.45",
        paddingLeft: "16px",
        position: "relative",
        color: "rgba(225, 235, 245, 0.9)",
      });
      const dot = document.createElement("span");
      Object.assign(dot.style, {
        position: "absolute",
        left: "0",
        top: "9px",
        width: "6px",
        height: "6px",
        borderRadius: "50%",
        background: s.accent || s.color || "#7ec8ff",
      });
      li.appendChild(dot);
      li.appendChild(document.createTextNode(bullet));
      list.appendChild(li);
    }
    this.center.appendChild(list);
  }

  _renderStack(s, strings) {
    this.center.appendChild(this._stepHeader(strings.step_stack, s.color));
    const wrap = document.createElement("div");
    Object.assign(wrap.style, {
      display: "flex",
      flexWrap: "wrap",
      gap: "6px",
    });
    for (const skill of (s.skills || [])) {
      const chip = document.createElement("span");
      chip.textContent = skill;
      Object.assign(chip.style, {
        fontSize: "12.5px",
        padding: "5px 10px",
        borderRadius: "999px",
        border: `1px solid ${s.accent || s.color}55`,
        background: `${s.color || "#7ec8ff"}1a`,
        color: "rgba(240, 250, 255, 0.92)",
      });
      wrap.appendChild(chip);
    }
    this.center.appendChild(wrap);
  }

  _renderEndCard() {
    const lang = this._lang();
    const isEn = lang === "en";

    // Layout temporär auf Single-Column umstellen damit die Card mittig wirkt
    this.panel.style.gridTemplateColumns = "1fr";
    this.panel.style.gap = "16px";
    this.panel.style.padding = "22px 28px";
    this.panel.style.textAlign = "center";

    // Spalten leeren
    this.leftCol.innerHTML = "";
    this.center.innerHTML = "";
    this.rightCol.innerHTML = "";

    // Eyebrow
    const eyebrow = document.createElement("div");
    eyebrow.textContent = isEn ? "End of tour" : "Ende der Tour";
    Object.assign(eyebrow.style, {
      fontSize: "11px",
      letterSpacing: "0.22em",
      textTransform: "uppercase",
      color: "rgba(126, 200, 255, 0.85)",
    });
    this.leftCol.appendChild(eyebrow);

    // Headline
    const title = document.createElement("div");
    title.textContent = isEn
      ? "Let's talk."
      : "Lass uns sprechen.";
    Object.assign(title.style, {
      fontSize: "22px",
      fontWeight: "700",
      lineHeight: "1.2",
      color: "rgba(245, 250, 255, 0.98)",
    });
    this.leftCol.appendChild(title);

    // Body — generischer Ton, nicht auf einen Job-Typ festgelegt.
    const body = document.createElement("div");
    body.textContent = isEn
      ? "Thanks for taking the tour. If you think I'd fit your team — for an internship, working-student role, or project — drop me a line. I usually reply within a day."
      : "Danke fürs Durchklicken. Wenn du denkst ich passe in dein Team — ob Praktikum, Werkstudentenstelle oder Projekt — schreib mir gerne. Antwort meistens innerhalb eines Tages.";
    Object.assign(body.style, {
      fontSize: "13.5px",
      lineHeight: "1.55",
      color: "rgba(220, 230, 240, 0.85)",
      maxWidth: "640px",
      margin: "0 auto",
    });
    this.center.appendChild(body);

    // Buttons
    const btnWrap = document.createElement("div");
    Object.assign(btnWrap.style, {
      display: "flex",
      justifyContent: "center",
      gap: "10px",
      flexWrap: "wrap",
    });

    const btnContact = document.createElement("button");
    btnContact.textContent = (isEn ? "Open contact" : "Kontakt öffnen") + " →";
    Object.assign(btnContact.style, {
      padding: "11px 22px",
      borderRadius: "10px",
      border: "1px solid rgba(126, 200, 255, 0.55)",
      background: "linear-gradient(135deg, rgba(126,200,255,0.30), rgba(126,200,255,0.14))",
      color: "rgba(245, 250, 255, 0.98)",
      fontSize: "14px",
      fontWeight: "600",
      cursor: "pointer",
      transition: "background 0.15s",
    });
    btnContact.addEventListener("mouseenter", () => {
      btnContact.style.background = "linear-gradient(135deg, rgba(126,200,255,0.45), rgba(126,200,255,0.22))";
    });
    btnContact.addEventListener("mouseleave", () => {
      btnContact.style.background = "linear-gradient(135deg, rgba(126,200,255,0.30), rgba(126,200,255,0.14))";
    });
    btnContact.addEventListener("click", () => this._endHandlers?.onContact?.());
    btnWrap.appendChild(btnContact);

    const btnRestart = this._makeSecondaryBtn();
    btnRestart.textContent = isEn ? "Replay tour" : "Tour erneut";
    btnRestart.style.flex = "0 1 auto";
    btnRestart.addEventListener("click", () => this._endHandlers?.onRestart?.());
    btnWrap.appendChild(btnRestart);

    const btnClose = this._makeSecondaryBtn();
    btnClose.textContent = isEn ? "Explore freely" : "Frei erkunden";
    btnClose.style.flex = "0 1 auto";
    btnClose.addEventListener("click", () => this._endHandlers?.onClose?.());
    btnWrap.appendChild(btnClose);

    this.rightCol.appendChild(btnWrap);
  }

  destroy() {
    if (this._mq.removeEventListener) {
      this._mq.removeEventListener("change", this._onResize);
    } else {
      this._mq.removeListener?.(this._onResize);
    }
    this.root?.remove?.();
  }
}
