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

const DESKTOP_FILES = [
  {
    id: "browser",
    label: "Browser",
    icon: "🌐",
    type: "app",
  },
  {
    id: "projects",
    label: "Projects",
    icon: "📁",
    type: "folder",
  },
  {
    id: "terminal",
    label: "Terminal",
    icon: "⌨️",
    type: "app",
  },
  {
    id: "readme",
    label: "README.txt",
    icon: "📄",
    type: "textfile",
  },
  {
    id: "todo_sqli",
    label: "TODO_fix_sql_injection.txt",
    icon: "📝",
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

I'm Numan, Wirtschaftsinformatik student at HAW Kiel, Cybersecurity focus.
Practice > theory. Always.

— n
`;

// Public-Repos auf github.com/numan7272. Privat-Repos (GlyphFall, omni-view,
// AI-Apps) absichtlich nicht gelistet. Click auf eine Card → öffnet GitHub
// in neuem Tab. Die isVuln-Card ist der versteckte SQLi-Trigger.
const PROJECTS = [
  {
    name: "funke",
    sub: "JavaScript · MIT · Self-hosted Discord alternative",
    body: "Real-time Messaging, WebRTC Voice-Chat und Screen-Sharing. Self-hosted weil Discord/Slack overkill waren und ich Kontrolle über den Signaling-Server wollte.",
    url: "https://github.com/numan7272/funke",
  },
  {
    name: "synapser-backend",
    sub: "Python · FastAPI + Google OR-Tools",
    body: "Core-Backend für Synapser — AI-driven Scheduling. Löst Constraint-Satisfaction-Probleme in Echtzeit, plus Geo/Auth/Stripe-Integrationen.",
    url: "https://github.com/numan7272/synapser-backend",
  },
  {
    name: "OmniView",
    sub: "TypeScript · Multi-Source Viewer",
    body: "Unified Dashboard für mehrere Live-Datenquellen — Kameras, Logs, Sensor-Feeds in einer UI.",
    url: "https://github.com/numan7272/OmniView",
  },
  {
    name: "Python-Projekt",
    sub: "Python · Lern-Repo",
    body: "Sammelsurium aus Python-Übungen während ich die Sprache aufgebaut habe. Algorithmen, kleine Tools, Snippets.",
    url: "https://github.com/numan7272/Python-Projekt",
  },
  {
    name: "About-Me",
    sub: "JavaScript · Mein altes Portfolio (legacy)",
    body: "Vorgänger dieser Seite. Next.js + Three.js. Die Bike-Steuerung hier ist 1:1 von dort portiert. Wird abgeschaltet sobald die neue Version live ist.",
    url: "https://github.com/numan7272/About-Me",
  },
  {
    name: "restaurant-reservations",
    sub: "PHP + MySQL · Family business app (legacy, 2018)",
    body: "Mein erstes Real-World-Codebase, geschrieben mit 16 für den Familien-Betrieb. PHP, String-Concatenated SQL Queries. Heute wüsste ich es besser. Der /admin-Login lebt noch — try it.",
    isVuln: true,
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
    "  1  ssh prod@reservation.local",
    "  2  mysql -u admin -p",
    "  3  curl -X POST http://localhost:8080/admin/login -d 'user=admin&pass=admin'",
    "  4  vim Projects/restaurant-reservations/admin.php",
    "  5  git commit -m 'WIP: still need to fix SQL injection in admin login'",
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
      <div class="nos-dock-icon" data-file-id="browser" title="Browser">🌐</div>
      <div class="nos-dock-icon" data-file-id="terminal" title="Terminal">⌨️</div>
      <div class="nos-dock-icon" data-file-id="projects" title="Projects">📁</div>
      <div class="nos-dock-icon" data-file-id="readme" title="README">📄</div>
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
    // Wenn schon offen → in den Vordergrund holen + return
    const existing = this.windowStack.find((w) => w.id === id);
    if (existing) {
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
      browser: "Browser — numan.dev",
      projects: "Projects — Finder",
      terminal: "Terminal — numan@dev",
      readme: "README.txt",
      todo: "TODO_fix_sql_injection.txt",
    }[id] || id;

    win.innerHTML = `
      <div class="nos-win-titlebar">
        <div class="nos-traffic">
          <div class="nos-traffic-btn nos-traffic-close" data-action="close"></div>
          <div class="nos-traffic-btn nos-traffic-min"></div>
          <div class="nos-traffic-btn nos-traffic-max"></div>
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

    // Drag-functionality auf titlebar
    const titlebar = win.querySelector(".nos-win-titlebar");
    this._makeDraggable(win, titlebar);

    // Close-Button
    titlebar.querySelector("[data-action='close']")
      .addEventListener("click", () => this._closeWindow({ el: win, id }));

    // Bring to front beim Klick irgendwo aufs Window
    win.addEventListener("mousedown", () => {
      win.style.zIndex = String(++this.zCounter);
    });

    this.dom.area.appendChild(win);
    requestAnimationFrame(() => win.classList.add("shown"));
    this.windowStack.push({ el: win, id });
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
          <div class="nos-browser-tab active">numan.dev</div>
          <div class="nos-browser-tab" style="opacity:0.6;">+</div>
        </div>
        <div class="nos-browser-url">https://numan.dev</div>
      </div>
      <div class="nos-browser-content">
        <h1 style="margin:0 0 6px;font-size:22px;">Numan Yesil</h1>
        <p style="margin:0 0 14px;opacity:0.7;font-size:13px;">
          Wirtschaftsinformatik @ HAW Kiel · Cybersecurity Focus
        </p>
        <p style="font-size:13px;line-height:1.6;opacity:0.85;">
          You're literally looking at this site right now, from inside this site.
          That's the joke. Real one has bike physics, grass shaders, and a few
          hidden labs like this one.
        </p>
        <p style="font-size:13px;line-height:1.6;opacity:0.85;margin-top:10px;">
          The other browser tab would have a customer-login form from the
          family-restaurant app. It's still vulnerable — opening Projects/ →
          restaurant-reservations and trying /admin will show you why.
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
      card.className = "nos-project" + (p.isVuln ? " vuln-hint" : "");
      // GitHub-Icon-Hint nur wenn URL vorhanden + nicht vuln
      const externalHint = (p.url && !p.isVuln)
        ? `<div class="nos-project-link">↗ github.com/numan7272/${p.name}</div>`
        : "";
      card.innerHTML = `
        <div class="nos-project-name">${p.name}</div>
        <div class="nos-project-sub">${p.sub}</div>
        <div class="nos-project-body">${p.body}</div>
        ${externalHint}
      `;
      if (p.isVuln) {
        card.addEventListener("click", () => this._openSqliFromProjects());
      } else if (p.url) {
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
    inputLine.innerHTML = `<span class="nos-term-prompt">numan@dev ~ $</span> <input class="nos-term-input" autocomplete="off" spellcheck="false" autocapitalize="off">`;
    wrap.appendChild(inputLine);

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
      if (e.key !== "Enter") return;
      const cmd = input.value.trim();
      printLine(`numan@dev ~ $ ${cmd}`);
      input.value = "";
      if (!cmd) return;
      const parts = cmd.split(/\s+/);
      const main = parts[0];
      const arg = parts.slice(1).join(" ");
      if (cmd === "clear" || cmd === "cls") { output.innerHTML = ""; return; }
      if (cmd === "exit" || cmd === "quit") {
        printLine("logout");
        const win = this.windowStack.find((w) => w.id === "terminal");
        if (win) setTimeout(() => this._closeWindow(win), 380);
        return;
      }
      if (main === "uname") {
        printLine("Darwin numan-dev 22.6.0 arm64");
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
// TODO: Fix SQL injection in admin login form
// Path: ~/Projects/restaurant-reservations/admin.php
// Severity: HIGH — old code from 2018, still concatenates strings.
// Action: rewrite to prepared statements.

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
">→ Open the vulnerable form</button>
    `;
    this._openWindow("todo", wrap);
    setTimeout(() => {
      const btn = this.dom.area.querySelector(".nos-open-vuln-btn");
      if (btn) {
        btn.addEventListener("click", () => this._launchSqliLab());
      }
    }, 50);
  }

  _openSqliFromProjects() {
    // Click auf Projects/restaurant-reservations → direkt zum Lab
    this._launchSqliLab();
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
    banner.textContent = "🎉 Egg gehackt — SQL Injection Bypass";
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
