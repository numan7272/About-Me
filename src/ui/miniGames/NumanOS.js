/**
 * NumanOS — Fake macOS-Desktop als HQ-Easter-Egg.
 *
 * Story-Frame: "Das ist mein Dev-Setup". Recruiter klickt auf HQ, sieht einen
 * Boot-Screen, dann einen macOS-Desktop mit ein paar Apps + Folders. Versteckt
 * auf dem Desktop liegt eine Datei `TODO_fix_sql_injection.txt` die beim
 * Klick das SQL-Injection-Lab öffnet.
 *
 * Apps:
 *   - Browser.app    — Mini-Chrome mit 2 Tabs: deine Portfolio-URL + die SQLi-Vuln
 *   - Projects/      — Folder mit deinen echten Projekten (Funke, Synapser, ...)
 *   - Terminal.app   — kann wieder den Router-Pentest aufrufen oder lokal sein
 *   - README.txt     — about me Text
 *   - TODO_*.txt     — Einstieg in SQLi-Lab (versteckt aber findbar)
 *
 * Implementation: alles DOM-overlay, kein 3D. Lazy-import damit der Bundle
 * Initial-Cost niedrig bleibt.
 */

const NOW_HHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// Inline-SVG-Icons (Lucide-style 1.6px stroke, currentColor). Ersetzt
// Browser-/OS-Emojis die plattform-abhängig pixelig oder farbverdreht
// gerendert wurden. Hier sind die Icons monochrom + theme-kompatibel.
const NOS_ICONS = {
  globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  folder: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  terminal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
  fileText: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  fileEdit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M10.4 16.6L17 10l-3-3-6.6 6.6V17h2.4z"/></svg>`,
};

const DESKTOP_FILES = [
  {
    id: "browser",
    label: "Browser",
    icon: NOS_ICONS.globe,
    type: "app",
  },
  {
    id: "projects",
    label: "Projects",
    icon: NOS_ICONS.folder,
    type: "folder",
  },
  {
    id: "terminal",
    label: "Terminal",
    icon: NOS_ICONS.terminal,
    type: "app",
  },
  {
    id: "readme",
    label: "README.txt",
    icon: NOS_ICONS.fileText,
    type: "textfile",
  },
  {
    id: "todo_sqli",
    label: "TODO_fix_sql_injection.txt",
    icon: NOS_ICONS.fileEdit,
    type: "trigger_sqli",
  },
];

const README_CONTENT = `# numan-os v1.0

This is a simulated desktop. Real one is back on my actual machine.

What you can do here:
  · Open Browser → my live portfolio (you're already there, kinda)
  · Open Projects/ → my actual repos (Funke, Synapser, etc.)
  · Open Terminal → a real shell sandbox (try \`uname -a\`)
  · Read this file
  · ...and maybe one more thing if you read carefully

I'm Numan, Wirtschaftsinformatik student at HAW Kiel.
Practice > theory. Always.

— n
`;

// Alle öffentlichen Repos von github.com/numan7272 (Stand 05/2026).
// Click auf eine Card → öffnet das GitHub-Repo in neuem Tab.
// SQLi-Lab läuft separat über die TODO-Datei auf dem Desktop.
const PROJECTS = [
  {
    name: "About-Me",
    sub: "JavaScript · 3D Portfolio (aktiv)",
    body: "Diese Seite. Vite + Three.js (WebGL + WebGPU) + Rapier3D Physik. Bike-Steuerung, custom Shader-Pipeline, versteckte Mini-Game-Labs. Source für alles was du gerade siehst.",
    url: "https://github.com/numan7272/About-Me",
  },
  {
    name: "synapser-backend",
    sub: "Python · FastAPI + Google OR-Tools",
    body: "Core-Backend für Synapser — AI-driven Scheduling-Plattform. Löst Constraint-Satisfaction-Probleme in Echtzeit, plus Real-time-Rescheduling und externe API-Integrationen (Geo, Weather, Smart-Home).",
    url: "https://github.com/numan7272/synapser-backend",
  },
  {
    name: "synapser-frontend",
    sub: "C++ · Native UI Companion",
    body: "Native UI-Frontend für Synapser. Companion zum FastAPI-Backend.",
    url: "https://github.com/numan7272/synapser-frontend",
  },
  {
    name: "OmniView",
    sub: "TypeScript · Multi-Source Dashboard",
    body: "Unified Dashboard für mehrere Live-Datenquellen — Kameras, Logs, Sensor-Feeds zusammen in einer UI.",
    url: "https://github.com/numan7272/OmniView",
  },
  {
    name: "funke",
    sub: "JavaScript · Self-hosted Voice/Chat",
    body: "Self-hosted Discord-Alternative mit Real-time Messaging, WebRTC Voice-Chat und Screen-Sharing. Self-hosted weil Discord/Slack overkill waren und ich Kontrolle über den Signaling-Server wollte.",
    url: "https://github.com/numan7272/funke",
  },
  {
    name: "GlyphFall",
    sub: "JavaScript · Sandbox-Experiment",
    body: "Browser-Side-Projekt. WIP, im Aufbau.",
    url: "https://github.com/numan7272/GlyphFall",
  },
  {
    name: "youtube-converter",
    sub: "Python · Media-Utility",
    body: "Kommandozeilen-Tool zum Konvertieren von YouTube-Videos in Audio/Video-Formate. yt-dlp basiert.",
    url: "https://github.com/numan7272/youtube-converter",
  },
  {
    name: "CaptureStream",
    sub: "Python · Stream-Capture",
    body: "Headless-Tool zum Aufzeichnen von Live-Streams. Python-basiert, lokales Storage.",
    url: "https://github.com/numan7272/CaptureStream",
  },
  {
    name: "omni-view",
    sub: "TypeScript · OmniView-Prototyp",
    body: "Früher Prototyp / Vorgänger von OmniView. Eingefroren — der aktive Code liegt im großgeschriebenen Repo.",
    url: "https://github.com/numan7272/omni-view",
  },
  {
    name: "Python-Projekt",
    sub: "Python · Lern-Log",
    body: "Sammelsurium aus Python-Übungen während ich die Sprache aufgebaut habe. Algorithmen, kleine Tools, Snippets. Tägliche Commits als Disziplin-Marker.",
    url: "https://github.com/numan7272/Python-Projekt",
  },
];

