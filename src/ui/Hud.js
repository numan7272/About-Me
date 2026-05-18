/**
 * Hud — Speed-Anzeige unten-links + Recenter-Button.
 *
 * Brutalist-Game-HUD register:
 *   - Speed anchored bottom-left, auto-hide bei 0 km/h + Idle
 *   - Numeral wechselt zu --signal bei ≥ SIGNAL_THRESHOLD km/h
 *   - Recenter klein, bottom-right, auto-fade nach 8s ohne Interaktion
 */

const MAX_DISPLAY_SPEED = 25;          // Top-Speed-Anzeige cappt bei 25 km/h
const SIGNAL_THRESHOLD = MAX_DISPLAY_SPEED;  // Coral wenn flat-out
const SPEED_IDLE_HIDE_DELAY = 1200;   // ms ohne Bewegung bevor Speed-HUD ausblendet
const RECENTER_AUTO_HIDE_DELAY = 8000; // ms bis Recenter-Hint sich versteckt

export class Hud {
  constructor(game) {
    this.game = game;
    this._lastNonZeroSpeed = 0;
    this._speedVisible = false;
    this._recenterShownAt = 0;
    this._recenterUserHidden = false;

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
      opacity: "0",
      transform: "translateY(8px)",
      transition: "opacity 240ms var(--ease), transform 240ms var(--ease)",
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

  _setSpeedVisible(visible) {
    if (visible === this._speedVisible) return;
    this._speedVisible = visible;
    this.speedHud.style.opacity = visible ? "1" : "0";
    this.speedHud.style.transform = visible
      ? "translateY(0)"
      : "translateY(8px)";
  }

  _buildRecenterButton() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("aria-label", "recenter camera");
    btn.textContent = "↺ recenter";
    Object.assign(btn.style, {
      position: "absolute",
      bottom: "16px",
      right: "16px",
      padding: "8px 10px",
      pointerEvents: "auto",
      display: "none",
      background: "transparent",
      border: "0",
      color: "var(--paper-muted)",
      fontFamily: "var(--font-mono)",
      fontSize: "12px",
      letterSpacing: "0.04em",
      cursor: "pointer",
      opacity: "0",
      transition: "opacity 240ms var(--ease), color 180ms var(--ease)",
    });
    btn.addEventListener("mouseenter", () => {
      btn.style.color = "var(--signal)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.color = "var(--paper-muted)";
    });
    btn.addEventListener("click", () => {
      if (this.game.cameraRig) this.game.cameraRig.recenter();
      this._recenterUserHidden = true;   // nach Click verstecken bis followMode wieder false
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
    const tourActive = !!this.game?.ui?.walkthrough?.active;

    // ── Speed-Anzeige ──
    // Top-Speed bei 25 km/h cappen (war 32). Skalierung: 4.5 m/s physischer
    // Top → 25 km/h Display. Math.min schützt gegen kurze Physics-Spikes.
    let kmh = 0;
    if (player?.body && this.speedValue) {
      const v = player.body.linvel();
      const SCALE = MAX_DISPLAY_SPEED / (4.5 * 3.6);
      kmh = Math.min(MAX_DISPLAY_SPEED, Math.hypot(v.x, v.z) * 3.6 * SCALE);
      this.speedValue.textContent = kmh.toFixed(0);
      this.speedValue.style.color =
        kmh >= SIGNAL_THRESHOLD ? "var(--signal)" : "var(--paper)";
    }

    // Speed-HUD auto-hide: sichtbar wenn aktuelle Speed > 0.5 oder kürzlich
    // > 0 (Idle-Delay) oder Tour aktiv (Telemetrie-Kontext soll im Tour-
    // Modus sichtbar bleiben, auch wenn das Bike gefroren ist).
    const now = performance.now();
    if (kmh > 0.5) this._lastNonZeroSpeed = now;
    const recentlyMoved = (now - this._lastNonZeroSpeed) < SPEED_IDLE_HIDE_DELAY;
    this._setSpeedVisible(tourActive || recentlyMoved);

    // ── Recenter-Button ──
    // Sichtbar wenn followMode=false UND noch nicht user-hidden. Auto-fade
    // nach RECENTER_AUTO_HIDE_DELAY damit der Hint nicht ewig dasteht.
    if (this.recenterBtn && this.game.cameraRig) {
      const followOff = !this.game.cameraRig.followMode;
      if (followOff && this._recenterShownAt === 0) {
        this._recenterShownAt = now;
        this._recenterUserHidden = false;
      }
      if (!followOff) {
        this._recenterShownAt = 0;
        this._recenterUserHidden = false;
      }
      const age = this._recenterShownAt > 0 ? now - this._recenterShownAt : 0;
      const autoHidden = age >= RECENTER_AUTO_HIDE_DELAY;
      const shouldShow = followOff && !this._recenterUserHidden && !autoHidden;
      this.recenterBtn.style.display = shouldShow ? "inline-block" : "none";
      this.recenterBtn.style.opacity = shouldShow ? "1" : "0";
    }
  }

  destroy() {
    this.root?.remove?.();
  }
}
