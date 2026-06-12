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
      fontFamily: "var(--font-ui)",
      color: "var(--paper)",
      transition: "transform 280ms var(--ease), opacity 200ms var(--ease)",
      transform: "translateY(110%)",
      opacity: "0",
    });

    this.panel = document.createElement("div");
    this.panel.className = "hud-bracket";
    Object.assign(this.panel.style, {
      maxWidth: "1080px",
      margin: "0 auto",
      pointerEvents: "auto",
      background: "var(--ink-solid)",
      color: "var(--paper)",
      display: "grid",
      gridTemplateColumns: "minmax(160px, 220px) 1fr minmax(140px, 200px)",
      gap: "20px",
      padding: "16px 20px",
      alignItems: "center",
      // Station-Color-Identity-Stripe links — wird in _render() pro Station
      // gesetzt. Bringt Farbe zurück in den Tour-Drawer, ohne Gradient-Bombast.
      borderLeft: "3px solid transparent",
      transition: "border-color 220ms var(--ease)",
    });
    const cornerTr = document.createElement("span");
    cornerTr.className = "hud-bracket-tr";
    const cornerBl = document.createElement("span");
    cornerBl.className = "hud-bracket-bl";
    this.panel.append(cornerTr, cornerBl);

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
      color: "var(--paper-muted)",
    });
    this.leftCol.appendChild(this.stationLabel);

    this.stationTitle = document.createElement("div");
    Object.assign(this.stationTitle.style, {
      fontSize: "16px",
      fontWeight: "400",
      lineHeight: "1.25",
      letterSpacing: "-0.01em",
      color: "var(--paper)",
    });
    this.leftCol.appendChild(this.stationTitle);

    this.stationTimeframe = document.createElement("div");
    Object.assign(this.stationTimeframe.style, {
      fontSize: "11px",
      color: "var(--paper-dim)",
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
    b.type = "button";
    Object.assign(b.style, {
      padding: "12px 16px",
      minHeight: "44px",
      border: "1px solid var(--signal)",
      borderRadius: "var(--radius)",
      background: "transparent",
      color: "var(--signal)",
      fontFamily: "var(--font-ui)",
      fontSize: "15px",
      fontWeight: "700",
      cursor: "pointer",
      transition: "background 180ms var(--ease)",
    });
    b.addEventListener("mouseenter", () => {
      b.style.background = "var(--signal-dim)";
    });
    b.addEventListener("mouseleave", () => {
      b.style.background = "transparent";
    });
    return b;
  }

  _makeSecondaryBtn() {
    const b = document.createElement("button");
    b.type = "button";
    Object.assign(b.style, {
      flex: "1",
      padding: "10px 12px",
      minHeight: "44px",
      border: "1px solid var(--rule-strong)",
      borderRadius: "var(--radius)",
      background: "transparent",
      color: "var(--paper-muted)",
      fontFamily: "var(--font-ui)",
      fontSize: "14px",
      fontWeight: "700",
      cursor: "pointer",
      transition: "color 180ms var(--ease), border-color 180ms var(--ease)",
    });
    b.addEventListener("mouseenter", () => {
      b.style.color = "var(--paper)";
      b.style.borderColor = "var(--paper-muted)";
    });
    b.addEventListener("mouseleave", () => {
      b.style.color = "var(--paper-muted)";
      b.style.borderColor = "var(--rule-strong)";
    });
    return b;
  }

  _applyResponsive() {
    if (this._mq.matches) {
      // Mobile compact: gekürzte Bullets (max 3 single-line) passen jetzt
      // ohne Scroll in den Drawer. Padding-Bottom 64px reicht (in-world
      // Joystick stört nicht). Drawer-Höhe nicht mehr gecappt → kein Scroll.
      this.root.style.padding = "0 10px 64px 10px";
      this.panel.style.gridTemplateColumns = "1fr";
      this.panel.style.gap = "8px";
      this.panel.style.padding = "10px 14px 10px";
      this.panel.style.maxHeight = "";
      this.panel.style.overflowY = "visible";
      this.leftCol.style.display = "flex";
      this.leftCol.style.flexDirection = "row";
      this.leftCol.style.flexWrap = "wrap";
      this.leftCol.style.alignItems = "baseline";
      this.leftCol.style.gap = "8px";
      this.center.style.minHeight = "auto";
      if (this.rightCol) {
        this.rightCol.style.flexDirection = "row-reverse";
        this.rightCol.style.gap = "6px";
        this.rightCol.style.alignItems = "stretch";
      }
    } else {
      this.root.style.padding = "0 16px 16px 16px";
      this.panel.style.gridTemplateColumns = "minmax(160px, 220px) 1fr minmax(140px, 200px)";
      this.panel.style.gap = "20px";
      this.panel.style.padding = "18px 22px";
      this.panel.style.maxHeight = "";
      this.panel.style.overflowY = "";
      this.leftCol.style.flexDirection = "column";
      this.leftCol.style.flexWrap = "nowrap";
      this.leftCol.style.gap = "6px";
      this.center.style.minHeight = "70px";
      if (this.rightCol) {
        this.rightCol.style.flexDirection = "column";
        this.rightCol.style.gap = "8px";
      }
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

    // Station-Color als linker Identity-Stripe + im Step-Counter wieder
    // erkennbar (statt komplettem Mono-Einheitsbrei).
    this.panel.style.borderLeftColor = accent;

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

    // Step-Indikator: bunte Zahl + muted Total. Aktuelle Schritt-Zahl in
    // Station-Akzent, damit die Identity-Stripe nicht alleine steht.
    this.stepDots.innerHTML = "";
    Object.assign(this.stepDots.style, {
      fontSize: "11px",
      color: "var(--paper-muted)",
      fontVariantNumeric: "tabular-nums",
      marginBottom: "2px",
      display: "flex",
      gap: "2px",
    });
    const curNum = document.createElement("span");
    curNum.textContent = String(this.step + 1).padStart(2, "0");
    curNum.style.color = accent;
    const totalNum = document.createElement("span");
    totalNum.textContent = " / 03";
    this.stepDots.append(curNum, totalNum);

    this.stationLabel.textContent = `> ${(s.subtitle || "").toLowerCase()}`;
    this.stationLabel.style.color = "var(--paper-muted)";
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
    this.btnNext.textContent = isLastStep
      ? `${strings.next.toLowerCase()}  →`
      : strings.next.toLowerCase();
    this.btnPrev.textContent = `←  ${strings.prev.toLowerCase()}`;
    this.btnSkip.textContent = strings.skip.toLowerCase();
  }

  _stepHeader(text) {
    const h = document.createElement("div");
    h.textContent = `> ${(text || "").toLowerCase()}`;
    Object.assign(h.style, {
      fontSize: "11px",
      color: "var(--paper-muted)",
    });
    return h;
  }

  _renderWhat(s, strings) {
    this.center.appendChild(this._stepHeader(strings.step_what));
    const headline = document.createElement("div");
    headline.textContent = s.headline || "";
    Object.assign(headline.style, {
      fontSize: "16px",
      fontWeight: "400",
      lineHeight: "1.4",
      letterSpacing: "-0.01em",
      color: "var(--paper)",
    });
    this.center.appendChild(headline);
  }

  _renderHow(s, strings) {
    this.center.appendChild(this._stepHeader(strings.step_how));
    const accent = s.accent || s.color || "var(--signal)";
    const list = document.createElement("ol");
    Object.assign(list.style, {
      margin: "0",
      padding: "0",
      listStyle: "none",
      display: "flex",
      flexDirection: "column",
      gap: "5px",
    });
    const bullets = (s.bullets || []).slice(0, 4);
    bullets.forEach((bullet, i) => {
      const li = document.createElement("li");
      Object.assign(li.style, {
        display: "grid",
        gridTemplateColumns: "26px 1fr",
        gap: "8px",
        fontSize: "14px",
        lineHeight: "1.5",
        color: "var(--paper)",
        fontFamily: "var(--font-ui)",
      });
      const num = document.createElement("span");
      num.textContent = String(i + 1).padStart(2, "0");
      Object.assign(num.style, {
        color: accent,
        fontVariantNumeric: "tabular-nums",
      });
      const text = document.createElement("span");
      text.textContent = bullet;
      li.append(num, text);
      list.appendChild(li);
    });
    this.center.appendChild(list);
  }

  _renderStack(s, strings) {
    this.center.appendChild(this._stepHeader(strings.step_stack));
    const wrap = document.createElement("ul");
    wrap.dataset.skillsGrid = "1";
    Object.assign(wrap.style, {
      margin: "0",
      padding: "0",
      listStyle: "none",
      display: "grid",
      gridTemplateColumns: this._mq?.matches
        ? "1fr 1fr"
        : "repeat(auto-fill, minmax(140px, 1fr))",
      columnGap: "16px",
      rowGap: "2px",
    });
    for (const skill of (s.skills || [])) {
      const item = document.createElement("li");
      Object.assign(item.style, {
        fontSize: "12px",
        color: "var(--paper-muted)",
        fontFamily: "var(--font-mono)",
        lineHeight: "1.55",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      });
      item.textContent = skill;
      wrap.appendChild(item);
    }
    this.center.appendChild(wrap);
  }

  _renderEndCard() {
    const lang = this._lang();
    const isEn = lang === "en";

    // Layout temporär auf Single-Column umstellen damit die Card mittig wirkt.
    // Identity-Stripe in End-Card-Mode auf Signal-Coral (Call-to-Action).
    this.panel.style.gridTemplateColumns = "1fr";
    this.panel.style.gap = "16px";
    this.panel.style.padding = "22px 28px";
    this.panel.style.textAlign = "center";
    this.panel.style.borderLeftColor = "var(--signal)";

    // Spalten leeren
    this.leftCol.innerHTML = "";
    this.center.innerHTML = "";
    this.rightCol.innerHTML = "";

    // Eyebrow
    const eyebrow = document.createElement("div");
    eyebrow.className = "hud-kicker";
    eyebrow.textContent = isEn ? "> end of tour" : "> ende der tour";
    this.leftCol.appendChild(eyebrow);

    // Headline
    const title = document.createElement("div");
    title.textContent = isEn
      ? "Let's talk!"
      : "Lass uns sprechen!";
    Object.assign(title.style, {
      fontFamily: "var(--font-display)",
      fontSize: "36px",
      fontWeight: "700",
      lineHeight: "1.05",
      letterSpacing: "0.02em",
      color: "var(--paper)",
    });
    this.leftCol.appendChild(title);

    // Body. Generischer Ton, nicht auf einen Job-Typ festgelegt.
    const body = document.createElement("div");
    body.textContent = isEn
      ? "thanks for taking the tour. if you think i'd fit your team, drop me a line. usually within a day."
      : "danke fürs durchklicken. wenn du denkst ich passe in dein team, schreib mir. meist innerhalb eines tages.";
    Object.assign(body.style, {
      fontSize: "13px",
      lineHeight: "1.55",
      color: "var(--paper)",
      maxWidth: "640px",
      margin: "0 auto",
    });
    this.center.appendChild(body);

    // Buttons
    const btnWrap = document.createElement("div");
    Object.assign(btnWrap.style, {
      display: "flex",
      justifyContent: "center",
      gap: "8px",
      flexWrap: "wrap",
    });

    const btnContact = this._makePrimaryBtn();
    btnContact.textContent = `${isEn ? "open contact" : "kontakt öffnen"}  →`;
    btnContact.style.flex = "0 1 auto";
    btnContact.addEventListener("click", () => this._endHandlers?.onContact?.());
    btnWrap.appendChild(btnContact);

    const btnRestart = this._makeSecondaryBtn();
    btnRestart.textContent = isEn ? "replay tour" : "tour erneut";
    btnRestart.style.flex = "0 1 auto";
    btnRestart.addEventListener("click", () => this._endHandlers?.onRestart?.());
    btnWrap.appendChild(btnRestart);

    const btnClose = this._makeSecondaryBtn();
    btnClose.textContent = isEn ? "explore freely" : "frei erkunden";
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
