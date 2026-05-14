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
      background: "rgba(4, 8, 16, 0.55)",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, -apple-system, sans-serif",
      color: "rgba(240, 245, 250, 0.94)",
      opacity: "0",
      transition: "opacity 0.32s",
      pointerEvents: "auto",
    });

    const card = document.createElement("div");
    Object.assign(card.style, {
      maxWidth: "460px",
      width: "calc(100% - 40px)",
      padding: "32px 32px 24px 32px",
      borderRadius: "18px",
      border: "1px solid rgba(255, 255, 255, 0.14)",
      background: "rgba(10, 18, 32, 0.88)",
      boxShadow: "0 20px 60px rgba(0, 0, 0, 0.6)",
      textAlign: "center",
    });

    const eyebrow = document.createElement("div");
    eyebrow.textContent = lang === "en" ? "Welcome" : "Willkommen";
    Object.assign(eyebrow.style, {
      fontSize: "11px",
      letterSpacing: "0.22em",
      textTransform: "uppercase",
      color: "rgba(126, 200, 255, 0.85)",
      marginBottom: "12px",
    });
    card.appendChild(eyebrow);

    const title = document.createElement("div");
    title.textContent = strings.intro_title;
    Object.assign(title.style, {
      fontSize: "28px",
      fontWeight: "700",
      lineHeight: "1.15",
      marginBottom: "10px",
    });
    card.appendChild(title);

    const body = document.createElement("div");
    body.textContent = strings.intro_body;
    Object.assign(body.style, {
      fontSize: "14px",
      lineHeight: "1.55",
      color: "rgba(220, 230, 240, 0.85)",
      marginBottom: "18px",
    });
    card.appendChild(body);

    // Hint-Box: Buildings sind anklickbar — kleiner Tipp damit Recruiter es
    // entdecken. Sichtbar im Welcome-Overlay UND beim Wieder-Sehen der Tour.
    const hintBox = document.createElement("div");
    hintBox.innerHTML = lang === "en"
      ? "💡 Tip: each building is clickable — try it after the tour."
      : "💡 Tipp: Jedes Gebäude ist anklickbar — probier's nach der Tour.";
    Object.assign(hintBox.style, {
      padding: "10px 12px",
      background: "rgba(126, 200, 255, 0.08)",
      border: "1px solid rgba(126, 200, 255, 0.22)",
      borderRadius: "8px",
      fontSize: "12px",
      lineHeight: "1.5",
      color: "rgba(220, 235, 250, 0.85)",
      marginBottom: "20px",
    });
    card.appendChild(hintBox);

    const btnRow = document.createElement("div");
    Object.assign(btnRow.style, {
      display: "flex",
      flexDirection: "column",
      gap: "10px",
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
      ? "Tour takes ~2 minutes · You can restart it any time."
      : "Tour dauert ~2 Minuten · Du kannst sie jederzeit neu starten.";
    Object.assign(hint.style, {
      marginTop: "18px",
      fontSize: "11px",
      color: "rgba(150, 170, 190, 0.55)",
    });
    card.appendChild(hint);

    overlay.appendChild(card);
    document.body.appendChild(overlay);
    this._overlay = overlay;

    // Fade-in
    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
    });
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
    b.textContent = label + " →";
    Object.assign(b.style, {
      padding: "13px 24px",
      borderRadius: "11px",
      border: "1px solid rgba(126, 200, 255, 0.55)",
      background: "linear-gradient(135deg, rgba(126,200,255,0.30), rgba(126,200,255,0.14))",
      color: "rgba(245, 250, 255, 0.98)",
      fontSize: "15px",
      fontWeight: "600",
      cursor: "pointer",
      transition: "background 0.15s, transform 0.1s",
    });
    b.addEventListener("mouseenter", () => {
      b.style.background = "linear-gradient(135deg, rgba(126,200,255,0.45), rgba(126,200,255,0.22))";
    });
    b.addEventListener("mouseleave", () => {
      b.style.background = "linear-gradient(135deg, rgba(126,200,255,0.30), rgba(126,200,255,0.14))";
    });
    return b;
  }

  _makeSecondaryButton(label) {
    const b = document.createElement("button");
    b.textContent = label;
    Object.assign(b.style, {
      padding: "11px 22px",
      borderRadius: "10px",
      border: "1px solid rgba(255, 255, 255, 0.14)",
      background: "rgba(255, 255, 255, 0.04)",
      color: "rgba(220, 230, 240, 0.85)",
      fontSize: "13px",
      cursor: "pointer",
      transition: "background 0.15s",
    });
    b.addEventListener("mouseenter", () => {
      b.style.background = "rgba(255, 255, 255, 0.10)";
    });
    b.addEventListener("mouseleave", () => {
      b.style.background = "rgba(255, 255, 255, 0.04)";
    });
    return b;
  }

  // ─── Tour-Restart-Button ───────────────────────────────────────────────

  _buildTourButton() {
    // Kleiner Button neben der MiniMap → "Tour starten" für Wiederholungs-
    // besucher. MiniMap sitzt top:84 right:20 mit 200x200.
    // Wir setzen den Button DARÜBER (top:84 right:230, also linksneben MiniMap).
    const btn = document.createElement("button");
    btn.title = this._lang() === "en" ? "Start guided tour" : "Geführte Tour starten";
    // Position: rechts neben der MiniMap. Auf Mobile rückt die MiniMap näher
    // an den Rand (12px) und ist kleiner (130px) — Tour-Button muss sich
    // anpassen, sonst landet er off-screen.
    const isMobileLayout = window.matchMedia?.("(max-width: 600px)")?.matches;
    const btnTop   = isMobileLayout ? "60px" : "84px";
    const btnRight = isMobileLayout ? "150px" : "230px";   // 130+12+8 / 200+20+10
    Object.assign(btn.style, {
      position: "fixed",
      top: btnTop,
      right: btnRight,
      zIndex: "13",
      padding: "8px 14px",
      borderRadius: "999px",
      border: "1px solid rgba(126, 200, 255, 0.35)",
      background: "rgba(0, 0, 0, 0.5)",
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
      color: "rgba(240, 245, 250, 0.92)",
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: "12px",
      fontWeight: "600",
      cursor: "pointer",
      display: "none",        // Initial versteckt — zeigt sich nach Free-Roam-Wahl
      alignItems: "center",
      gap: "6px",
      transition: "background 0.15s",
    });

    const icon = document.createElement("span");
    icon.textContent = "▶";
    icon.style.fontSize = "10px";
    icon.style.color = "rgba(126, 200, 255, 0.9)";
    btn.appendChild(icon);

    const label = document.createElement("span");
    // "Tour" ist in DE und EN das gleiche Wort — bewusst keine Übersetzung.
    label.textContent = "Tour";
    btn.appendChild(label);

    btn.addEventListener("mouseenter", () => {
      btn.style.background = "rgba(126, 200, 255, 0.18)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.background = "rgba(0, 0, 0, 0.5)";
    });
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
        this._tourButtonLabel.textContent = lang === "en" ? "End tour" : "Tour beenden";
      } else {
        this._tourButtonLabel.textContent = "Tour";
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
