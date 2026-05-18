/**
 * WalkthroughController — State-Machine für die geführte Tour.
 *
 * Tour-Reihenfolge (HR-empfohlen): yek → thg → haw → designa → hq
 * (Cybersec-Story-Hook zuerst, nicht chronologisch.)
 *
 * Pro Station hat der Drawer 3 Step-Stufen (Was / Wie / Skills).
 * Controller koordiniert:
 *   - Drawer.show(station) beim Station-Wechsel
 *   - StationLabels3D.setActiveStation(id) → Pulse-Animation
 *   - Camera-FlyTo zum Teleport-Punkt (kommt in Sprint B2)
 *   - Killer-Moment-Trigger bei Yek (kommt in Sprint B2)
 *   - End-Card am HQ (kommt in Sprint B3)
 *
 * Start-Overlay erscheint 600ms nach Page-Ready und bietet:
 *   "Tour starten" (Default) oder "Frei erkunden".
 * Wer "Frei erkunden" wählt, kann später per Tour-Button (oben rechts neben
 *   MiniMap) die Tour nachstarten.
 *
 * LocalStorage merkt sich "Tour wurde mal gesehen" damit Wiederholungs-
 * besucher nicht jedes Mal genervt werden.
 */

import {
  STORY_ORDER,
  TELEPORT_POINTS,
  STATION_CAMERAS,
  getStationsForLang,
  getWalkthroughStrings,
} from "../../data/stations.js";

const STORAGE_KEY = "numan-tour-seen-v1";
const AUTO_OVERLAY_DELAY_MS = 600;

export class WalkthroughController {
  constructor(game) {
    this.game = game;
    this.active = false;         // läuft eine Tour gerade?
    this.stepIndex = -1;         // Index in STORY_ORDER
    this._overlay = null;
    this._tourButton = null;

    // Drawer-Callbacks anhängen — Drawer existiert bereits in game.ui.drawer
    this._wireDrawer();

    // Start-Overlay bauen + zeigen falls noch nicht gesehen
    this._buildTourButton();
    // Initial-Show NUR wenn Tour noch nie gesehen wurde — und nur falls
    // der Splash uns nicht aktiv blockiert (Splash übernimmt sonst die
    // Anzeige nach seinem eigenen Start-Klick).
    setTimeout(() => {
      if (this._hasSeenTour()) return;
      if (typeof window !== "undefined" && window.__deferTourOverlay) return;
      if (this._overlay) return;
      this._showStartOverlay();
    }, AUTO_OVERLAY_DELAY_MS);
  }

  /**
   * Wird vom LoadingSplash nach dem Start-Klick aufgerufen. Erzwingt das
   * Tour-Overlay (auch wenn Tour-Seen-Flag gesetzt ist, weil der User
   * gerade aktiv neu gestartet hat). Bricht nur ab, wenn Overlay schon offen.
   */
  showStartOverlayAfterSplash() {
    if (this._overlay) return;
    if (this.active) return;          // Tour läuft schon — kein Overlay zeigen
    this._showStartOverlay();
  }

  /**
   * Alte Methode bleibt für Rückwärtskompatibilität. Verhält sich wie
   * showStartOverlayAfterSplash, aber respektiert das hasSeenTour-Flag.
   */
  _maybeShowStartOverlay() {
    if (this._hasSeenTour()) return;
    if (typeof window !== "undefined" && window.__deferTourOverlay) return;
    if (this._overlay) return;
    this._showStartOverlay();
  }

  // ─── Persistence ───────────────────────────────────────────────────────