const TERMINAL_BANNER = [
  "Welcome to numan-os Terminal (sandbox)",
  "Type `help` for commands, `exit` to close.",
  "",
];

const TERMINAL_COMMANDS = {
  help: () => [
    "Available commands:",
    "  whoami      — current user",
    "  uname -a    — system info",
    "  ls          — list /home/numan",
    "  cat <file>  — read a file",
    "  history     — recent commands",
    "  pwd         — current directory",
    "  date        — current time",
    "  clear       — clear screen",
    "  exit        — close terminal",
  ],
  whoami: () => "numan",
  pwd: () => "/home/numan",
  date: () => new Date().toString(),
  ls: () => [
    "Desktop/   Documents/   Downloads/   Projects/",
    "Pictures/  Music/       .bash_history",
  ],
  history: () => [
    "  1  cd Projects/sqli-sandbox",
    "  2  python3 -m http.server 8080",
    "  3  curl -X POST http://localhost:8080/login -d \"user=admin' OR 1=1 --&pass=x\"",
    "  4  vim notes/payloads.md",
    "  5  git commit -m 'practice: tautology bypass works'",
    "  6  git push origin main",
    "  7  history",
  ],
};

export class NumanOS {
  constructor(game) {
    this.game = game;
    this.dom = null;
    this.windowStack = [];      // Stack offener Fenster (für z-index management)
    this.zCounter = 100;
    this._success = false;       // SQLi gelöst?
  }

  open() {
    if (this.dom) return;
    this._buildDom();
    document.body.appendChild(this.dom.root);
    this._startBootSequence();
  }

