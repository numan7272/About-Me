/**
 * LoadingSplash — die Welt ist die Bühne, der Text schwebt darüber.
 *
 * Kein Karten-Formular mehr: die Szene startet nachts mit einem Spot auf
 * dem Bike (Game.js), die Kamera kreist eng darum (CameraRig-Intro-Orbit).
 * Der Splash legt nur noch eine Vignette + Typo darüber:
 *
 *   LOADING:  Name + Tagline oben, Mono-Statuszeile + dünner Balken unten.
 *             Balken + Prozent folgen dem Byte-Fortschritt der GLBs
 *             (Resources "loading"-Event), darunter "1/2 Modelle · x/y MB".
 *   READY:    "Klick zum Start" im Display-Font, pulsierend — der GANZE
 *             Screen ist der Button (auch Enter/Space).
 *
 * Settings (Sprache/Volume/Grafik/Renderer) leben im SettingsPanel im
 * Spiel — der Start-Moment bleibt frei von Formularen.
 */

import { applyLangToDocument, getUrlLang } from "../core/i18nHead.js";

const STORAGE_KEY = "numan-portfolio-settings-v1";

const STRINGS = {
  de: {
    loading: "Lädt",
    ready: "Bereit",
    clickToStart: "Klick zum Start",
    tapToStart: "Tippen zum Start",
    hint: "[ mit Sound am besten ]",
    tagline: "Eine Insel. Ein Fahrrad. Mein Werdegang.",
    kicker: "Wirtschaftsinformatik · Kiel",
    progressLabel: "Ladefortschritt",
    models: "Modelle",
    failed: "Die 3D-Welt konnte nicht geladen werden.",
    retry: "Erneut laden",
  },
  en: {
    loading: "Loading",
    ready: "Ready",
    clickToStart: "Click to start",
    tapToStart: "Tap to start",
    hint: "[ best with sound ]",
    tagline: "One island. One bike. My story.",
    kicker: "Business Informatics · Kiel",
    progressLabel: "Loading progress",
    models: "models",
    failed: "The 3D world could not be loaded.",
    retry: "Retry loading",
  },
};

function readLang() {
  // ?lang= gewinnt — die EN-hreflang-URL muss auch ohne localStorage EN rendern
  const urlLang = getUrlLang();
  if (urlLang) return urlLang;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && JSON.parse(raw).lang === "en") return "en";
  } catch (e) {}
  if (typeof window !== "undefined" && window.__lang === "en") return "en";
  return "de";
}

