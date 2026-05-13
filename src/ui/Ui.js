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
    // this.infoCard = new InfoCard(game);   // deaktiviert
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
  }
}