  _buildDom() {
    const root = document.createElement("div");
    root.className = "nos-root";
    root.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: #1d1d1f;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif;
      color: #f5f5f7;
      opacity: 0; transition: opacity 220ms ease;
      overflow: hidden;
      user-select: none;
      -webkit-user-select: none;
    `;

    // Style-Block für alles
    const style = document.createElement("style");
    style.textContent = `
      .nos-root *, .nos-root *::before, .nos-root *::after { box-sizing: border-box; }

      /* ── Boot Screen ── */
      .nos-boot {
        position: absolute; inset: 0;
        background: #000;
        display: flex; flex-direction: column;
        justify-content: center; align-items: center;
        padding: 40px;
        font-family: 'JetBrains Mono', 'SF Mono', 'Courier New', monospace;
        font-size: 13px;
        color: #b6f7b6;
        transition: opacity 400ms ease;
      }
      .nos-boot-logo {
        font-size: 64px; margin-bottom: 18px; opacity: 0.95;
      }
      .nos-boot-line {
        opacity: 0; animation: nosBootFade 280ms ease forwards;
      }
      @keyframes nosBootFade { to { opacity: 1; } }

      /* ── Desktop ── */
      .nos-desktop {
        position: absolute; inset: 0;
        background:
          radial-gradient(1200px 800px at 20% 30%, rgba(85,150,255,0.18), transparent 60%),
          radial-gradient(900px 700px at 80% 70%, rgba(220,90,180,0.13), transparent 60%),
          linear-gradient(135deg, #1d1d1f 0%, #0b0b0d 100%);
        opacity: 0; transition: opacity 320ms ease;
        display: flex; flex-direction: column;
      }
      .nos-desktop.shown { opacity: 1; }

      /* ── Top Menu Bar ── */
      .nos-menubar {
        height: 26px;
        background: rgba(40,40,42,0.7);
        backdrop-filter: saturate(180%) blur(14px);
        -webkit-backdrop-filter: saturate(180%) blur(14px);
        border-bottom: 1px solid rgba(255,255,255,0.06);
        display: flex; align-items: center;
        padding: 0 14px;
        font-size: 13px;
        flex-shrink: 0;
        z-index: 1000;
      }
      .nos-menubar-left {
        display: flex; align-items: center; gap: 16px; flex: 1;
      }
      .nos-menubar-right {
        display: flex; align-items: center; gap: 14px;
      }
      .nos-menu-apple { font-size: 14px; }
      .nos-menu-app { font-weight: 600; }
      .nos-menu-item { opacity: 0.8; font-weight: 400; }
      .nos-menubar-right .nos-menu-item { font-size: 12px; }
      .nos-close-os {
        cursor: pointer;
        background: rgba(255,90,90,0.25);
        border: 1px solid rgba(255,90,90,0.4);
        color: #ffaaaa;
        padding: 1px 9px;
        border-radius: 4px;
        font-size: 11px;
      }
      .nos-close-os:hover { background: rgba(255,90,90,0.42); color: #fff; }

      /* ── Desktop Area + Icons ── */
      .nos-desktop-area {
        flex: 1; position: relative;
        overflow: hidden;
        padding: 28px 36px;
      }
      .nos-icons {
        display: grid;
        grid-template-columns: repeat(auto-fill, 88px);
        gap: 16px;
        align-content: start;
      }
      .nos-icon {
        display: flex; flex-direction: column; align-items: center;
        gap: 6px;
        padding: 8px 6px;
        border-radius: 8px;
        cursor: pointer;
        transition: background 120ms ease;
        text-align: center;
      }
      .nos-icon:hover { background: rgba(255,255,255,0.07); }
      .nos-icon.selected { background: rgba(80,140,255,0.32); }
      .nos-icon-glyph {
        font-size: 38px;
        line-height: 1;
        color: #fff;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
      }
      .nos-icon-label {
        font-size: 12px;
        line-height: 1.25;
        word-break: break-word;
        color: #fff;
        text-shadow: 0 1px 2px rgba(0,0,0,0.65);
      }
      .nos-icon[data-type="trigger_sqli"] .nos-icon-label {
        color: #ffd97a;
      }
      .nos-icon[data-type="trigger_sqli"] .nos-icon-glyph { color: #ffd97a; }
      .nos-icon-glyph svg {
        width: 42px; height: 42px;
        display: block;
      }
      .nos-dock-icon svg {
        width: 32px; height: 32px;
        display: block;
      }
      .nos-dock-icon { color: #fff; }

      /* ── Dock ── */
      .nos-dock {
        position: absolute; left: 50%; bottom: 12px;
        transform: translateX(-50%);
        background: rgba(48,48,50,0.55);
        backdrop-filter: saturate(180%) blur(20px);
        -webkit-backdrop-filter: saturate(180%) blur(20px);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 16px;
        padding: 8px 12px;
        display: flex; gap: 10px;
        box-shadow: 0 12px 40px rgba(0,0,0,0.5);
        z-index: 800;
      }
      .nos-dock-icon {
        font-size: 32px;
        cursor: pointer;
        transition: transform 180ms ease;
        line-height: 1;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
      }
      .nos-dock-icon:hover { transform: translateY(-6px) scale(1.15); }

      /* ── Windows ── */
      .nos-window {
        position: absolute;
        background: rgba(40,40,42,0.96);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 10px;
        box-shadow: 0 24px 60px rgba(0,0,0,0.55);
        display: flex; flex-direction: column;
        overflow: hidden;
        min-width: 380px; min-height: 240px;
        opacity: 0; transform: scale(0.94);
        transition: opacity 180ms ease, transform 180ms ease;
      }
      .nos-window.shown { opacity: 1; transform: scale(1); }
      .nos-win-titlebar {
        height: 30px;
        background: linear-gradient(180deg, rgba(60,60,62,0.95), rgba(48,48,50,0.95));
        border-bottom: 1px solid rgba(255,255,255,0.05);
        display: flex; align-items: center;
        padding: 0 10px;
        cursor: grab;
        gap: 8px;
        flex-shrink: 0;
      }
      .nos-traffic {
        display: flex; gap: 7px; align-items: center;
      }
      .nos-traffic-btn {
        width: 12px; height: 12px; border-radius: 50%;
        border: 0.5px solid rgba(0,0,0,0.15);
        cursor: pointer;
      }
      .nos-traffic-close { background: #ff5f57; }
      .nos-traffic-min   { background: #ffbd2e; }
      .nos-traffic-max   { background: #28c93f; }
      .nos-traffic-btn {
        display: inline-flex; align-items: center; justify-content: center;
        font-size: 9px; font-weight: 700;
        color: rgba(0,0,0,0); line-height: 1;
        user-select: none;
        transition: color 100ms;
      }
      .nos-traffic:hover .nos-traffic-btn { color: rgba(0,0,0,0.5); }

      /* Resize-Handles */
      .nos-resize-handle {
        position: absolute;
        z-index: 10;
      }
      .nos-resize-n { top: -3px; left: 8px; right: 8px; height: 6px; cursor: ns-resize; }
      .nos-resize-s { bottom: -3px; left: 8px; right: 8px; height: 6px; cursor: ns-resize; }
      .nos-resize-e { top: 8px; right: -3px; bottom: 8px; width: 6px; cursor: ew-resize; }
      .nos-resize-w { top: 8px; left: -3px; bottom: 8px; width: 6px; cursor: ew-resize; }
      .nos-resize-ne { top: -3px; right: -3px; width: 12px; height: 12px; cursor: nesw-resize; }
      .nos-resize-nw { top: -3px; left: -3px; width: 12px; height: 12px; cursor: nwse-resize; }
      .nos-resize-se { bottom: -3px; right: -3px; width: 12px; height: 12px; cursor: nwse-resize; }
      .nos-resize-sw { bottom: -3px; left: -3px; width: 12px; height: 12px; cursor: nesw-resize; }

      /* Minimized State — slidet ins Dock */
      .nos-win-minimized {
        transform: scale(0.05) translateY(800px) !important;
        opacity: 0 !important;
        pointer-events: none;
        transition: transform 280ms ease, opacity 220ms;
      }
      .nos-win-title {
        flex: 1; text-align: center; font-size: 13px;
        opacity: 0.85; font-weight: 500;
      }
      .nos-win-body {
        flex: 1; overflow: auto; padding: 16px 18px;
        font-size: 13px; line-height: 1.5;
      }
      .nos-win-body code, .nos-win-body pre {
        font-family: 'JetBrains Mono', 'SF Mono', monospace;
      }

      /* ── Browser-App ── */
      .nos-browser-bar {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 12px;
        background: rgba(28,28,30,0.85);
        border-bottom: 1px solid rgba(255,255,255,0.06);
        flex-shrink: 0;
      }
      .nos-browser-tabs {
        display: flex; gap: 4px; flex: 1;
      }
      .nos-browser-tab {
        padding: 5px 12px;
        background: rgba(255,255,255,0.05);
        border-radius: 6px 6px 0 0;
        font-size: 12px;
        cursor: pointer;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .nos-browser-tab.active {
        background: rgba(80,140,255,0.25);
        color: #fff;
      }
      .nos-browser-url {
        padding: 5px 10px;
        background: rgba(255,255,255,0.06);
        border-radius: 6px;
        font-size: 12px;
        font-family: 'JetBrains Mono', monospace;
        opacity: 0.75;
        flex: 1;
        max-width: 100%;
      }
      .nos-browser-content {
        flex: 1; overflow: auto;
        padding: 24px 28px;
        background: rgba(20,20,22,0.6);
      }

      /* ── Project-List ── */
      .nos-projects { display: flex; flex-direction: column; gap: 8px; }
      .nos-project {
        padding: 12px 14px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 8px;
        cursor: pointer;
        transition: all 150ms ease;
      }
      .nos-project:hover {
        background: rgba(80,140,255,0.12);
        border-color: rgba(80,140,255,0.30);
      }
      .nos-project-name {
        font-weight: 600;
        font-size: 14px;
        margin-bottom: 4px;
      }
      .nos-project-sub {
        font-size: 11px;
        opacity: 0.65;
        margin-bottom: 6px;
        font-family: 'JetBrains Mono', monospace;
      }
      .nos-project-body {
        font-size: 12px;
        opacity: 0.78;
        line-height: 1.55;
      }
      .nos-project.vuln-hint {
        border-color: rgba(255,217,122,0.22);
      }
      .nos-project.vuln-hint::after {
        content: "⚠ vulnerable — try /admin";
        display: block;
        margin-top: 8px;
        font-size: 11px;
        color: #ffd97a;
        opacity: 0.85;
      }
      .nos-project-link {
        margin-top: 8px;
        font-size: 11px;
        color: #82b9ff;
        font-family: 'JetBrains Mono', monospace;
        opacity: 0.85;
      }
      .nos-project:hover .nos-project-link {
        text-decoration: underline;
      }

      /* ── Terminal-App ── */
      .nos-term-body {
        background: #0d0e10;
        color: #b6f7b6;
        font-family: 'JetBrains Mono', monospace;
        font-size: 13px;
        padding: 14px 16px;
        height: 100%;
        overflow: auto;
        line-height: 1.45;
      }
      .nos-term-output { white-space: pre-wrap; }
      .nos-term-prompt { color: #7eff7e; }
      .nos-term-input {
        background: transparent; border: 0; outline: 0;
        color: inherit; font-family: inherit; font-size: inherit;
        width: 80%;
      }

      /* ── README + Trigger-File ── */
      .nos-textfile-body {
        white-space: pre-wrap;
        font-family: 'JetBrains Mono', monospace;
        font-size: 13px;
        line-height: 1.65;
        color: #e6e6e6;
      }

      .nos-success-banner {
        position: absolute;
        top: 50px; left: 50%; transform: translateX(-50%);
        background: rgba(40,200,80,0.95);
        color: #062a0e;
        padding: 10px 18px;
        border-radius: 8px;
        font-weight: 600;
        font-size: 13px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        z-index: 5000;
        animation: nosBannerIn 320ms ease;
      }
      @keyframes nosBannerIn {
        from { opacity: 0; transform: translate(-50%, -10px); }
        to   { opacity: 1; transform: translate(-50%, 0); }
      }

      /* ── Mobile (≤ 640px) ── */
      @media (max-width: 640px) {
        .nos-menubar { padding: 0 10px; height: 32px; font-size: 12px; }
        .nos-menubar-left { gap: 10px; }
        .nos-menubar-left .nos-menu-item { display: none; }
        .nos-menubar-left .nos-menu-app { display: inline; }
        .nos-menubar-right .nos-clock { display: none; }
        .nos-close-os { padding: 4px 10px; font-size: 12px; }

        .nos-desktop-area { padding: 20px 16px; }
        .nos-icons {
          grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
          gap: 12px;
        }
        .nos-icon { padding: 10px 4px; }
        .nos-icon-glyph { font-size: 36px; }
        .nos-icon-label { font-size: 11px; }

        .nos-dock {
          padding: 6px 10px;
          bottom: 10px;
          gap: 8px;
        }
        .nos-dock-icon { font-size: 28px; }

        /* Fenster werden fullscreen statt draggable */
        .nos-window {
          position: fixed !important;
          left: 0 !important;
          top: 32px !important;
          width: 100% !important;
          height: calc(100vh - 32px) !important;
          min-width: 0;
          min-height: 0;
          border-radius: 0;
          border: 0;
        }
        .nos-win-titlebar { cursor: default; }

        /* Projects + Browser füllen den Viewport */
        .nos-win-body { padding: 14px 14px; }
        .nos-browser-bar { padding: 6px 10px; gap: 6px; flex-wrap: wrap; }
        .nos-browser-url { font-size: 11px; padding: 4px 8px; }
        .nos-browser-content { padding: 16px 14px; }
        .nos-browser-tabs { width: 100%; order: 2; margin-top: 4px; }

        .nos-project { padding: 14px; }
        .nos-project-name { font-size: 15px; }
        .nos-project-body { font-size: 12px; }

        .nos-term-body { font-size: 12px; padding: 12px; }
        .nos-term-input { font-size: 16px; }   /* iOS zoom avoidance */
      }
    `;
    root.appendChild(style);

    // Boot screen
    const boot = document.createElement("div");
    boot.className = "nos-boot";
    boot.innerHTML = `
      <div class="nos-boot-logo"></div>
      <div class="nos-boot-text"></div>
    `;
    root.appendChild(boot);

    // Desktop (initially hidden)
    const desktop = document.createElement("div");
    desktop.className = "nos-desktop";

    // Menu bar
    const menubar = document.createElement("div");
    menubar.className = "nos-menubar";
    menubar.innerHTML = `
      <div class="nos-menubar-left">
        <span class="nos-menu-apple"></span>
        <span class="nos-menu-app">Finder</span>
        <span class="nos-menu-item">File</span>
        <span class="nos-menu-item">Edit</span>
        <span class="nos-menu-item">View</span>
        <span class="nos-menu-item">Help</span>
      </div>
      <div class="nos-menubar-right">
        <span class="nos-menu-item">numan</span>
        <span class="nos-menu-item nos-clock">${NOW_HHMM()}</span>
        <span class="nos-close-os" data-action="close-os">✕ Close</span>
      </div>
    `;
    desktop.appendChild(menubar);

    // Desktop area
    const area = document.createElement("div");
    area.className = "nos-desktop-area";

    const icons = document.createElement("div");
    icons.className = "nos-icons";
    for (const f of DESKTOP_FILES) {
      const ic = document.createElement("div");
      ic.className = "nos-icon";
      ic.dataset.fileId = f.id;
      ic.dataset.type = f.type;
      ic.innerHTML = `
        <div class="nos-icon-glyph">${f.icon}</div>
        <div class="nos-icon-label">${f.label}</div>
      `;
      icons.appendChild(ic);
    }
    area.appendChild(icons);

    // Dock
    const dock = document.createElement("div");
    dock.className = "nos-dock";
    dock.innerHTML = `
      <div class="nos-dock-icon" data-file-id="browser" title="Browser" aria-label="Browser">${NOS_ICONS.globe}</div>
      <div class="nos-dock-icon" data-file-id="terminal" title="Terminal" aria-label="Terminal">${NOS_ICONS.terminal}</div>
      <div class="nos-dock-icon" data-file-id="projects" title="Projects" aria-label="Projects">${NOS_ICONS.folder}</div>
      <div class="nos-dock-icon" data-file-id="readme" title="README" aria-label="README">${NOS_ICONS.fileText}</div>
    `;
    area.appendChild(dock);

    desktop.appendChild(area);
    root.appendChild(desktop);

    this.dom = { root, boot, desktop, menubar, area, icons, dock, style };

    // Wire-up events
    this._wireEvents();
  }

  _wireEvents() {
    const { root, icons, dock, menubar } = this.dom;

    // Close NumanOS
    menubar.querySelector("[data-action='close-os']")
      .addEventListener("click", () => this.close());

    // Single-click select / double-click open
    let lastClickTime = 0;
    let lastClickFile = null;
    const handleClick = (fileId) => {
      const now = Date.now();
      const isDouble = (fileId === lastClickFile) && (now - lastClickTime < 380);
      lastClickTime = now;
      lastClickFile = fileId;
      if (isDouble) {
        this._openFile(fileId);
      } else {
        // Select-state visualisieren
        icons.querySelectorAll(".nos-icon").forEach((el) => {
          el.classList.toggle("selected", el.dataset.fileId === fileId);
        });
      }
    };
    icons.addEventListener("click", (e) => {
      const icon = e.target.closest(".nos-icon");
      if (icon) handleClick(icon.dataset.fileId);
    });

    // Dock = single click to open
    dock.addEventListener("click", (e) => {
      const di = e.target.closest(".nos-dock-icon");
      if (di) this._openFile(di.dataset.fileId);
    });

    // Esc → close NumanOS
    this._onKey = (e) => {
      if (e.key === "Escape") {
        // Falls Fenster offen → letztes Fenster zu, sonst NumanOS zu
        if (this.windowStack.length > 0) {
          const top = this.windowStack[this.windowStack.length - 1];
          this._closeWindow(top);
        } else {
          this.close();
        }
      }
    };
    document.addEventListener("keydown", this._onKey);

    // Click auf Desktop-Area (außerhalb Icon) → Deselect
    this.dom.area.addEventListener("click", (e) => {
      if (!e.target.closest(".nos-icon") && !e.target.closest(".nos-window")
          && !e.target.closest(".nos-dock-icon")) {
        icons.querySelectorAll(".nos-icon").forEach((el) =>
          el.classList.remove("selected"));
      }
    });
  }

  // ── Boot-Sequenz ──────────────────────────────────────────────────
  _startBootSequence() {
    const text = this.dom.boot.querySelector(".nos-boot-text");
    const lines = [
      "[ OK ] Starting numan-os v1.0",
      "[ OK ] Mounting /home/numan",
      "[ OK ] Loading desktop environment...",
      "[ OK ] Welcome.",
    ];
    let i = 0;
    requestAnimationFrame(() => { this.dom.root.style.opacity = "1"; });
    const tick = () => {
      if (i >= lines.length) {
        // Boot fertig → Desktop einblenden
        setTimeout(() => this._showDesktop(), 320);
        return;
      }
      const line = document.createElement("div");
      line.className = "nos-boot-line";
      line.style.animationDelay = "0ms";
      line.textContent = lines[i];
      text.appendChild(line);
      i++;
      setTimeout(tick, 220);
    };
    setTimeout(tick, 280);
  }

  _showDesktop() {
    this.dom.boot.style.opacity = "0";
    this.dom.desktop.classList.add("shown");
    setTimeout(() => { this.dom.boot.style.display = "none"; }, 440);
  }

  // ── File-Open-Dispatcher ──────────────────────────────────────────
  _openFile(fileId) {
    const file = DESKTOP_FILES.find((f) => f.id === fileId);
    if (!file) return;
    if (file.type === "trigger_sqli") {
      this._openSqliFromTodo();
      return;
    }
    if (file.id === "browser")  return this._openWindow("browser", this._browserContent());
    if (file.id === "projects") return this._openWindow("projects", this._projectsContent());
    if (file.id === "terminal") return this._openWindow("terminal", this._terminalContent());
    if (file.id === "readme")   return this._openWindow("readme", this._readmeContent());
  }

  // ── Window-Management ─────────────────────────────────────────────
  _openWindow(id, contentNode) {
    // Wenn schon offen → in den Vordergrund + ggf. aus Minimized-Mode holen
    const existing = this.windowStack.find((w) => w.id === id);
    if (existing) {
      if (existing.minimized) {
        existing.el.classList.remove("nos-win-minimized");
        existing.minimized = false;
      }
      existing.el.style.zIndex = String(++this.zCounter);
      return;
    }
    const win = document.createElement("div");
    win.className = "nos-window";
    win.style.zIndex = String(++this.zCounter);

    // Offset & size — staggered
    const offsetX = 80 + (this.windowStack.length * 28);
    const offsetY = 60 + (this.windowStack.length * 24);
    const sizeW = id === "browser" ? 720 : id === "projects" ? 540 : id === "terminal" ? 620 : 480;
    const sizeH = id === "browser" ? 460 : id === "projects" ? 460 : id === "terminal" ? 360 : 340;
    win.style.cssText += `
      left: ${offsetX}px; top: ${offsetY}px;
      width: ${sizeW}px; height: ${sizeH}px;
    `;

    const title = {
      browser: "Browser — numan-yesil.com",
      projects: "Projects — Finder",
      terminal: "Terminal — numan@dev",
      readme: "README.txt",
      todo: "TODO_fix_sql_injection.txt",
    }[id] || id;

    win.innerHTML = `
      <div class="nos-win-titlebar">
        <div class="nos-traffic">
          <div class="nos-traffic-btn nos-traffic-close" data-action="close" title="Close">×</div>
          <div class="nos-traffic-btn nos-traffic-min" data-action="minimize" title="Minimize">−</div>
          <div class="nos-traffic-btn nos-traffic-max" data-action="maximize" title="Maximize">+</div>
        </div>
        <div class="nos-win-title">${title}</div>
        <div style="width:54px;"></div>
      </div>
    `;
    const body = document.createElement("div");
    body.className = "nos-win-body";
    body.style.padding = id === "terminal" || id === "browser" ? "0" : "";
    body.appendChild(contentNode);
    win.appendChild(body);

    // ── Resize-Handles (4 Ecken + 4 Kanten) ──
    for (const dir of ["n","s","e","w","ne","nw","se","sw"]) {
      const h = document.createElement("div");
      h.className = `nos-resize-handle nos-resize-${dir}`;
      win.appendChild(h);
      this._makeResizable(win, h, dir);
    }

    // Drag-functionality auf titlebar
    const titlebar = win.querySelector(".nos-win-titlebar");
    this._makeDraggable(win, titlebar);

    // Window-State (für Min/Max/Restore)
    const winRef = { el: win, id, prevState: null, minimized: false, maximized: false };

    // Close-Button
    titlebar.querySelector("[data-action='close']")
      .addEventListener("click", (e) => {
        e.stopPropagation();
        this._closeWindow(winRef);
      });
    // Minimize-Button (zum Dock)
    titlebar.querySelector("[data-action='minimize']")
      .addEventListener("click", (e) => {
        e.stopPropagation();
        this._minimizeWindow(winRef);
      });
    // Maximize/Restore-Button
    titlebar.querySelector("[data-action='maximize']")
      .addEventListener("click", (e) => {
        e.stopPropagation();
        this._toggleMaximize(winRef);
      });
    // Doppelklick auf Titlebar = Maximize
    titlebar.addEventListener("dblclick", (e) => {
      if (e.target.closest(".nos-traffic")) return;
      this._toggleMaximize(winRef);
    });

    // Bring to front beim Klick irgendwo aufs Window
    win.addEventListener("mousedown", () => {
      win.style.zIndex = String(++this.zCounter);
    });

    this.dom.area.appendChild(win);
    requestAnimationFrame(() => win.classList.add("shown"));
    this.windowStack.push(winRef);
  }

  _minimizeWindow(winRef) {
    if (winRef.minimized) {
      // Restore
      winRef.el.classList.remove("nos-win-minimized");
      winRef.minimized = false;
    } else {
      winRef.el.classList.add("nos-win-minimized");
      winRef.minimized = true;
    }
  }

  _toggleMaximize(winRef) {
    const el = winRef.el;
    if (winRef.maximized) {
      // Restore
      const p = winRef.prevState;
      if (p) {
        el.style.left = p.left;
        el.style.top = p.top;
        el.style.width = p.width;
        el.style.height = p.height;
      }
      winRef.maximized = false;
      winRef.prevState = null;
    } else {
      winRef.prevState = {
        left: el.style.left, top: el.style.top,
        width: el.style.width, height: el.style.height,
      };
      const area = this.dom.area;
      el.style.left = "0px";
      el.style.top = "0px";
      el.style.width = area.clientWidth + "px";
      el.style.height = area.clientHeight + "px";
      winRef.maximized = true;
    }
  }

  _makeResizable(win, handle, dir) {
    let startX = 0, startY = 0, startW = 0, startH = 0, startL = 0, startT = 0;
    let resizing = false;
    const onDown = (e) => {
      // Nicht resizen wenn Fenster maximized ist
      const rect = win.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY;
      startW = rect.width; startH = rect.height;
      startL = parseInt(win.style.left, 10) || 0;
      startT = parseInt(win.style.top, 10) || 0;
      resizing = true;
      e.preventDefault(); e.stopPropagation();
      win.style.zIndex = String(++this.zCounter);
    };
    const onMove = (e) => {
      if (!resizing) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      let newW = startW, newH = startH, newL = startL, newT = startT;
      if (dir.includes("e")) newW = Math.max(280, startW + dx);
      if (dir.includes("s")) newH = Math.max(180, startH + dy);
      if (dir.includes("w")) {
        newW = Math.max(280, startW - dx);
        newL = startL + (startW - newW);
      }
      if (dir.includes("n")) {
        newH = Math.max(180, startH - dy);
        newT = startT + (startH - newH);
      }
      win.style.left = newL + "px";
      win.style.top = newT + "px";
      win.style.width = newW + "px";
      win.style.height = newH + "px";
    };
    const onUp = () => { resizing = false; };
    handle.addEventListener("mousedown", onDown);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  _closeWindow(winRef) {
    const idx = this.windowStack.findIndex((w) => w.el === winRef.el);
    if (idx < 0) return;
    const { el } = this.windowStack[idx];
    el.classList.remove("shown");
    setTimeout(() => el.remove(), 200);
    this.windowStack.splice(idx, 1);
  }

  _makeDraggable(win, handle) {
    let offX = 0, offY = 0, dragging = false;
    handle.addEventListener("mousedown", (e) => {
      if (e.target.closest("[data-action='close']")) return;
      dragging = true;
      const rect = win.getBoundingClientRect();
      const parentRect = this.dom.area.getBoundingClientRect();
      offX = e.clientX - rect.left;
      offY = e.clientY - rect.top;
      handle.style.cursor = "grabbing";
    });
    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const parentRect = this.dom.area.getBoundingClientRect();
      const x = e.clientX - parentRect.left - offX;
      const y = e.clientY - parentRect.top - offY;
      win.style.left = `${Math.max(0, x)}px`;
      win.style.top = `${Math.max(0, y)}px`;
    });
    document.addEventListener("mouseup", () => {
      dragging = false;
      handle.style.cursor = "grab";
    });
  }

  // ── Content-Builders ──────────────────────────────────────────────
  _browserContent() {
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;height:100%;";
    wrap.innerHTML = `
      <div class="nos-browser-bar">
        <span style="opacity:0.6;">←</span>
        <span style="opacity:0.6;">→</span>
        <span style="opacity:0.6;">↻</span>
        <div class="nos-browser-tabs">
          <div class="nos-browser-tab active">numan-yesil.com</div>
          <div class="nos-browser-tab" style="opacity:0.6;">+</div>
        </div>
        <div class="nos-browser-url">https://numan-yesil.com/</div>
      </div>
      <div class="nos-browser-content">
        <h1 style="margin:0 0 6px;font-size:22px;">Numan Yesil</h1>
        <p style="margin:0 0 14px;opacity:0.7;font-size:13px;">
          Wirtschaftsinformatik @ HAW Kiel
        </p>
        <p style="font-size:13px;line-height:1.6;opacity:0.85;">
          You're literally looking at this site right now, from inside this site.
          That's the joke. Real one has bike physics, grass shaders, and a few
          hidden labs like this one.
        </p>
        <div style="margin-top:20px;padding:12px 14px;background:rgba(80,140,255,0.10);border:1px solid rgba(80,140,255,0.25);border-radius:8px;font-size:12px;line-height:1.5;">
          <strong style="color:#82b9ff;">Tip:</strong> there's a TODO file on the
          desktop. Open it.
        </div>
      </div>
    `;
    return wrap;
  }

  _projectsContent() {
    const wrap = document.createElement("div");
    wrap.className = "nos-projects";
    for (const p of PROJECTS) {
      const card = document.createElement("div");
      card.className = "nos-project";
      const externalHint = p.url
        ? `<div class="nos-project-link">↗ github.com/numan7272/${p.name}</div>`
        : "";
      card.innerHTML = `
        <div class="nos-project-name">${p.name}</div>
        <div class="nos-project-sub">${p.sub}</div>
        <div class="nos-project-body">${p.body}</div>
        ${externalHint}
      `;
      if (p.url) {
        card.addEventListener("click", () => {
          window.open(p.url, "_blank", "noopener,noreferrer");
        });
      }
      wrap.appendChild(card);
    }
    return wrap;
  }

  _terminalContent() {
    const wrap = document.createElement("div");
    wrap.className = "nos-term-body";
    wrap.innerHTML = `<div class="nos-term-output"></div>`;
    const output = wrap.querySelector(".nos-term-output");
    const inputLine = document.createElement("div");
    inputLine.innerHTML = `<span class="nos-term-prompt">numan@dev:~$</span> <input class="nos-term-input" autocomplete="off" spellcheck="false" autocapitalize="off" autocorrect="off">`;
    wrap.appendChild(inputLine);

    // ── Bash-History für ↑/↓ ──
    const history = [];
    let historyIndex = -1;
    // ── Tab-Completion-Vokabular (lokale Sandbox-Commands) ──
    const completionVocab = [
      "help", "whoami", "uname -a", "uname -r", "uname -m", "uname -n",
      "pwd", "ls", "cat README.txt", "cat TODO_fix_sql_injection.txt",
      "history", "date", "clear", "exit", "echo",
    ];

    for (const line of TERMINAL_BANNER) {
      const l = document.createElement("div");
      l.textContent = line;
      output.appendChild(l);
    }

    const input = inputLine.querySelector(".nos-term-input");
    setTimeout(() => input.focus(), 80);

    const printLine = (s) => {
      if (Array.isArray(s)) { for (const l of s) printLine(l); return; }
      const l = document.createElement("div");
      l.textContent = s;
      output.appendChild(l);
      wrap.scrollTop = wrap.scrollHeight;
    };

    input.addEventListener("keydown", (e) => {
      // ── Ctrl+C — abbrechen ──
      if (e.ctrlKey && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        printLine(`numan@dev:~$ ${input.value}^C`);
        input.value = "";
        return;
      }
      // ── Ctrl+L — clear ──
      if (e.ctrlKey && (e.key === "l" || e.key === "L")) {
        e.preventDefault();
        output.innerHTML = "";
        return;
      }
      // ── ↑/↓ History ──
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (history.length === 0) return;
        historyIndex = Math.max(0, historyIndex - 1);
        input.value = history[historyIndex] || "";
        // Cursor ans Ende
        setTimeout(() => { input.selectionStart = input.selectionEnd = input.value.length; }, 0);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (history.length === 0) return;
        historyIndex = Math.min(history.length, historyIndex + 1);
        input.value = history[historyIndex] || "";
        setTimeout(() => { input.selectionStart = input.selectionEnd = input.value.length; }, 0);
        return;
      }
      // ── Tab — Completion ──
      if (e.key === "Tab") {
        e.preventDefault();
        const prefix = input.value;
        if (!prefix) return;
        const matches = completionVocab.filter((s) => s.startsWith(prefix));
        if (matches.length === 1) {
          input.value = matches[0];
        } else if (matches.length > 1) {
          // mehrere → wie Bash: alle anzeigen
          printLine(`numan@dev:~$ ${prefix}`);
          printLine(matches.join("   "));
        }
        return;
      }
      if (e.key !== "Enter") return;
      const cmd = input.value.trim();
      printLine(`numan@dev:~$ ${cmd}`);
      input.value = "";
      if (cmd) {
        history.push(cmd);
        historyIndex = history.length;
      }
      if (!cmd) return;
      const parts = cmd.split(/\s+/);
      const main = (parts[0] || "").toLowerCase();
      const arg = parts.slice(1).join(" ");
      const flags = parts.slice(1).join(" ");
      if (cmd === "clear" || cmd === "cls") { output.innerHTML = ""; return; }
      if (main === "exit" || main === "quit") {
        printLine("logout");
        const win = this.windowStack.find((w) => w.id === "terminal");
        if (win) setTimeout(() => this._closeWindow(win), 380);
        return;
      }
      if (main === "uname") {
        // -a → alle Felder. Ohne flag → nur "Darwin".
        if (flags.includes("-a")) {
          printLine("Darwin numan-dev 23.5.0 Darwin Kernel Version 23.5.0: " +
                    "root:xnu-10063.121.3~5/RELEASE_ARM64_T8112 arm64");
        } else if (flags.includes("-r")) {
          printLine("23.5.0");
        } else if (flags.includes("-m")) {
          printLine("arm64");
        } else if (flags.includes("-n")) {
          printLine("numan-dev");
        } else if (flags.includes("-s") || !flags) {
          printLine("Darwin");
        } else {
          printLine("usage: uname [-amnprsv]");
        }
        return;
      }
      if (main === "cat") {
        if (arg === "README.txt" || arg === "readme.txt") {
          printLine(README_CONTENT.split("\n"));
          return;
        }
        if (arg.includes("TODO") || arg.includes("todo")) {
          printLine([
            "// TODO: Fix SQL injection in admin login form",
            "// Path: ~/Projects/restaurant-reservations/admin.php",
            "// Severity: HIGH — old code from 2018, still concatenates strings.",
            "// Action: rewrite to prepared statements.",
            "",
            "(double-click the file on the desktop if you want to see it for yourself)",
          ]);
          return;
        }
        printLine(`cat: ${arg}: No such file or directory`);
        return;
      }
      const fn = TERMINAL_COMMANDS[main];
      if (fn) {
        printLine(fn());
        return;
      }
      printLine(`-bash: ${main}: command not found`);
    });

    return wrap;
  }

  _readmeContent() {
    const wrap = document.createElement("div");
    wrap.className = "nos-textfile-body";
    wrap.textContent = README_CONTENT;
    return wrap;
  }

  // ── SQLi-Lab-Trigger ──────────────────────────────────────────────
  _openSqliFromTodo() {
    // Erst die TODO-File als kleines Text-Window zeigen (in dem Stil dass
    // der Recruiter den Hinweis liest), dann nach 2.5s das echte Lab.
    // Aber damit's nicht zu langsam wird: zeig die TODO-File mit nem
    // Button "Open the vulnerable form".
    const wrap = document.createElement("div");
    wrap.className = "nos-textfile-body";
    wrap.innerHTML = `
// TODO: SQL injection — security practice sandbox
// Path: ~/Projects/sqli-sandbox/login.php
// Source: PortSwigger SQLi-Track + meine eigenen Notizen.
// Goal: 4 Payload-Familien durchspielen — Tautology / Comment /
//       UNION-Exfil / Blind-Time-Based. Alles client-side, keine echten Queries.

// Steps to reproduce:
//   1. Open the login form below
//   2. Try any classic injection payload
//   3. Verify that authentication is bypassed

<br><br>
<button class="nos-open-vuln-btn" style="
  background: rgba(255,217,122,0.18);
  border: 1px solid rgba(255,217,122,0.4);
  color: #ffd97a;
  padding: 8px 16px;
  border-radius: 6px;
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  font-weight: 600;
">→ Open the sandbox login form</button>
    `;
    this._openWindow("todo", wrap);
    setTimeout(() => {
      const btn = this.dom.area.querySelector(".nos-open-vuln-btn");
      if (btn) {
        btn.addEventListener("click", () => this._launchSqliLab());
      }
    }, 50);
  }

  async _launchSqliLab() {
    // Lazy import damit der NumanOS-Bundle klein bleibt
    const { SqlInjectionLab } = await import("./SqlInjectionLab.js");
    this._sqliLab = new SqlInjectionLab(this.game);
    // Patch markComplete um unsere Erfolgs-Banner zu zeigen
    const origFire = this._sqliLab._fireSuccess.bind(this._sqliLab);
    this._sqliLab._fireSuccess = () => {
      origFire();
      this._showSuccessBanner();
    };
    this._sqliLab.open();
  }

  _showSuccessBanner() {
    if (this._success) return;
    this._success = true;
    const banner = document.createElement("div");
    banner.className = "nos-success-banner";
    banner.textContent = "SQLi Lab solved — authentication bypassed";
    this.dom.area.appendChild(banner);
    setTimeout(() => banner.remove(), 3500);
    // Counter erhöhen
    this.game.ui?.miniGames?.markComplete?.("hq");
  }

  close() {
    if (!this.dom) return;
    document.removeEventListener("keydown", this._onKey);
    this._sqliLab?.close?.();
    this.dom.root.style.opacity = "0";
    const toRemove = this.dom.root;
    this.dom = null;
    setTimeout(() => toRemove.remove(), 220);
  }
}
