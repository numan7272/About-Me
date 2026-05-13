/**
 * HotkeyHelp — Overlay mit Liste aller Shortcuts.
 *
 * Toggle mit ? (Shift+Slash) oder Slash. Schließt sich auch mit Escape.
 *
 * Bewusst NICHT permanent angezeigt — User soll auf den Hilfe-Button klicken
 * (kleiner ?-Knopf unten rechts) oder die Taste drücken.
 */

const HOTKEYS = [
  { keys: ["W", "↑"],   label: "Forward" },
  { keys: ["S", "↓"],   label: "Backward" },
  { keys: ["A", "←"],   label: "Turn Left" },
  { keys: ["D", "→"],   label: "Turn Right" },
  { keys: ["Space"],     label: "Brake" },
  { keys: ["F"],         label: "Toggle Headlight" },
  { keys: ["C"],         label: "Toggle Collider Debug" },
  { keys: ["T"],         label: "Pause Day/Night Cycle" },
  { keys: ["M"],         label: "Snap to Day" },
  { keys: ["N"],         label: "Snap to Night" },
  { keys: ["B"],         label: "Resume Auto-Cycle" },
  { keys: ["H"],         label: "Toggle Debug GUI (debug mode)" },
  { keys: ["?", "/"],    label: "Show this help" },
];

export class HotkeyHelp {
  constructor(game) {
    this.game = game;
    this.isOpen = false;
    this._buildUI();
    this._bindKeys();
  }

  _buildUI() {
    // ── ?-Button unten rechts ──
    this.btn = document.createElement("button");
    this.btn.innerHTML = "?";
    this.btn.title = "Shortcuts (?)";
    // Auf Touch-Devices nicht anzeigen (Tastatur-Help ist da sinnlos und
    // würde mit dem TouchJoystick kollidieren).
    const isTouch = window.matchMedia?.("(pointer: coarse)")?.matches
      || "ontouchstart" in window;
    Object.assign(this.btn.style, {
      position: "fixed",
      bottom: "20px",
      left: "20px",
      width: "38px",
      height: "38px",
      borderRadius: "50%",
      border: "1px solid rgba(255, 255, 255, 0.18)",
      background: "rgba(0, 0, 0, 0.45)",
      backdropFilter: "blur(10px)",
      color: "rgba(240, 245, 250, 0.92)",
      fontSize: "18px",
      cursor: "pointer",
      zIndex: "12",
      fontFamily: "system-ui, -apple-system, sans-serif",
      transition: "background 0.15s, transform 0.2s",
      display: isTouch ? "none" : "flex",
      alignItems: "center",
      justifyContent: "center",
    });
    this.btn.addEventListener("mouseenter", () => {
      this.btn.style.background = "rgba(255, 255, 255, 0.12)";
    });
    this.btn.addEventListener("mouseleave", () => {
      this.btn.style.background = "rgba(0, 0, 0, 0.45)";
    });
    this.btn.addEventListener("click", () => this.toggle());
    document.body.appendChild(this.btn);

    // ── Modal-Overlay ──
    this.overlay = document.createElement("div");
    Object.assign(this.overlay.style, {
      position: "fixed",
      inset: "0",
      background: "rgba(4, 8, 16, 0.55)",
      backdropFilter: "blur(6px)",
      zIndex: "15",
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, -apple-system, sans-serif",
    });
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.toggle();
    });

    const panel = document.createElement("div");
    Object.assign(panel.style, {
      minWidth: "320px",
      padding: "24px 28px",
      borderRadius: "16px",
      border: "1px solid rgba(255, 255, 255, 0.16)",
      background: "rgba(10, 18, 32, 0.85)",
      color: "rgba(240, 245, 250, 0.92)",
      fontSize: "14px",
      boxShadow: "0 16px 48px rgba(0, 0, 0, 0.55)",
    });

    const title = document.createElement("div");
    title.textContent = "Shortcuts";
    Object.assign(title.style, {
      fontSize: "11px",
      textTransform: "uppercase",
      letterSpacing: "0.18em",
      color: "rgba(180, 195, 210, 0.8)",
      marginBottom: "14px",
    });
    panel.appendChild(title);

    const list = document.createElement("div");
    Object.assign(list.style, {
      display: "grid",
      gridTemplateColumns: "auto 1fr",
      gap: "10px 22px",
      alignItems: "center",
    });
    for (const row of HOTKEYS) {
      const keysCell = document.createElement("div");
      keysCell.style.display = "flex";
      keysCell.style.gap = "4px";
      for (const k of row.keys) {
        const kbd = document.createElement("kbd");
        kbd.textContent = k;
        Object.assign(kbd.style, {
          padding: "2px 8px",
          borderRadius: "5px",
          border: "1px solid rgba(255, 255, 255, 0.22)",
          background: "rgba(255, 255, 255, 0.06)",
          fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
          fontSize: "12px",
          color: "rgba(240, 245, 250, 0.96)",
          minWidth: "26px",
          textAlign: "center",
        });
        keysCell.appendChild(kbd);
      }
      const labelCell = document.createElement("div");
      labelCell.textContent = row.label;
      labelCell.style.color = "rgba(220, 230, 240, 0.85)";
      list.appendChild(keysCell);
      list.appendChild(labelCell);
    }
    panel.appendChild(list);

    const hint = document.createElement("div");
    hint.textContent = "Press ? or click outside to close";
    Object.assign(hint.style, {
      marginTop: "16px",
      fontSize: "11px",
      color: "rgba(160, 180, 200, 0.55)",
      textAlign: "center",
    });
    panel.appendChild(hint);

    this.overlay.appendChild(panel);
    document.body.appendChild(this.overlay);
  }

  _bindKeys() {
    this._onKey = (e) => {
      // Bei Eingabefeld nicht reagieren
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if ((e.key === "?" || e.key === "/") && !e.repeat) {
        e.preventDefault();
        this.toggle();
      } else if (e.code === "Escape" && this.isOpen) {
        this.toggle();
      }
    };
    window.addEventListener("keydown", this._onKey);
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.overlay.style.display = this.isOpen ? "flex" : "none";
  }

  destroy() {
    window.removeEventListener("keydown", this._onKey);
    this.btn?.remove?.();
    this.overlay?.remove?.();
  }
}
