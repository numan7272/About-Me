/**
 * MiniGames — Manager für Easter-Egg Mini-Games.
 *
 * Lazy-loaded (dynamic import) damit kein Code an die initial Bundle gebunden
 * ist solange der User nicht auf ein Egg klickt. So bleibt der First-Paint
 * schnell.
 *
 * Public API:
 *   miniGames.open(eggId)   — startet das Mini-Game für eggId
 *   miniGames.markComplete(eggId)   — vom Mini-Game gerufen wenn gelöst
 *   miniGames.isComplete(eggId)     — query
 */

const GAME_MAP = {
  router:    () => import("./RouterPentest.js").then((m) => m.RouterPentest),
  Router:    () => import("./RouterPentest.js").then((m) => m.RouterPentest),
  // HQ-Click → NumanOS-Desktop. SQLi-Lab ist als versteckte Datei dort drin.
  hq:        () => import("./NumanOS.js").then((m) => m.NumanOS),
  HQ:        () => import("./NumanOS.js").then((m) => m.NumanOS),
};

export class MiniGames {
  constructor(game) {
    this.game = game;
    this.active = null;
    this.completed = new Set();
    // Persist completion über page-reload via localStorage
    try {
      const raw = localStorage.getItem("aboutme.minigames");
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          for (const id of arr) this.completed.add(String(id).toLowerCase());
        }
      }
    } catch {}
  }

  async open(eggId) {
    if (this.active) {
      // Anderes Spiel läuft — schließen, dann neues starten
      this.close();
    }
    const loader = GAME_MAP[eggId] || GAME_MAP[String(eggId).toLowerCase()];
    if (!loader) {
      console.warn("[MiniGames] no game registered for", eggId);
      return;
    }
    try {
      const GameClass = await loader();
      this.active = new GameClass(this.game);
      this.active.open();
    } catch (err) {
      console.error("[MiniGames] failed to load game", eggId, err);
    }
  }

  close() {
    if (this.active?.close) {
      try { this.active.close(); } catch {}
    }
    this.active = null;
  }

  /** Vom Mini-Game gerufen sobald der User es gelöst hat. */
  markComplete(eggId) {
    const id = String(eggId).toLowerCase();
    if (this.completed.has(id)) return;
    this.completed.add(id);
    try {
      localStorage.setItem(
        "aboutme.minigames",
        JSON.stringify([...this.completed]),
      );
    } catch {}

    // DiscoveryHud-Toast + Counter erhöhen
    const ui = this.game.ui;
    const discoveryHud = ui?.discoveryHud;
    if (discoveryHud?.markDiscovered) {
      const titleMap = {
        router: "Yek Network Audit — solved",
        hq:     "NumanOS — SQLi Lab solved",
      };
      discoveryHud.markDiscovered(eggId, titleMap[id] || `Egg ${eggId}`);
    }

    // Egg-Glow visuell als "discovered" markieren (kleiner + dimmer)
    const eggMesh = this.game.world?.proximityTrigger?.eggMeshes?.get(eggId)
                 || this.game.world?.proximityTrigger?.eggMeshes?.get(
                    eggId.charAt(0).toUpperCase() + eggId.slice(1));
    if (eggMesh) {
      eggMesh.userData.completed = true;
      if (eggMesh.material) eggMesh.material.opacity = 0.35;
    }
  }

  isComplete(eggId) {
    return this.completed.has(String(eggId).toLowerCase());
  }

  destroy() {
    this.close();
  }
}
