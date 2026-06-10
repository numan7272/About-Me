/**
 * main.js — Entry-Point
 *
 * Startet die Game-Klasse (3D-Welt) + mountet die React-UI in #ui-root.
 * Die Game-Klasse ist ein Singleton, läuft komplett
 * imperativ. React wird NUR für UI-Overlays genutzt.
 */

import "./index.css";
import { Game } from "./Game.js";

// Boot 3D-Welt
const game = new Game(document.querySelector("#game-canvas"));

// Boot React-UI (separat, kein Berühren der 3D-Pipeline)
import { mountUI } from "./ui/mountUI.jsx";
mountUI(document.querySelector("#ui-root"), game);

// Dev-Helper: Game-Instance global verfügbar in der Browser-Console
if (import.meta.env.DEV) {
  window.__game = game;
}
