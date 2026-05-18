/**
 * Hud — Speed-Anzeige unten-links + Recenter-Button.
 *
 * Brutalist-Game-HUD register:
 *   - Speed anchored bottom-left (nicht zentriert)
 *   - Corner-brackets statt rounded card
 *   - Numeral wechselt zu --signal bei ≥ SIGNAL_THRESHOLD km/h
 *   - Recenter-Button als reiner Text mit hover-underline
 */

const SIGNAL_THRESHOLD = 25;

export class Hud {
  constructor(game) {
    this.game = game;

    this.root = document.createElement("div");
    this.root.id = "hud-root";
    Object.assign(this.root.style, {
      position: "fixed",
      inset: "0",
      pointerEvents: "none",
      zIndex: "10",
      fontFamily: "var(--font-mono)",
      color: "var(--paper)",
      userSelect: "none",
    });
    document.body.appendChild(this.root);

    this._buildSpeedHud();
    this._buildRecenterButton();
  }

  _buildSpeedHud() {
    const wrap = document.createElement("div");
    wrap.className = "hud-bracket";
    Object.assign(wrap.style, {
      position: "absolute",
      bottom: "24px",
      left: "24px",
      padding: "10px 14px 8px",
      display: "flex",
      alignItems: "baseline",
      gap: "8px",
      pointerEvents: "none",
    });
    wrap.append(this._cornerSpan("tr"), this._cornerSpan("bl"));

    const caret = document.createElement("span");
    caret.textContent = "▌";
    Object.assign(caret.style, {
      color: "var(--paper-muted)",
      fontSize: "14px",
      lineHeight: "1",
      marginRight: "2px",
    });

    this.speedValue = document.createElement("span");
    this.speedValue.textContent = "0";
    Object.assign(this.speedValue.style, {
      fontSize: "clamp(40px, 6vw, 64px)",
      fontWeight: "400",
      lineHeight: "1",
      fontVariantNumeric: "tabular-nums",
      letterSpacing: "-0.02em",
      transition: "color 180ms var(--ease)",
    });

    const unit = document.createElement("span");
    unit.textContent = "km/h";
    Object.assign(unit.style, {
      fontSize: "11px",
      color: "var(--paper-muted)",
      letterSpacing: "0.06em",
    });

    wrap.append(caret, this.speedValue, unit);
    this.root.appendChild(wrap);
    this.speedHud = wrap;
  }

  _buildRecenterButton() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hud-btn";
    btn.setAttribute("aria-label", "recenter camera");
    btn.textContent = "↺ recenter";
    Object.assign(btn.style, {
      position: "absolute",
      bottom: "100px",
      left: "50%",
      transform: "translateX(-50%)",
      pointerEvents: "auto",
      display: "none",
      letterSpacing: "0.04em",
      background: "var(--ink-solid)",
    });
    btn.addEventListener("click", () => {
      if (this.game.cameraRig) this.game.cameraRig.recenter();
    });

    this.root.appendChild(btn);
    this.recenterBtn = btn;
  }

  _cornerSpan(corner) {
    const s = document.createElement("span");
    s.className = `hud-bracket-${corner}`;
    return s;
  }

  update() {
    const player = this.game.world?.player;
    if (player?.body && this.speedValue) {
      const v = player.body.linvel();
      const SPEED_DISPLAY_SCALE = 32 / (4.5 * 3.6);
      const kmh = Math.hypot(v.x, v.z) * 3.6 * SPEED_DISPLAY_SCALE;
      this.speedValue.textContent = kmh.toFixed(0);
      this.speedValue.style.color =
        kmh >= SIGNAL_THRESHOLD ? "var(--signal)" : "var(--paper)";
    }

    if (this.recenterBtn && this.game.cameraRig) {
      const show = !this.game.cameraRig.followMode;
      this.recenterBtn.style.display = show ? "inline-flex" : "none";
      const drawerOpen = !!this.game?.ui?.drawer?.isOpen;
      this.recenterBtn.style.bottom = drawerOpen ? "280px" : "100px";
    }
  }

  destroy() {
    this.root?.remove?.();
  }
}
