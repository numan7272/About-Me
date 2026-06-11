/**
 * HotkeyHelp — Overlay mit Liste aller Shortcuts.
 *
 * Brutalist-Game-HUD register:
 *   - "[F1]" text-button unten-links statt floating ?-circle
 *   - Solid ink dialog mit corner-brackets, kein blur
 *   - kbd-tags als hairline-boxed mono
 *
 * Toggle: F1, ? oder /. Schließt mit Esc / Click outside.
 */

const HOTKEYS = [
  { keys: ["W", "↑"],   label: "forward" },
  { keys: ["S", "↓"],   label: "backward" },
  { keys: ["A", "←"],   label: "turn left" },
  { keys: ["D", "→"],   label: "turn right" },
  { keys: ["Space"],     label: "brake" },
  { keys: ["F"],         label: "toggle headlight" },
  { keys: ["C"],         label: "toggle collider debug" },
  { keys: ["T"],         label: "pause day/night cycle" },
  { keys: ["M"],         label: "snap to day" },
  { keys: ["N"],         label: "snap to night" },
  { keys: ["B"],         label: "resume auto-cycle" },
  { keys: ["H"],         label: "toggle debug gui" },
  { keys: ["F1", "?"],   label: "show this help" },
];

export class HotkeyHelp {
  constructor(game) {
    this.game = game;
    this.isOpen = false;
    this._buildUI();
    this._bindKeys();
  }

  _buildUI() {
    this.btn = document.createElement("button");
    this.btn.type = "button";
    this.btn.className = "hud-btn";
    this.btn.textContent = "[F1] help";
    this.btn.setAttribute("aria-label", "show keyboard shortcuts");
    const isTouch = window.matchMedia?.("(pointer: coarse)")?.matches
      || "ontouchstart" in window;
    // Chrome-Tier: dezent text-only, kein ink-solid Frame.
    Object.assign(this.btn.style, {
      position: "fixed",
      bottom: "18px",
      left: "18px",
      zIndex: "12",
      display: isTouch ? "none" : "inline-flex",
      fontSize: "11px",
      color: "var(--paper-muted)",
      padding: "6px 8px",
      minHeight: "32px",
      background: "transparent",
    });
    this.btn.addEventListener("click", () => this.toggle());
    document.body.appendChild(this.btn);

    this.overlay = document.createElement("div");
    Object.assign(this.overlay.style, {
      position: "fixed",
      inset: "0",
      background: "rgba(10, 19, 18, 0.55)",
      zIndex: "15",
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "var(--font-mono)",
    });
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.toggle();
    });

    const panel = document.createElement("div");
    panel.className = "hud-bracket";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "keyboard shortcuts");
    Object.assign(panel.style, {
      minWidth: "320px",
      maxWidth: "min(440px, calc(100vw - 32px))",
      padding: "22px 24px 20px",
      background: "var(--ink-solid)",
      color: "var(--paper)",
      fontSize: "13px",
    });
    panel.append(this._cornerSpan("tr"), this._cornerSpan("bl"));

    const title = document.createElement("div");
    title.className = "hud-kicker";
    title.textContent = "> shortcuts";
    title.style.marginBottom = "14px";
    panel.appendChild(title);

    const list = document.createElement("div");
    Object.assign(list.style, {
      display: "grid",
      gridTemplateColumns: "auto 1fr",
      gap: "8px 20px",
      alignItems: "center",
    });
    for (const row of HOTKEYS) {
      const keysCell = document.createElement("div");
      Object.assign(keysCell.style, { display: "flex", gap: "4px" });
      for (const k of row.keys) {
        const kbd = document.createElement("kbd");
        kbd.textContent = k;
        Object.assign(kbd.style, {
          padding: "2px 7px",
          border: "1px solid var(--rule-strong)",
          borderRadius: "4px",
          background: "transparent",
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          color: "var(--paper)",
          minWidth: "24px",
          textAlign: "center",
        });
        keysCell.appendChild(kbd);
      }
      const labelCell = document.createElement("div");
      labelCell.textContent = row.label;
      labelCell.style.color = "var(--paper)";
      labelCell.style.fontFamily = "var(--font-ui)";
      labelCell.style.fontSize = "14px";
      list.appendChild(keysCell);
      list.appendChild(labelCell);
    }
    panel.appendChild(list);

    const hint = document.createElement("div");
    hint.textContent = "[esc] close";
    Object.assign(hint.style, {
      marginTop: "16px",
      fontSize: "11px",
      color: "var(--paper-dim)",
      textAlign: "right",
    });
    panel.appendChild(hint);

    this.overlay.appendChild(panel);
    document.body.appendChild(this.overlay);
  }

  _cornerSpan(corner) {
    const s = document.createElement("span");
    s.className = `hud-bracket-${corner}`;
    return s;
  }

  _bindKeys() {
    this._onKey = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if ((e.key === "?" || e.key === "/" || e.key === "F1") && !e.repeat) {
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
    this.btn.dataset.active = String(this.isOpen);
  }

  destroy() {
    window.removeEventListener("keydown", this._onKey);
    this.btn?.remove?.();
    this.overlay?.remove?.();
  }
}
