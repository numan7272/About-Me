/**
 * mountUI — Bootstrap für die React-UI-Overlay-Schicht.
 *
 * React ist NUR für UI (HUD, Settings, Modals). 3D läuft komplett
 * parallel in Game.js / Three.js. Die zwei Welten kommunizieren via
 * zustand-Store (siehe lib/store.js — kommt in Phase 2).
 */

import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";

export function mountUI(container, game) {
  const root = createRoot(container);
  root.render(<App game={game} />);
  return root;
}
