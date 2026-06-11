/**
 * LoadingSplash — die Welt ist die Bühne, der Text schwebt darüber.
 *
 * Kein Karten-Formular mehr: die Szene startet nachts mit einem Spot auf
 * dem Bike (Game.js), die Kamera kreist eng darum (CameraRig-Intro-Orbit).
 * Der Splash legt nur noch eine Vignette + Typo darüber:
 *
 *   LOADING:  Name + Tagline oben, Mono-Statuszeile + dünner Balken unten.
 *   READY:    "Klick zum Start" im Display-Font, pulsierend — der GANZE
 *             Screen ist der Button (auch Enter/Space).
 *
 * Settings (Sprache/Volume/Grafik/Renderer) leben im SettingsPanel im
 * Spiel — der Start-Moment bleibt frei von Formularen.
 */

const STORAGE_KEY = "numan-portfolio-settings-v1";

const STRINGS = {
  de: {
    loading: "Lädt",
    ready: "Bereit",
    clickToStart: "Klick zum Start",
    hint: "[ mit Sound am besten ]",
    tagline: "Eine Insel. Ein Fahrrad. Mein Werdegang.",
    kicker: "Wirtschaftsinformatik · Kiel",
  },
  en: {
    loading: "Loading",
    ready: "Ready",
    clickToStart: "Click to start",
    hint: "[ best with sound ]",
    tagline: "One island. One bike. My story.",
    kicker: "Business Informatics · Kiel",
  },
};

function readLang() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && JSON.parse(raw).lang === "en") return "en";
  } catch (e) {}
  if (typeof window !== "undefined" && window.__lang === "en") return "en";
  return "de";
}

export class LoadingSplash {
  constructor(canvas) {
    this.canvas = canvas;
    this.onStart = null;
    this.ready = false;
    this.destroyed = false;
    this._lastRatio = 0;
    this._currentLabel = null;
    this._lang = readLang();

    // Lautstärke-Default für AudioManager bereitstellen (SettingsPanel
    // übernimmt die Pflege sobald das Spiel läuft).
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const vol = raw ? JSON.parse(raw).volume : undefined;
      if (typeof window !== "undefined") {
        window.__masterVolume = typeof vol === "number" ? vol : 0.7;
        window.__lang = this._lang;
      }
    } catch (e) {}