  _hasSeenTour() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  _markTourSeen() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch (e) {}
  }

  _lang() {
    return (typeof window !== "undefined" && window.__lang) || "de";
  }

  _strings() {
    return getWalkthroughStrings(this._lang());
  }

  // ─── Drawer-Verkabelung ────────────────────────────────────────────────

  _wireDrawer() {
    // Race-Fix: game.ui ist im Konstruktor noch nicht gesetzt (this.ui =
    // new Ui(this) wird erst NACH unserem Constructor zugewiesen). Wir
    // greifen direkt auf ui.drawer — Ui.js hat den Drawer eine Zeile vorher
    // erzeugt, ist also als Member verfügbar.
    const ui = this.game?.ui;
    // Fall 1: ui ist schon da (z.B. wenn Controller später re-instanziiert)
    let d = ui?.drawer;
    // Fall 2: Ui-Konstruktor läuft noch — nutze game._uiBuilding-Ref falls
    // gesetzt. Cleaner: Drawer-Ref direkt aus dem Game-Singleton-Tree holen.
    // Da Ui.js den Drawer als `this.drawer` SEINES eigenen Objekts speichert
    // BEVOR der Controller erzeugt wird, muss `this.game.ui` zumindest den
    // Drawer kennen — ABER `game.ui` selbst ist noch nicht zugewiesen.
    // Workaround: defer mit setTimeout(0) — nach Microtask ist game.ui da.
    if (!d) {
      setTimeout(() => {
        const lateD = this.game?.ui?.drawer;
        if (lateD) {
          lateD.onNext = () => this._handleDrawerNext();
          lateD.onPrev = () => this._handleDrawerPrev();
          lateD.onSkip = () => this._handleDrawerSkip();
        } else {
          console.warn("[Walkthrough] drawer still not available after defer");
        }
      }, 0);
      return;
    }
    d.onNext = () => this._handleDrawerNext();
    d.onPrev = () => this._handleDrawerPrev();
    d.onSkip = () => this._handleDrawerSkip();
  }

  _handleDrawerNext() {
    // User hat im letzten Step "Weiter" gedrückt — nächste Station
    if (this.stepIndex < STORY_ORDER.length - 1) {
      this.goToStep(this.stepIndex + 1);
    } else {
      // Tour-Ende → End-Card im Drawer anzeigen (statt direkt schließen)
      this._showEndCard();
    }
  }

  _showEndCard() {
    const drawer = this.game?.ui?.drawer;
    if (!drawer?.showEndCard) {
      this.endTour({ completed: true });
      return;
    }
    // Wichtig: this.active BLEIBT auf true bis User einen End-Card-Button
    // drückt. Sonst greift endTour() im Click-Handler nicht (returnt früh
    // bei !active). active wird erst in den Handlern unten zurückgesetzt.
    drawer.showEndCard({
      onContact: () => {
        // Drawer schließen, Tour-Cleanup, dann Kontakt-Panel öffnen.
        drawer.hide();
        this.endTour({ completed: false });
        setTimeout(() => this.game?.ui?.contact?.open?.(), 200);
      },
      onRestart: () => {
        // Tour von vorne — Drawer bleibt sichtbar, springt zu Step 0
        this.goToStep(0);
      },
      onClose: () => {
        drawer.hide();
        this.endTour({ completed: false });
      },
    });
    // Active-Label clearen damit nichts mehr pulsiert (das ist sicher).
    this.game?.world?.stationLabels?.setActiveStation?.(null);
    this.game?.world?.proximity?.clearHighlight?.();
    this._markTourSeen();
    this._updateTourButtonVisibility();
  }

  _handleDrawerPrev() {
    // User hat im ersten Step "Zurück" gedrückt — vorige Station
    if (this.stepIndex > 0) {
      this.goToStep(this.stepIndex - 1);
    }
  }

  _handleDrawerSkip() {
    this.endTour({ completed: false });
  }

  // ─── Tour-Lifecycle ────────────────────────────────────────────────────

  startTour() {
    if (this.active) return;
    this.active = true;
    this._markTourSeen();
    this._updateTourButtonVisibility();
    // Joystick während Tour verstecken — User soll nicht das Bike steuern wollen
    // und sich wundern dass nichts passiert (Player.update returnt früh).
    this.game?.ui?.touchJoystick?.setVisible?.(false);
    this.goToStep(0);
  }

  endTour({ completed } = {}) {
    if (!this.active) return;
    this.active = false;
    this.stepIndex = -1;
    this.game?.ui?.drawer?.hide?.();
    this.game?.world?.stationLabels?.setActiveStation?.(null);
    this.game?.world?.proximity?.clearHighlight?.();
    // Falls bei Yek abgebrochen: DayCycle smooth zurück zu Tag + Auto-Cycle
    // wieder freigeben damit der normale Zyklus weiterläuft.
    this.game?.world?.dayCycle?.transitionTo?.(0, 3, true);
    // Camera zurück in Follow-Mode (User soll wieder fahren können)
    this.game?.cameraRig?.cancelFly?.();
    this.game?.cameraRig?.recenter?.();
    // Joystick wieder sichtbar (war während Tour ausgeblendet)
    this.game?.ui?.touchJoystick?.setVisible?.(true);
    this._markTourSeen();
    this._updateTourButtonVisibility();

    // Wenn Tour erfolgreich durchgelaufen ist, öffnen wir das Kontakt-Panel
    // damit der Recruiter sofort den Call-to-Action sieht. Sprint B3 wird
    // das durch eine schickere End-Card ersetzen.
    if (completed) {
      setTimeout(() => this.game?.ui?.contact?.open?.(), 400);
    }
  }

  /** Springt zu einer Tour-Position (0..STORY_ORDER.length-1). */
  goToStep(index) {
    if (index < 0 || index >= STORY_ORDER.length) return;
    this.stepIndex = index;
    const stationId = STORY_ORDER[index];

    // Stations-Daten in aktueller Sprache holen
    const stations = getStationsForLang(this._lang());
    const station = stations[stationId];
    if (!station) {
      console.warn(`[Walkthrough] no station data for "${stationId}"`);
      return;
    }

    // Drawer zeigen
    this.game?.ui?.drawer?.show?.(station);
    // 3D-Label pulsiert
    this.game?.world?.stationLabels?.setActiveStation?.(stationId);

    // ── Camera-FlyTo: cinematic Pose, die den Eingang zeigt ──
    // Bevorzugt STATION_CAMERAS (explizite camera+lookAt vom User abgelesen),
    // fallback auf TELEPORT_POINTS (nur Look-At, Default-Iso-Camera).
    const camDef = STATION_CAMERAS[stationId];
    const tp = TELEPORT_POINTS[stationId];
    if (this.game?.cameraRig?.flyTo) {
      if (camDef) {
        this.game.cameraRig.flyTo(camDef.lookAt, {
          duration: 1.8,
          cameraPos: camDef.camera,
          lookAt: camDef.lookAt,
        });
      } else if (tp) {
        this.game.cameraRig.flyTo(tp, { duration: 1.8 });
      }
    }

    // ── Killer-Moment: bei Yek das Router-Egg pulsieren lassen ──
    const prox = this.game?.world?.proximity;
    if (prox?.highlightEgg) {
      if (station.eggHint) {
        prox.highlightEgg(station.eggHint);
      } else {
        prox.clearHighlight();
      }
    }

    // ── Yek-Killer-Moment: Tag → Sonnenuntergang Übergang ──
    // Bei Yek (Family-Restaurant, "Drei Jahre in der Gastro") fadet die Welt
    // in Dämmerung. Die Street-Lamps gehen automatisch an (sie reagieren auf
    // nightFactor via DayCycle). 4 Sekunden Übergang, synchron mit der
    // 1.8s-FlyTo + leichter Tail damit der Recruiter beim Lesen die Stimmung
    // ankommen sieht.
    //
    // Für alle anderen Stationen: zurück zu Tag (sofern wir vorher in Dusk
    // standen). `releaseAfter` = Auto-Cycle wieder freigeben sobald wieder bei
    // Day angekommen, damit der Tag/Nacht-Zyklus normal weiterläuft.
    const dayCycle = this.game?.world?.dayCycle;
    if (dayCycle?.transitionTo) {
      if (stationId === "yek") {
        dayCycle.transitionTo(0.28, 4, false);   // → Dusk, lock
      } else {
        dayCycle.transitionTo(0, 4, true);       // → Day, release auto-cycle
      }
    }
  }

  // ─── Start-Overlay ─────────────────────────────────────────────────────

  _showStartOverlay() {
    if (this._overlay) return;          // already shown
    const strings = this._strings();
    const lang = this._lang();

    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "16",
      background: "oklch(13% 0.015 250 / 0.55)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "var(--font-mono)",
      color: "var(--paper)",
      opacity: "0",
      transition: "opacity 0.32s var(--ease)",
      pointerEvents: "auto",
    });

    const card = document.createElement("section");
    card.className = "hud-bracket";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-labelledby", "tour-overlay-title");
    Object.assign(card.style, {
      maxWidth: "460px",
      width: "calc(100% - 40px)",
      padding: "28px 28px 22px",
      background: "var(--ink-solid)",
      color: "var(--paper)",
      textAlign: "left",
    });
    card.append(this._cornerSpan("tr"), this._cornerSpan("bl"));

    const eyebrow = document.createElement("div");
    eyebrow.textContent = `> ${lang === "en" ? "welcome" : "willkommen"}`;
    Object.assign(eyebrow.style, {
      fontSize: "11px",
      color: "var(--paper-muted)",
      marginBottom: "10px",
    });
    card.appendChild(eyebrow);

    const title = document.createElement("h2");
    title.id = "tour-overlay-title";
    title.textContent = strings.intro_title;
    Object.assign(title.style, {
      margin: "0 0 10px",
      fontSize: "24px",
      fontWeight: "400",
      lineHeight: "1.2",
      letterSpacing: "-0.01em",
      color: "var(--paper)",
    });
    card.appendChild(title);

    const body = document.createElement("p");
    body.textContent = strings.intro_body;
    Object.assign(body.style, {
      margin: "0 0 16px",
      fontSize: "13px",
      lineHeight: "1.55",
      color: "var(--paper-muted)",
    });
    card.appendChild(body);

    const rule = document.createElement("hr");
    rule.className = "hud-rule";
    rule.style.margin = "0 0 14px";
    card.appendChild(rule);

    const hintBox = document.createElement("div");
    hintBox.textContent = lang === "en"
      ? "> tip. every building is clickable. try one after the tour."
      : "> tipp. jedes gebäude ist anklickbar. probier's nach der tour.";
    Object.assign(hintBox.style, {
      padding: "10px 12px",
      borderLeft: "2px solid var(--signal)",
      background: "transparent",
      fontSize: "12px",
      lineHeight: "1.5",
      color: "var(--paper)",
      marginBottom: "18px",
    });
    card.appendChild(hintBox);

    const btnRow = document.createElement("div");
    Object.assign(btnRow.style, {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
    });

    const btnStart = this._makePrimaryButton(strings.start_tour);
    btnStart.addEventListener("click", () => {
      this._hideStartOverlay();
      this.startTour();
    });
    btnRow.appendChild(btnStart);

    const btnFree = this._makeSecondaryButton(strings.free_roam);
    btnFree.addEventListener("click", () => {
      this._hideStartOverlay();
      this._markTourSeen();
      this._updateTourButtonVisibility();
    });
    btnRow.appendChild(btnFree);

    card.appendChild(btnRow);

    const hint = document.createElement("div");
    hint.textContent = lang === "en"
      ? "~2 min. restart any time."
      : "~2 min. jederzeit neu startbar.";
    Object.assign(hint.style, {
      marginTop: "14px",
      fontSize: "11px",
      color: "var(--paper-dim)",
    });
    card.appendChild(hint);

    overlay.appendChild(card);
    document.body.appendChild(overlay);
    this._overlay = overlay;

    // Fade-in
    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
    });
    setTimeout(() => btnStart.focus(), 50);
  }

  _cornerSpan(corner) {
    const s = document.createElement("span");
    s.className = `hud-bracket-${corner}`;
    return s;
  }

  _hideStartOverlay() {
    if (!this._overlay) return;
    this._overlay.style.opacity = "0";
    setTimeout(() => {
      this._overlay?.remove?.();
      this._overlay = null;
    }, 320);
  }

  _makePrimaryButton(label) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = `${label.toLowerCase()}  →`;
    Object.assign(b.style, {
      padding: "14px 18px",
      border: "1px solid var(--signal)",
      background: "transparent",
      color: "var(--signal)",
      fontFamily: "var(--font-mono)",
      fontSize: "14px",
      letterSpacing: "0.04em",
      cursor: "pointer",
      transition: "background 180ms var(--ease)",
      minHeight: "48px",
    });
    b.addEventListener("mouseenter", () => {
      b.style.background = "var(--signal-dim)";
    });
    b.addEventListener("mouseleave", () => {
      b.style.background = "transparent";
    });
    return b;
  }

  _makeSecondaryButton(label) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label.toLowerCase();
    Object.assign(b.style, {
      padding: "12px 18px",
      border: "1px solid var(--rule-strong)",
      background: "transparent",
      color: "var(--paper-muted)",
      fontFamily: "var(--font-mono)",
      fontSize: "13px",
      cursor: "pointer",
      transition: "color 180ms var(--ease), border-color 180ms var(--ease)",
      minHeight: "44px",
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

  // ─── Tour-Restart-Button ───────────────────────────────────────────────

  _buildTourButton() {
    // Plain text-button neben der MiniMap. MiniMap sitzt top:84 right:20.
    // Auf Mobile rückt sie auf top:70 right:12 und ist kleiner (130px).
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hud-btn";
    btn.title = this._lang() === "en" ? "start guided tour" : "geführte tour starten";

    const isMobileLayout = window.matchMedia?.("(max-width: 600px)")?.matches;
    const btnTop   = isMobileLayout ? "62px" : "84px";
    const btnRight = isMobileLayout ? "154px" : "238px";
    Object.assign(btn.style, {
      position: "fixed",
      top: btnTop,
      right: btnRight,
      zIndex: "13",
      background: "var(--ink-solid)",
      display: "none",          // initial hidden, zeigt sich nach Free-Roam-Wahl
      alignItems: "center",
      gap: "8px",
    });

    const icon = document.createElement("span");
    icon.textContent = "▸";
    Object.assign(icon.style, {
      fontSize: "11px",
      color: "var(--signal)",
    });
    btn.appendChild(icon);

    const label = document.createElement("span");
    label.textContent = "tour";
    btn.appendChild(label);

    btn.addEventListener("click", () => {
      if (this.active) {
        this.endTour({ completed: false });
      } else {
        this.startTour();
      }
    });

    document.body.appendChild(btn);
    this._tourButton = btn;
    this._tourButtonLabel = label;
  }

  _updateTourButtonVisibility() {
    if (!this._tourButton) return;
    // Button ist sichtbar wenn der User den Pageload-Overlay-Pfad durch ist
    // (also entweder Tour gesehen oder "Free Roam" gewählt).
    const seen = this._hasSeenTour();
    this._tourButton.style.display = seen ? "flex" : "none";
    if (this._tourButtonLabel) {
      const lang = this._lang();
      if (this.active) {
        this._tourButtonLabel.textContent = lang === "en" ? "end tour" : "tour beenden";
      } else {
        this._tourButtonLabel.textContent = "tour";
      }
    }
  }

  /** Sprachwechsel → Overlay + Button-Label re-rendern */
  refreshLang() {
    // Falls Start-Overlay grad offen ist, neu rendern (selten — meist hat
    // User schon weggeklickt bevor er die Sprache wechselt).
    if (this._overlay) {
      this._hideStartOverlay();
      setTimeout(() => this._showStartOverlay(), 320);
    }
    this._updateTourButtonVisibility();
    // Falls Tour aktiv → Drawer mit neuen Sprachstrings re-rendern
    if (this.active && this.stepIndex >= 0) {
      this.goToStep(this.stepIndex);
    }
  }

  /** Externer Hook für Debug-Konsole: __game.world.walkthrough.devReset() */
  devReset() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    this.endTour({ completed: false });
    this._hideStartOverlay();
    setTimeout(() => this._showStartOverlay(), 100);
  }

  destroy() {
    this._hideStartOverlay();
    this._tourButton?.remove?.();
    this._tourButton = null;
  }
}