function formatMB(bytes, lang) {
  const mb = bytes / (1024 * 1024);
  return mb.toLocaleString(lang === "en" ? "en-US" : "de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export class LoadingSplash {
  constructor(canvas) {
    this.canvas = canvas;
    this.onStart = null;
    // Feuert SYNCHRON im Klick-/Tasten-Handler (vor dem Fade) — für alles,
    // was eine echte User-Geste braucht (Audio-play(), Autoplay-Policy).
    this.onStartGesture = null;
    this.ready = false;
    this.destroyed = false;
    this._lastRatio = 0;
    this._currentLabel = null;
    this._info = null;
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

    // <html lang>, Canonical, hreflang + SEO-Textblock zur Sprache passend
    applyLangToDocument(this._lang);

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
    this.root.setAttribute("aria-busy", "true");
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
        "radial-gradient(ellipse at center, rgba(7,14,13,0) 35%, rgba(7,14,13,0.65) 100%)",
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
          .splash-bar-inner { transition: none !important; }
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
      bar.setAttribute("role", "progressbar");
      bar.setAttribute("aria-label", s.progressLabel);
      bar.setAttribute("aria-valuemin", "0");
      bar.setAttribute("aria-valuemax", "100");
      Object.assign(bar.style, {
        width: "min(260px, 60vw)",
        height: "3px",
        borderRadius: "2px",
        background: "rgba(255,255,255,0.18)",
        overflow: "hidden",
      });
      this._bar = bar;
      this._barInner = document.createElement("div");
      this._barInner.className = "splash-bar-inner";
      Object.assign(this._barInner.style, {
        height: "100%",
        width: "0%",
        background: "var(--signal)",
        borderRadius: "2px",
        transition: "width 280ms var(--ease)",
      });
      bar.appendChild(this._barInner);

      this._statusEl = document.createElement("div");
      this._statusEl.className = "hud-kicker";

      // Detail-Zeile: "1/2 Modelle · 7,4 / 17,8 MB"
      this._detailEl = document.createElement("div");
      this._detailEl.className = "hud-kicker";
      Object.assign(this._detailEl.style, {
        opacity: "0.7",
        fontVariantNumeric: "tabular-nums",
        minHeight: "1.2em",
      });

      this.footer.append(this._statusEl, bar, this._detailEl);
      this._paintProgress();
    } else {
      this._bar = null;
      this._barInner = null;
      this._statusEl = null;
      this._detailEl = null;
      this.root.setAttribute("aria-busy", "false");

      const start = document.createElement("div");
      start.className = "splash-start";
      start.textContent = window.matchMedia("(pointer: coarse), (max-width: 600px)").matches
        ? this._strings().tapToStart : this._strings().clickToStart;
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

  /** Schreibt den aktuellen Fortschritt in Balken, Status- und Detail-Zeile. */
  _paintProgress() {
    if (this.ready) return;
    const s = this._strings();
    const pct = Math.round(Math.min(1, Math.max(0, this._lastRatio)) * 100);

    if (this._barInner) this._barInner.style.width = `${pct}%`;
    if (this._bar) {
      this._bar.setAttribute("aria-valuenow", String(pct));
      this._bar.setAttribute("aria-valuetext", `${pct}%`);
    }
    if (this._statusEl) {
      this._statusEl.textContent = `${this._currentLabel || s.loading} … ${pct}%`;
    }
    if (this._detailEl) {
      const info = this._info;
      const parts = [];
      if (info && info.total > 0) {
        parts.push(`${info.loaded}/${info.total} ${s.models}`);
      }
      if (info && info.bytesTotal > 0) {
        const loaded = Math.min(info.bytesLoaded, info.bytesTotal);
        parts.push(`${formatMB(loaded, this._lang)} / ${formatMB(info.bytesTotal, this._lang)} MB`);
      }
      this._detailEl.textContent = parts.join(" · ");
    }
  }

  /**
   * External call from Game.js on resources progress.
   * @param {number} ratio  0..1
   * @param {string} [label] Statustext (z. B. "Lädt 3D-Welt")
   * @param {{loaded:number,total:number,bytesLoaded?:number,bytesTotal?:number}} [info]
   *   Zähler aus game.resources (fertige/gesamt Assets + Bytes)
   */
  setProgress(ratio, label, info) {
    // Monoton — kein Zurückspringen bei spät gemeldeten Dateigrößen
    this._lastRatio = Math.max(this._lastRatio, ratio || 0);
    if (label) this._currentLabel = label;
    if (info) this._info = info;
    this._paintProgress();
  }

  /** External call from Game.js when all assets loaded. */
  markReady() {
    if (this.ready || this._failed || this.destroyed) return;
    this._lastRatio = 1;
    this._paintProgress();
    this.ready = true;
    this._render();
  }

  showError() {
    if (this.destroyed || this._failed) return;
    this._failed = true;
    this.ready = false;
    this.root.setAttribute("aria-busy", "false");
    this.footer.replaceChildren();
    const message = document.createElement("p");
    message.setAttribute("role", "alert");
    message.textContent = this._strings().failed;
    const retry = document.createElement("button");
    retry.className = "hud-btn";
    retry.type = "button";
    retry.textContent = this._strings().retry;
    retry.addEventListener("click", () => location.reload());
    this.footer.append(message, retry);
    retry.focus();
  }

  _handleStart() {
    if (!this.ready || this._failed || this.destroyed || this._starting) return;
    this._starting = true;
    // Synchron in der User-Geste — Audio darf hier starten.
    try {
      this.onStartGesture?.();
    } catch (e) {
      console.warn("[Splash] onStartGesture failed:", e);
    }
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