    document.body.classList.add("is-booting");
    this._buildUI();
    this._render();
  }

  _strings() {
    return STRINGS[this._lang];
  }

  _buildUI() {
    this.root = document.createElement("div");
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-modal", "true");
    this.root.setAttribute("aria-label", "Numan Yesil — Intro");
    Object.assign(this.root.style, {
      position: "fixed",
      inset: "0",
      zIndex: "30",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "7vh 24px 9vh",
      fontFamily: "var(--font-ui)",
      color: "var(--paper)",
      background:
        "radial-gradient(ellipse at center, rgba(10,8,14,0) 35%, rgba(10,8,14,0.65) 100%)",
      transition: "opacity 0.6s var(--ease)",
      opacity: "0",
      userSelect: "none",
    });

    // Puls-Animation für den Start-Prompt
    if (!document.getElementById("splash-keyframes")) {
      const style = document.createElement("style");
      style.id = "splash-keyframes";
      style.textContent = `
        @keyframes splash-pulse {
          0%, 100% { transform: scale(1); opacity: 0.92; }
          50%      { transform: scale(1.045); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .splash-start { animation: none !important; }
        }
      `;
      document.head.appendChild(style);
    }

    // ── Oben: Name + Tagline ──
    const head = document.createElement("div");
    head.style.textAlign = "center";

    const kicker = document.createElement("div");
    kicker.className = "hud-kicker";
    kicker.textContent = this._strings().kicker;
    kicker.style.marginBottom = "10px";
    head.appendChild(kicker);

    const name = document.createElement("h1");
    name.textContent = "Numan Yesil";
    Object.assign(name.style, {
      margin: "0",
      fontFamily: "var(--font-display)",
      fontSize: "clamp(56px, 9vw, 96px)",
      fontWeight: "700",
      lineHeight: "0.95",
      letterSpacing: "0.02em",
      textShadow: "0 4px 30px rgba(0,0,0,0.55)",
    });
    head.appendChild(name);

    const tagline = document.createElement("div");
    tagline.textContent = this._strings().tagline;
    Object.assign(tagline.style, {
      marginTop: "12px",
      fontSize: "16px",
      color: "var(--paper-muted)",
      textShadow: "0 2px 12px rgba(0,0,0,0.6)",
    });
    head.appendChild(tagline);

    this.root.appendChild(head);

    // ── Unten: Status / Start-Prompt ──
    this.footer = document.createElement("div");
    Object.assign(this.footer.style, {
      textAlign: "center",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "12px",
      minHeight: "110px",
      justifyContent: "flex-end",
    });
    this.root.appendChild(this.footer);

    document.body.appendChild(this.root);
    requestAnimationFrame(() => {
      this.root.style.opacity = "1";
    });

    // Ganzer Screen startet (erst wenn ready)
    this._onClick = () => {
      if (this.ready) this._handleStart();
    };
    this._onKey = (e) => {
      if (this.ready && (e.code === "Enter" || e.code === "Space")) {
        e.preventDefault();
        this._handleStart();
      }
    };
    this.root.addEventListener("click", this._onClick);
    window.addEventListener("keydown", this._onKey);
  }

  _render() {
    const s = this._strings();
    this.footer.innerHTML = "";

    if (!this.ready) {
      // Dünner Fortschrittsbalken + Mono-Status
      const bar = document.createElement("div");
      Object.assign(bar.style, {
        width: "min(260px, 60vw)",
        height: "3px",
        borderRadius: "2px",
        background: "rgba(255,255,255,0.18)",
        overflow: "hidden",
      });
      this._barInner = document.createElement("div");
      Object.assign(this._barInner.style, {
        height: "100%",
        width: `${Math.round(this._lastRatio * 100)}%`,
        background: "var(--signal)",
        borderRadius: "2px",
        transition: "width 280ms var(--ease)",
      });
      bar.appendChild(this._barInner);

      this._statusEl = document.createElement("div");
      this._statusEl.className = "hud-kicker";
      this._statusEl.textContent =
        `${this._currentLabel || s.loading} … ${Math.round(this._lastRatio * 100)}%`;

      this.footer.append(this._statusEl, bar);
    } else {
      const start = document.createElement("div");
      start.className = "splash-start";
      start.textContent = this._strings().clickToStart;
      Object.assign(start.style, {
        fontFamily: "var(--font-display)",
        fontSize: "clamp(36px, 5.5vw, 54px)",
        fontWeight: "700",
        letterSpacing: "0.03em",
        cursor: "pointer",
        animation: "splash-pulse 2.2s var(--ease) infinite",
        textShadow: "0 4px 24px rgba(0,0,0,0.6)",
      });

      const hint = document.createElement("div");
      hint.className = "hud-kicker";
      hint.textContent = this._strings().hint;

      this.footer.append(start, hint);
      this.root.style.cursor = "pointer";
    }
  }

  /** External call from Game.js on resources progress. */
  setProgress(ratio, label) {
    this._lastRatio = ratio;
    if (label) this._currentLabel = label;
    if (this._barInner) {
      this._barInner.style.width = `${Math.round(ratio * 100)}%`;
    }
    if (this._statusEl && !this.ready) {
      this._statusEl.textContent =
        `${this._currentLabel || this._strings().loading} … ${Math.round(ratio * 100)}%`;
    }
  }

  /** External call from Game.js when all assets loaded. */
  markReady() {
    if (this.ready) return;
    this.ready = true;
    setTimeout(() => this._render(), 300);
  }

  _handleStart() {
    if (this.destroyed) return;
    this.root.style.opacity = "0";
    setTimeout(() => {
      this.destroy();
      this.onStart?.();
    }, 550);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    document.body.classList.remove("is-booting");
    window.removeEventListener("keydown", this._onKey);
    this.root?.remove?.();
  }
}
