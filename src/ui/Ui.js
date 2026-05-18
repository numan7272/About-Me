/**
 * Ui — Container für alle DOM-Overlays.
 *
 * Wird vom Game-Singleton erzeugt und gemanaged. Eigene update()-Loop
 * für DOM-Updates (Speed-HUD, MiniMap, Recenter-Button-Sichtbarkeit).
 */

import { Hud } from "./Hud.js";
import { MiniMap } from "./MiniMap.js";
import { SettingsPanel } from "./SettingsPanel.js";
import { DiscoveryHud } from "./DiscoveryHud.js";
import { HotkeyHelp } from "./HotkeyHelp.js";
import { ContactPanel } from "./contact/ContactPanel.js";
import { BottomDrawer } from "./walkthrough/BottomDrawer.js";
import { WalkthroughController } from "./walkthrough/WalkthroughController.js";
import { TouchJoystick } from "./TouchJoystick.js";
import { MiniGames } from "./miniGames/MiniGames.js";
import { BuildingsHint } from "./BuildingsHint.js";
import { ControlModePicker } from "./ControlModePicker.js";
import { getControlMode, subscribeControlMode } from "./controlMode.js";
import { haptic } from "./_a11y.js";

// InfoCard ist aktuell deaktiviert — Walkthrough nutzt BottomDrawer.
// import { InfoCard } from "./InfoCard.js";

export class Ui {
  constructor(game) {
    this.game = game;

    this.hud = new Hud(game);
    this.miniMap = new MiniMap(game);
    this.settings = new SettingsPanel(game);
    this.discoveryHud = new DiscoveryHud(game);
    this.hotkeyHelp = new HotkeyHelp(game);

    // Make-or-Break-Element vom HR-Audit: jederzeit erreichbarer Kontakt.
    this.contact = new ContactPanel(game);

    // Walkthrough-UI — wird vom WalkthroughController gesteuert.
    this.drawer = new BottomDrawer(game);

    // WalkthroughController muss NACH dem Drawer erzeugt werden, weil er
    // sich an Drawer.onNext/onPrev/onSkip hängt.
    this.walkthrough = new WalkthroughController(game);

    // Touch-Joystick — auto-hidden auf Desktop, sichtbar auf Touch-Devices
    this.touchJoystick = new TouchJoystick(game);

    // Easter-Egg Mini-Games (Router-Pentest, SQL-Injection-Lab)
    // Lazy: lädt JS erst beim Egg-Click → schneller First-Paint.
    this.miniGames = new MiniGames(game);

    // One-Time-Toast "Gebäude sind anklickbar"
    this.buildingsHint = new BuildingsHint(game);

    // Tutorial-Overlay: Joystick vs Tap-to-Move (nur Mobile, einmalig)
    this.controlPicker = new ControlModePicker(game);

    // Apply initial mode + subscribe für Live-Wechsel aus Settings
    this._applyControlMode(getControlMode());
    this._unsubControl = subscribeControlMode((m) => this._applyControlMode(m));
    // this.infoCard = new InfoCard(game);   // deaktiviert

    // A11y: Tasten 1-5 öffnen die Stationen direkt — ohne Bike fahren
    // zu müssen. Tour-Story-Reihenfolge: 1=Yek 2=THG 3=HAW 4=Designa 5=HQ.
    // Ermöglicht Recruitern mit a11y-Bedarf den ganzen Content per Tastatur.
    this._setupShortcuts();
  }

  _setupShortcuts() {
    const STATION_KEYS = {
      Digit1: "yek",
      Digit2: "thg",
      Digit3: "haw",
      Digit4: "designa",
      Digit5: "hq",
      Numpad1: "yek",
      Numpad2: "thg",
      Numpad3: "haw",
      Numpad4: "designa",
      Numpad5: "hq",
    };
    this._onShortcut = (e) => {
      // Skip wenn User in Input/Textarea tippt oder Modifier gedrückt sind
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.target?.isContentEditable) return;
      // Nicht während aktivem Mini-Game (würde das offene Game stören)
      if (this.miniGames?.active) return;
      const stationId = STATION_KEYS[e.code];
      if (!stationId) return;
      e.preventDefault();
      // Mini-Game-Open für die Station öffnen
      this.miniGames?.open?.(stationId);
      // Haptic-Feedback wenn verfügbar
      haptic(8);
    };
    window.addEventListener("keydown", this._onShortcut);
  }

  /** Joystick / TapToMove je nach Modus an- oder ausschalten. */
  _applyControlMode(mode) {
    const tap = this.game?.world?.tapToMove;
    if (mode === "tap") {
      this.touchJoystick?.setVisible?.(false);
      tap?.setEnabled?.(true);
    } else {
      // Joystick-Sichtbarkeit übernimmt TouchJoystick selbst basierend auf
      // Touch-Device-Detection. Wir setzen nur "force-hide off".
      this.touchJoystick?.setVisible?.(true);
      tap?.setEnabled?.(false);
    }
  }

  update() {
    this.hud?.update?.();
    this.miniMap?.update?.();
    this.touchJoystick?.update?.();
    // Settings, DiscoveryHud, HotkeyHelp, Contact, Drawer sind event-driven
  }

  /** Sprachwechsel → alle Sprach-abhängigen UI-Bestandteile refreshen */
  refreshLang() {
    this.contact?.refresh?.();
    this.game?.world?.stationLabels?.refresh?.();
    this.walkthrough?.refreshLang?.();
    // Drawer wird bei show() neu gerendert
  }

  destroy() {
    if (this._onShortcut) window.removeEventListener("keydown", this._onShortcut);
    this.hud?.destroy?.();
    this.miniMap?.destroy?.();
    this.settings?.destroy?.();
    this.discoveryHud?.destroy?.();
    this.hotkeyHelp?.destroy?.();
    this.contact?.destroy?.();
    this.walkthrough?.destroy?.();
    this.drawer?.destroy?.();
    this.touchJoystick?.destroy?.();
    this.miniGames?.destroy?.();
    this.buildingsHint?.destroy?.();
    this.controlPicker?.destroy?.();
    this._unsubControl?.();
  }
}
