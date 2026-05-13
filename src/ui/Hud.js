/**
 * Hud — Top-Level HUD-Overlay.
 *
 * Sub-Elemente:
 *   - HintBar (oben Mitte: "Drive with WASD")
 *   - SpeedHud (unten Mitte: aktuelle Geschwindigkeit in km/h)
 *   - RecenterButton (Mitte unten: nur sichtbar wenn followMode = false)
 *
 * Alle HTML-Elemente werden in einen overlay-Container am body angehängt
 * — pointer-events: none auf dem Container, opt-in pro Element.
 */

export class Hud {
  constructor(game) {
    this.game = game;

    // Wrapper div — fullscreen overlay
    this.root = document.createElement("div");
    this.root.id = "hud-root";
    Object.assign(this.root.style, {
      position: "fixed",
      inset: "0",
      pointerEvents: "none",
      zIndex: "10",
      fontFamily: "system-ui, -apple-system, sans-serif",
      color: "white",
      userSelect: "none",
    });
    document.body.appendChild(this.root);

    this._buildHintBar();
    this._buildSpeedHud();
    this._buildRecenterButton();
  }

  _buildHintBar() {
    const wrap = document.createElement("div");
    Object.assign(wrap.style, {
      position: "absolute",
      top: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      textAlign: "center",
      pointerEvents: "none",
    });

    const eyebrow = document.createElement("div");
    eyebrow.textContent = "Numan's Roadmap";
    Object.assign(eyebrow.style, {
      fontSize: "10px",
      textTransform: "uppercase",
      letterSpacing: "0.32em",
      color: "rgba(160, 170, 180, 0.85)",
    });

    const sub = document.createElement("div");
    sub.textContent = "Drive with W A S D · Brake with Space · F = Headlight";
    Object.assign(sub.style, {
      marginTop: "4px",
      fontSize: "12px",
      color: "rgba(220, 225, 230, 0.85)",
    });

    wrap.appendChild(eyebrow);
    wrap.appendChild(sub);
    this.root.appendChild(wrap);
    this.hintBar = wrap;
  }

  _buildSpeedHud() {
    const wrap = document.createElement("div");
    Object.assign(wrap.style, {
      position: "absolute",
      bottom: "24px",
      left: "50%",
      transform: "translateX(-50%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "2px",
      pointerEvents: "none",
      padding: "8px 18px",
      background: "rgba(0, 0, 0, 0.35)",
      backdropFilter: "blur(8px)",
      borderRadius: "12px",
      border: "1px solid rgba(255, 255, 255, 0.12)",
    });

    this.speedValue = document.createElement("div");
    this.speedValue.textContent = "0";
    Object.assign(this.speedValue.style, {
      fontSize: "28px",
      fontWeight: "600",
      lineHeight: "1",
      fontVariantNumeric: "tabular-nums",
    });

    const unit = document.createElement("div");
    unit.textContent = "km/h";
    Object.assign(unit.style, {
      fontSize: "10px",
      textTransform: "uppercase",
      letterSpacing: "0.25em",
      color: "rgba(200, 210, 220, 0.75)",
    });

    wrap.appendChild(this.speedValue);
    wrap.appendChild(unit);
    this.root.appendChild(wrap);
    this.speedHud = wrap;
  }

  _buildRecenterButton() {
    const btn = document.createElement("button");
    btn.textContent = "↺  Recenter Camera";
    Object.assign(btn.style, {
      position: "absolute",
      bottom: "100px",
      left: "50%",
      transform: "translateX(-50%)",
      padding: "10px 22px",
      borderRadius: "999px",
      border: "1px solid rgba(255, 255, 255, 0.18)",
      background: "rgba(0, 0, 0, 0.45)",
      backdropFilter: "blur(10px)",
      color: "rgba(240, 245, 250, 0.92)",
      fontSize: "12px",
      letterSpacing: "0.05em",
      cursor: "pointer",
      pointerEvents: "auto",
      display: "none",   // Sichtbarkeit wird in update() gesteuert
      transition: "background 0.15s, transform 0.1s",
    });
    btn.addEventListener("mouseenter", () => {
      btn.style.background = "rgba(255, 255, 255, 0.12)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.background = "rgba(0, 0, 0, 0.45)";
    });
    btn.addEventListener("click", () => {
      if (this.game.cameraRig) {
        this.game.cameraRig.recenter();
      }
    });

    this.root.appendChild(btn);
    this.recenterBtn = btn;
  }

  update() {
    // Speed-Update
    const player = this.game.world?.player;
    if (player?.body && this.speedValue) {
      const v = player.body.linvel();
      // m/s → km/h, dann skaliert damit Top-Speed (4.5 m/s) bei 32 km/h liegt
      // Skalierung: 32 km/h Anzeige / (4.5 m/s * 3.6) ≈ 1.975
      const SPEED_DISPLAY_SCALE = 32 / (4.5 * 3.6);
      const kmh = Math.hypot(v.x, v.z) * 3.6 * SPEED_DISPLAY_SCALE;
      this.speedValue.textContent = kmh.toFixed(0);
    }

    // Recenter-Button-Sichtbarkeit
    if (this.recenterBtn && this.game.cameraRig) {
      const show = !this.game.cameraRig.followMode;
      this.recenterBtn.style.display = show ? "block" : "none";
    }
  }

  destroy() {
    this.root?.remove?.();
  }
}
