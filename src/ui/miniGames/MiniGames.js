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
  // Egg-Klicks
  router:    () => import("./RouterPentest.js").then((m) => m.RouterPentest),
  Router:    () => import("./RouterPentest.js").then((m) => m.RouterPentest),
  // Building-Klicks (jedes Building öffnet sein eigenes Mini-Game)
  hq:        () => import("./NumanOS.js").then((m) => m.NumanOS),
  HQ:        () => import("./NumanOS.js").then((m) => m.NumanOS),
  designa:   () => import("./DesignaOS.js").then((m) => m.DesignaOS),
  Designa:   () => import("./DesignaOS.js").then((m) => m.DesignaOS),
  haw:       () => import("./HAWMoodle.js").then((m) => m.HAWMoodle),
  HAW:       () => import("./HAWMoodle.js").then((m) => m.HAWMoodle),
  thg:       () => import("./THGQuiz.js").then((m) => m.THGQuiz),
  THG:       () => import("./THGQuiz.js").then((m) => m.THGQuiz),
  yek:       () => import("./YekKasse.js").then((m) => m.YekKasse),
  Yek:       () => import("./YekKasse.js").then((m) => m.YekKasse),
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
    if (this.active || this._opening) {
      // Anderes Spiel läuft oder lädt — re-entrancy verhindern
      return;
    }
    this._opening = true;
    // Bevor wir das Mini-Game öffnen: alle pointer-blockierenden States
    // aus dem 3D-View entspannen. Sonst bleibt OrbitControls stuck wenn
    // der TouchJoystick einen pointerdown gesehen hat, aber pointerup
    // vom Mini-Game-Overlay verschluckt wird.
    this._resetPointerStates();

    const loader = GAME_MAP[eggId] || GAME_MAP[String(eggId).toLowerCase()];
    if (!loader) {
      console.warn("[MiniGames] no game registered for", eggId);
      this._opening = false;
      return;
    }
    try {
      // Kamera-Fly-In zum Gebäude/Egg + Chunk-Load laufen parallel.
      // Das Overlay erscheint erst wenn die Kamera angekommen ist — der
      // Boot-Screen liest sich dann als "der Rechner da drin geht an".
      const [GameClass] = await Promise.all([
        loader(),
        this._flyIntro(eggId),
      ]);
      // Falls inzwischen ein anderes Mini-Game offen ist, abbrechen
      if (this.active) {
        this._opening = false;
        return;
      }
      this.active = new GameClass(this.game);
      // Body-Scroll-Lock (iOS-Safari momentum-scroll-Bug)
      this._lockBodyScroll();
      // Monkey-patch close() so dass es auch unseren Manager-State + Pointer-
      // Reset triggert wenn das Sub-Game intern schließt (z.B. via X-Button).
      const origClose = this.active.close?.bind(this.active);
      this.active.close = () => {
        try { origClose?.(); } catch {}
        this.active = null;
        this._resetPointerStates();
        this._unlockBodyScroll();
        // Kamera gleitet zurück zum Bike (Follow-Lerp übernimmt den Weg)
        this.game?.cameraRig?.recenter?.();
      };
      this.active.open();
    } catch (err) {
      console.error("[MiniGames] failed to load game", eggId, err);
    } finally {
      this._opening = false;
    }
  }

  /**
   * Findet den 3D-Anker (Position + Anflugrichtung) für ein Mini-Game.
   * Buildings nutzen ihre frontWorld-Richtung (Kamera stellt sich vor die
   * Fassade), Eggs werden von der aktuellen Kamera-Seite aus angeflogen.
   */
  _findFlyAnchor(eggId) {
    const island = this.game?.world?.island;
    if (!island) return null;
    const idLow = String(eggId).toLowerCase();

    const b = island.buildings?.find?.((x) => String(x.id).toLowerCase() === idLow);
    if (b) {
      return { pos: b.position, front: b.frontWorld, dist: 7.5, height: 3.2, lookY: 2.2 };
    }
    const e = island.eggs?.find?.((x) => String(x.id).toLowerCase() === idLow);
    if (e) {
      return { pos: e.position, front: null, dist: 4.0, height: 1.8, lookY: 0.6 };
    }
    return null;
  }

  /**
   * Cinematic Fly-In vor das Gebäude. Resolved nach Ablauf der Flugdauer —
   * auch wenn der User den Flug per Drag/Wheel abbricht (cancelFly), damit
   * das Mini-Game in jedem Fall öffnet. Übersprungen bei reduced-motion,
   * fehlendem Anker oder laufender Tour (deren Kamera hat Vorrang).
   */
  _flyIntro(eggId) {
    return new Promise((resolve) => {
      const rig = this.game?.cameraRig;
      const anchor = this._findFlyAnchor(eggId);
      const reduced = typeof window !== "undefined"
        && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      if (!rig?.flyTo || !anchor || reduced || this.game?.ui?.walkthrough?.active) {
        resolve();
        return;
      }

      const [bx, by, bz] = anchor.pos;
      let fx, fz;
      if (Array.isArray(anchor.front)) {
        fx = anchor.front[0];
        fz = anchor.front[2];
      } else {
        // Kein frontWorld (Eggs): von der aktuellen Kamera-Seite anfliegen
        fx = rig.camera.position.x - bx;
        fz = rig.camera.position.z - bz;
      }
      const fl = Math.hypot(fx, fz) || 1;
      fx /= fl;
      fz /= fl;

      const duration = 1.1;
      rig.flyTo([bx, by, bz], {
        duration,
        cameraPos: [bx + fx * anchor.dist, by + anchor.height, bz + fz * anchor.dist],
        lookAt: [bx, by + anchor.lookY, bz],
      });
      setTimeout(resolve, duration * 1000 + 120);
    });
  }

  _lockBodyScroll() {
    if (this._scrollLocked) return;
    this._savedBodyStyle = {
      overflow: document.body.style.overflow,
      touchAction: document.body.style.touchAction,
    };
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    this._scrollLocked = true;
  }

  _unlockBodyScroll() {
    if (!this._scrollLocked) return;
    document.body.style.overflow = this._savedBodyStyle?.overflow || "";
    document.body.style.touchAction = this._savedBodyStyle?.touchAction || "";
    this._scrollLocked = false;
  }

  close() {
    if (this.active?.close) {
      try { this.active.close(); } catch {}
    }
    this.active = null;
    // Beim Schließen NOCHMAL Pointer-States resetten — der User soll nach
    // dem Mini-Game sofort wieder die Kamera bewegen können.
    this._resetPointerStates();
    this._unlockBodyScroll();
    // Plus: nach 100ms nochmal resetten — manche Browser/Mobile-Devices
    // brauchen einen kurzen Beat um die touch-cancel zu propagieren bevor
    // OrbitControls' Reconnect wirklich greift.
    setTimeout(() => this._resetPointerStates(), 100);
  }

  /** Defensives Aufräumen: bricht abgehängte Pointer-Captures ab und
   *  reaktiviert OrbitControls. Wird bei open() + close() aufgerufen.
   *
   *  Mobile-spezifischer Bug: nach Mini-Game-Open verliert OrbitControls
   *  seine internen `_pointers`/`_pointerPositions`-Arrays nicht — das
   *  touch-end-Event wird vom Overlay-DOM verschluckt. Folge: nach Close
   *  denkt OrbitControls noch dass 1 oder 2 Finger auf dem Screen sind,
   *  und neue Touches gehen direkt in den Pinch-Zoom-Mode statt Rotate.
   *
   *  Fix: OrbitControls' internal Pointer-Tracking-State manuell clearen
   *  durch dispose()+connect() — das reattachs alle Listener und resettet
   *  alle internen Arrays.
   */
  _resetPointerStates() {
    // TouchJoystick: aktive Geste killen
    const tj = this.game?.ui?.touchJoystick;
    if (tj?._endGesture) {
      try { tj._endGesture(); } catch {}
    }

    // Synthesize ein pointercancel auf den Canvas, damit OrbitControls und
    // andere pointer-tracker den ggf. noch hängenden Pointer freigeben.
    // Mobile-Bug: der pointerdown vom Building-Click landet beim Canvas, aber
    // pointerup geht aufs Overlay → Canvas-Listener bleibt im "down"-State.
    const canvas = this.game?.canvas;
    if (canvas) {
      try {
        // Mit pointerId -1 cancel-en wir effektiv alle Pointer-Slots
        const evt = new PointerEvent("pointercancel", {
          pointerId: 1, pointerType: "touch",
          bubbles: true, cancelable: true,
        });
        canvas.dispatchEvent(evt);
      } catch {}
    }

    // OrbitControls hard-reset: dispose entfernt alle Event-Listener und
    // resettet die internen Pointer-Arrays. connect bindet alles neu.
    const cameraRig = this.game?.cameraRig;
    const controls = cameraRig?.controls;
    if (controls) {
      try {
        controls.dispose();
        // Three.js r155+ hat controls.connect(domElement) — vorher war's
        // automatisch via Constructor. Wir rufen connect mit dem Canvas
        // damit die Listener wieder dranne sind.
        const canvas = this.game?.canvas;
        if (typeof controls.connect === "function" && canvas) {
          controls.connect(canvas);
        }
        // Manuell die internen Pointer-Arrays leeren — manche Three.js-Versionen
        // resetten die nicht in dispose().
        if (Array.isArray(controls._pointers)) controls._pointers.length = 0;
        if (Array.isArray(controls._pointerPositions)) controls._pointerPositions.length = 0;
        if (controls._state !== undefined) controls._state = -1;   // STATE.NONE
      } catch (err) {
        console.warn("[MiniGames] controls.dispose/connect failed:", err);
      }
      controls.enabled = true;
    }

    // CameraRig's eigener pointer-drag-state zurücksetzen (sonst denkt der
    // CameraRig wir wären mitten im Drag und followMode bleibt aus)
    if (cameraRig) {
      cameraRig._pointerDown = false;
      cameraRig._pointerDragged = false;
    }

    // Canvas-Cursor zurücksetzen falls noch im pointer-Hover-Modus
    if (canvas) canvas.style.cursor = "";

    // Falls Yek-Dusk gerade gelocked ist und keine Tour läuft, Auto-Cycle
    // wieder freigeben — sonst bleibt die Welt für immer im Sonnenuntergang.
    const walkthrough = this.game?.ui?.walkthrough;
    if (!walkthrough?.active) {
      this.game?.world?.dayCycle?.releaseOverride?.();
    }
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

    // DiscoveryHud-Toast + Counter erhöhen (i18n-aware)
    const ui = this.game.ui;
    const discoveryHud = ui?.discoveryHud;
    if (discoveryHud?.markDiscovered) {
      const lang = (typeof window !== "undefined" && window.__lang === "en") ? "en" : "de";
      const titleMap = lang === "en" ? {
        router: "Yek Network Audit — solved",
        hq:     "NumanOS — SQLi Lab solved",
      } : {
        router: "Yek-Netzwerk-Audit gelöst",
        hq:     "NumanOS — SQLi-Lab gelöst",
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
