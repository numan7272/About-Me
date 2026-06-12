/**
 * DesignaOS — Windows-11-Style Desktop für das Designa-Building.
 *
 * Apps:
 *   - Browser → fake Jira-Klone "TestLab Tracker" mit Bug-Tickets
 *   - Teams → fake Chat-Channels (#qa-testlab, #general)
 *   - Logs → Datei-Explorer mit Sample-Log-Files
 *   - Notepad → Bug-Report-Template
 *
 * Story: simuliert mein Werkstudent-Setup bei Designa.
 */

import { FakeOS } from "./FakeOS.js";

const TICKETS = [
  {
    id: "TL-2041",
    title: "Hand-Pay-Terminal: Touchscreen-Eingabe verzögert (~ 1.2s)",
    status: "in-progress",
    priority: "high",
    assignee: "numan.y",
    desc: "Unter Last (>50 Transaktionen/min) reagiert das Touchscreen verzögert. Reproduziert auf Firmware v3.2.1.\n\nSteps:\n1. Mit Lasttool 50 simultane Bestellungen senden\n2. Touchscreen-Eingabe testen\n3. Latenz messen",
  },
  {
    id: "TL-2039",
    title: "Belegdruck: Sonderzeichen (ü, ß) werden als ? gedruckt",
    status: "open",
    priority: "medium",
    assignee: "numan.y",
    desc: "Auf Belegen erscheinen Umlaute als ?. Vermutlich Encoding-Problem zwischen Backend und Druckertreiber (CP-850 vs UTF-8).",
  },
  {
    id: "TL-2034",
    title: "Backend-API: Timeout nach 30s bei Reporting-Endpoint",
    status: "open",
    priority: "high",
    assignee: "team",
    desc: "/api/reports/daily timeout-t nach 30s wenn der Zeitraum > 90 Tage. DB-Query müsste optimiert werden.",
  },
  {
    id: "TL-2030",
    title: "RFID-Reader liest Karten nicht beim ersten Versuch",
    status: "in-review",
    priority: "low",
    assignee: "j.schmidt",
    desc: "Intermittierender Bug. Bei ca. 5% der Lesevorgänge muss die Karte zweimal vorgehalten werden. Hardware oder Firmware?",
  },
  {
    id: "TL-2022",
    title: "Self-Checkout-Kiosk: Reset hängt nach Update",
    status: "closed",
    priority: "high",
    assignee: "numan.y",
    desc: "Nach Firmware-Update v3.2 startete der Kiosk nicht mehr automatisch nach Reset. Fix: BIOS-Boot-Flag manuell setzen, dann automatisierter Boot-Loop einbauen.",
    resolution: "Fixed in firmware v3.2.2 (deployed 2026-04-08).",
  },
];

const TEAMS_CHANNELS = [
  {
    name: "#qa-testlab",
    messages: [
      { author: "Jan Möller", time: "09:14", text: "@numan kannst du heute TL-2041 reproduzieren? Auf meinem Setup geht der Bug nicht." },
      { author: "Numan Yesil", time: "09:17", text: "Klar, hab grad den Lasttest am laufen. Latenz bei 50/min reproduzierbar bei ~1.2s." },
      { author: "Jan Möller", time: "09:18", text: "Top. Schreib bitte einen Bericht mit Reproduktions-Schritten." },
      { author: "Numan Yesil", time: "09:20", text: "🫡" },
      { author: "Lisa Hartmann", time: "10:42", text: "Erinnerung: Daily um 11:30 in C8 1.04." },
    ],
  },
  {
    name: "#general",
    messages: [
      { author: "Designa HR", time: "08:00", text: "Guten Morgen Team. Reminder: das Sommerfest ist am 15.07., Anmeldung bis Freitag." },
      { author: "Tobias K.", time: "09:35", text: "Kaffee ist alle 😅" },
      { author: "Lisa Hartmann", time: "09:36", text: "Auf dem Weg." },
    ],
  },
  {
    name: "#firmware-team",
    messages: [
      { author: "Markus B.", time: "08:30", text: "v3.2.3 ist getaggt — testet bitte die RFID-Änderung." },
      { author: "Numan Yesil", time: "08:48", text: "On it. TL-2030 sollte damit closen." },
    ],
  },
];

const LOG_FILES = [
  {
    name: "checkout-2026-05-13.log",
    content: `[2026-05-13 08:01:22] INFO  Service starting up — version 4.1.7
[2026-05-13 08:01:23] INFO  Loaded config from /etc/designa/checkout.conf
[2026-05-13 08:01:23] INFO  Connecting to backend at api.designa.local:8443
[2026-05-13 08:01:24] INFO  Backend connection OK (latency 12ms)
[2026-05-13 08:14:05] WARN  Touchscreen calibration drift detected (delta 2.1mm)
[2026-05-13 08:14:05] INFO  Auto-recalibration triggered
[2026-05-13 08:14:07] INFO  Recalibration complete
[2026-05-13 09:32:11] ERROR Transaction timeout on /pay/process (request_id=4a7f12)
[2026-05-13 09:32:11] ERROR   reason: backend response > 30s
[2026-05-13 09:32:11] INFO   retry scheduled in 2s
[2026-05-13 09:32:13] INFO  Transaction 4a7f12 succeeded on retry
[2026-05-13 10:02:44] WARN  RFID read attempt 1 failed (card_uid=8a2f...)
[2026-05-13 10:02:44] INFO  Auto-retry triggered
[2026-05-13 10:02:45] INFO  RFID read OK on attempt 2`,
  },
  {
    name: "firmware-3.2.2.log",
    content: `[firmware] Boot loader v2.1
[firmware] CPU: ARM Cortex-A53 @ 1.4 GHz
[firmware] RAM: 512 MB
[firmware] Loading kernel image... done (4.2 MB)
[firmware] Mounting root fs at /dev/mmcblk0p2... done
[firmware] Starting services:
[firmware]   - network          [ OK ]
[firmware]   - rfid-daemon      [ OK ]
[firmware]   - touch-handler    [ OK ]
[firmware]   - payment-gateway  [ OK ]
[firmware]   - watchdog         [ OK ]
[firmware] System ready in 11.2s`,
  },
  {
    name: "test-report-TL-2041.txt",
    content: `Test Report — TL-2041
Tester: Numan Yesil
Date:   2026-05-13
Build:  checkout v4.1.7 / firmware v3.2.2

Steps to reproduce:
1. Start the load-test tool: ./loadtest --rate 50 --duration 60s
2. While loadtest is running, tap the touchscreen at random positions
3. Measure latency between tap and visual feedback

Findings:
- Baseline latency (idle): 80ms
- Under load (50 tx/min): 1200ms ± 200ms
- After loadtest stops: latency returns to baseline within 10s

Conclusion:
Touchscreen handler thread is starved under high backend traffic.
Suggest: separate the touch input handler from the transaction queue.

Next: assign to firmware team for thread-prioritization review.`,
  },
];

const BUG_TEMPLATE = `# Bug Report — TL-XXXX

**Title:** [Short summary]

**Severity:** Low / Medium / High / Critical
**Component:** Frontend / Backend / Firmware / Hardware
**Build:** vX.Y.Z

## Steps to reproduce
1.
2.
3.

## Expected
What should happen?

## Actual
What actually happens?

## Logs / Screenshots
Attach relevant files.

## Notes
Any context that might help debugging.

---
Author: Numan Yesil
Date:   ${new Date().toISOString().split('T')[0]}`;

export class DesignaOS extends FakeOS {
  constructor(game) {
    super(game, {
      osName: "Designa Windows 11",
      osClass: "dos",
      bootLines: [
        "[BIOS] Designa-Workstation booting...",
        "[BIOS] Loading kernel image",
        "[OK]   Windows 11 Pro · Build 22631",
        "[OK]   Welcome, numan.yesil",
      ],
      bootBg: "#0078d4",
      bootColor: "#fff",
    });
  }

  _customStyles() {
    return `
      /* ── Windows-11 Theme ────────────────────────────── */
      .dos { font-family: 'Segoe UI', system-ui, sans-serif; }
      .dos .fos-area {
        padding-bottom: 60px;     /* Platz für die Taskbar */
      }

      /* Wallpaper bei Win11 = Cyan/Blau-Gradient (offizieller Bloom) */
      .dos .fos-desktop {
        background:
          radial-gradient(1200px 800px at 60% 30%, rgba(120, 190, 255, 0.35), transparent 70%),
          radial-gradient(900px 600px at 30% 80%, rgba(180, 130, 230, 0.30), transparent 70%),
          linear-gradient(135deg, #0a1f3d 0%, #003a8c 50%, #4b1c8a 100%);
      }

      /* Win11-Taskbar: volle Breite, Icons zentriert, Acrylic */
      .dos .fos-dock {
        left: 0; right: 0; bottom: 0;
        transform: none;
        justify-content: center;
        align-items: center;
        height: 48px;
        background: rgba(24, 28, 38, 0.78);
        backdrop-filter: blur(28px) saturate(180%);
        -webkit-backdrop-filter: blur(28px) saturate(180%);
        border: 0;
        border-top: 1px solid rgba(255,255,255,0.08);
        border-radius: 0;
        padding: 0 12px;
        gap: 6px;
      }
      .dos .fos-dock-icon {
        font-size: 22px;
        padding: 6px 9px;
        border-radius: 6px;
        transition: background 120ms ease;
      }
      .dos .fos-dock-icon:hover {
        background: rgba(255,255,255,0.10);
        transform: none;
      }

      /* Win11-Fenster: Mica-Fläche, dezente Rundung, Controls rechts */
      .dos .fos-window {
        border-radius: 8px;
        background: rgba(28, 32, 44, 0.96);
        border: 1px solid rgba(255,255,255,0.09);
      }
      .dos .fos-win-titlebar {
        height: 36px;
        background: linear-gradient(180deg, rgba(36,40,52,0.95), rgba(28,32,44,0.95));
      }
      .dos .fos-win-controls { gap: 0; }
      .dos .fos-win-controls button {
        width: 44px; height: 34px;
        border-radius: 0;
        opacity: 0.8;
        font-size: 13px;
        transition: background 100ms ease;
      }
      .dos .fos-win-controls button:hover {
        background: rgba(255,255,255,0.09);
        opacity: 1;
      }
      .dos .fos-win-controls button[data-action="close"]:hover {
        background: #c42b1c;
        color: #fff;
      }

      /* Start-Button — sitzt auf der Taskbar links der zentrierten Icons */
      .dos-startbtn {
        position: absolute;
        bottom: 7px;
        left: calc(50% - 140px);
        width: 38px; height: 34px;
        background: transparent;
        border: 0;
        border-radius: 6px;
        display: flex; align-items: center; justify-content: center;
        font-size: 19px;
        color: #5aa9ff;
        cursor: pointer;
        z-index: 900;
        transition: background 120ms ease;
      }
      .dos-startbtn:hover { background: rgba(255,255,255,0.10); }

      /* System-Tray rechts: Glyphs + Uhr */
      .dos-tray {
        position: absolute;
        right: 10px; bottom: 0;
        height: 48px;
        display: flex; align-items: center; gap: 10px;
        padding: 0 6px;
        font-size: 11px;
        line-height: 1.3;
        text-align: right;
        z-index: 900;
        border-radius: 6px;
      }
      .dos-tray:hover { background: rgba(255,255,255,0.06); }
      .dos-tray-glyphs { display: flex; gap: 6px; opacity: 0.85; }
      .dos-tray-glyphs svg { width: 15px; height: 15px; }
      .dos-tray-clock { opacity: 0.9; }

      /* Start-Menü — Acrylic-Panel über der Taskbar */
      .dos-startmenu {
        position: absolute;
        bottom: 58px;
        left: 50%;
        transform: translateX(-50%);
        width: min(460px, calc(100vw - 24px));
        background: rgba(28, 32, 44, 0.92);
        backdrop-filter: blur(32px) saturate(180%);
        -webkit-backdrop-filter: blur(32px) saturate(180%);
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 12px;
        box-shadow: 0 18px 60px rgba(0,0,0,0.5);
        padding: 18px;
        z-index: 950;
      }
      .dos-start-search {
        width: 100%;
        padding: 9px 14px;
        background: rgba(255,255,255,0.07);
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 999px;
        color: inherit;
        font: inherit;
        font-size: 12px;
        margin-bottom: 16px;
      }
      .dos-start-label {
        font-size: 12px; font-weight: 600;
        opacity: 0.8; margin-bottom: 10px;
      }
      .dos-start-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 6px;
        margin-bottom: 14px;
      }
      .dos-start-tile {
        display: flex; flex-direction: column; align-items: center;
        gap: 7px;
        padding: 12px 6px 10px;
        background: transparent;
        border: 0; border-radius: 6px;
        color: inherit;
        font-size: 11px;
        line-height: 1.25;
        text-align: center;
        cursor: pointer;
        transition: background 120ms ease;
      }
      .dos-start-tile:hover { background: rgba(255,255,255,0.08); }
      .dos-start-tile-icon svg { width: 30px; height: 30px; }
      .dos-start-footer {
        display: flex; justify-content: space-between; align-items: center;
        padding-top: 12px;
        border-top: 1px solid rgba(255,255,255,0.08);
        font-size: 12px; opacity: 0.85;
      }
      .dos-start-power { cursor: default; opacity: 0.7; }

      @media (max-width: 640px) {
        /* Close-OS-Button (oben rechts) nicht mit der Icon-Reihe kollidieren */
        .dos .fos-area { padding-top: 48px; }
        .dos-startbtn { left: 10px; }
        .dos-tray .dos-tray-glyphs { display: none; }
        .dos-startmenu { bottom: 56px; }
        .dos-start-grid { grid-template-columns: repeat(3, 1fr); }
      }

      /* ── App-Styles ── */
      .dos-jira { display: flex; flex-direction: column; height: 100%; }
      .dos-jira-bar {
        display: flex; align-items: center; gap: 12px;
        padding: 10px 14px;
        background: rgba(20, 24, 32, 0.85);
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .dos-jira-bar h3 { margin: 0; font-size: 14px; font-weight: 600; }
      .dos-jira-bar .badge {
        margin-left: auto;
        padding: 3px 9px;
        background: rgba(0, 120, 212, 0.20);
        border: 1px solid rgba(0, 120, 212, 0.50);
        border-radius: 999px;
        font-size: 11px;
      }
      .dos-jira-list { flex: 1; overflow: auto; padding: 8px 14px; }
      .dos-ticket {
        padding: 12px 14px;
        margin-bottom: 8px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
        border-left-width: 3px;
        border-radius: 6px;
        cursor: pointer;
        transition: background 120ms;
      }
      .dos-ticket:hover { background: rgba(0, 120, 212, 0.10); }
      .dos-ticket.high   { border-left-color: #ff5252; }
      .dos-ticket.medium { border-left-color: #ffd54f; }
      .dos-ticket.low    { border-left-color: #66bb6a; }
      .dos-ticket-id { font-family: 'JetBrains Mono', monospace; font-size: 11px; opacity: 0.7; }
      .dos-ticket-title { font-size: 13px; font-weight: 500; margin: 4px 0; }
      .dos-ticket-meta { font-size: 11px; opacity: 0.65; display: flex; gap: 12px; }
      .dos-ticket-meta .status {
        padding: 1px 8px; border-radius: 4px;
        background: rgba(255,255,255,0.08);
        text-transform: uppercase;
        font-size: 10px;
        letter-spacing: 0.06em;
      }
      .dos-ticket-meta .status.open        { background: rgba(255, 82, 82, 0.18); color: #ff8a8a; }
      .dos-ticket-meta .status.in-progress { background: rgba(255, 200, 50, 0.18); color: #ffd97a; }
      .dos-ticket-meta .status.in-review   { background: rgba(126, 200, 255, 0.18); color: #82b9ff; }
      .dos-ticket-meta .status.closed      { background: rgba(100, 200, 100, 0.15); color: #82d982; }

      .dos-ticket-detail {
        padding: 14px;
        background: rgba(20, 24, 32, 0.92);
        border-radius: 8px;
        margin-top: 12px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 12px;
        white-space: pre-wrap;
        line-height: 1.55;
      }

      /* Teams-App */
      .dos-teams { display: flex; height: 100%; }
      .dos-teams-sidebar {
        width: 180px;
        background: rgba(20, 24, 32, 0.85);
        border-right: 1px solid rgba(255,255,255,0.06);
        padding: 12px 8px;
        flex-shrink: 0;
      }
      .dos-teams-channel {
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        margin-bottom: 2px;
      }
      .dos-teams-channel:hover { background: rgba(255,255,255,0.05); }
      .dos-teams-channel.active { background: rgba(0, 120, 212, 0.20); color: #82b9ff; }
      .dos-teams-main { flex: 1; display: flex; flex-direction: column; }
      .dos-teams-header {
        padding: 12px 18px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        font-size: 14px;
        font-weight: 600;
      }
      .dos-teams-messages {
        flex: 1; overflow: auto;
        padding: 14px 18px;
      }
      .dos-teams-msg {
        margin-bottom: 14px;
      }
      .dos-teams-msg-head {
        display: flex; gap: 10px; align-items: baseline;
        margin-bottom: 3px;
      }
      .dos-teams-msg-author { font-weight: 600; font-size: 13px; color: #82b9ff; }
      .dos-teams-msg-time { font-size: 11px; opacity: 0.5; }
      .dos-teams-msg-text { font-size: 13px; line-height: 1.5; opacity: 0.92; }

      /* Notepad */
      .dos-notepad {
        background: #1e1e1e;
        color: #d4d4d4;
        font-family: 'Consolas', 'JetBrains Mono', monospace;
        font-size: 13px;
        white-space: pre-wrap;
        line-height: 1.6;
        padding: 16px;
        height: 100%;
        overflow: auto;
      }
    `;
  }

  _wallpaperStyle() {
    // Wallpaper kommt aus _customStyles. Hier nur ein safe default.
    return ``;
  }

  _renderChrome() {
    // Win11-Chrome: Start-Button + System-Tray sitzen auf der Taskbar
    // (die Taskbar selbst ist die umgestylte .fos-dock), dazu das
    // Start-Menü-Panel (initial versteckt).
    const now = new Date();
    const hhmm = now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    const ddmm = now.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
    return `
      <button class="dos-startbtn" title="Start">⊞</button>
      <div class="dos-tray">
        <span class="dos-tray-glyphs" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M8.5 16.05a6 6 0 0 1 7 0"/><circle cx="12" cy="19.5" r="0.8" fill="currentColor"/></svg>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>
        </span>
        <span class="dos-tray-clock">${hhmm}<br>${ddmm}</span>
      </div>
      <div class="dos-startmenu" hidden>
        <input class="dos-start-search" type="text" placeholder="Suchen" disabled>
        <div class="dos-start-label">Angeheftet</div>
        <div class="dos-start-grid"></div>
        <div class="dos-start-footer">
          <span class="dos-start-user">numan.yesil · Werkstudent QA</span>
          <span class="dos-start-power" title="Nur Deko">⏻</span>
        </div>
      </div>
    `;
  }

  open() {
    // Guard der Basisklasse spiegeln — super.open() returnt bei bereits
    // offenem OS early, der Code hier darf dann ebenfalls nicht nochmal
    // Listener/Kacheln/Timer anlegen.
    if (this.dom) return;
    super.open();
    if (!this.dom) return;
    const desktop = this.dom.desktop;

    // Start-Menü mit den Apps füllen + Toggle verkabeln
    const startBtn = desktop.querySelector(".dos-startbtn");
    const menu = desktop.querySelector(".dos-startmenu");
    const grid = desktop.querySelector(".dos-start-grid");
    if (grid && menu && startBtn) {
      for (const app of this.apps) {
        const tile = document.createElement("button");
        tile.className = "dos-start-tile";
        tile.innerHTML = `<span class="dos-start-tile-icon">${app.icon}</span><span>${app.label}</span>`;
        tile.addEventListener("click", () => {
          menu.hidden = true;
          this.openApp(app.id);
        });
        grid.appendChild(tile);
      }
      startBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        menu.hidden = !menu.hidden;
      });
      desktop.addEventListener("click", (e) => {
        if (!e.target.closest(".dos-startmenu") && !e.target.closest(".dos-startbtn")) {
          menu.hidden = true;
        }
      });
    }

    // Tray-Uhr tickt jede halbe Minute
    const clock = desktop.querySelector(".dos-tray-clock");
    if (clock) {
      this._trayTimer = setInterval(() => {
        const t = new Date();
        clock.innerHTML =
          t.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
          + "<br>"
          + t.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
      }, 30000);
    }
  }

  close() {
    clearInterval(this._trayTimer);
    super.close();
  }

  _renderWindowChrome(title) {
    // Windows-Stil: Controls rechts mit Min/Max/Close
    return `
      <div class="fos-win-titlebar">
        <div class="fos-win-title">${this._escape(title)}</div>
        <div class="fos-win-controls">
          <button data-action="minimize" title="Minimize">−</button>
          <button data-action="maximize" title="Maximize">□</button>
          <button data-action="close" title="Close">×</button>
        </div>
      </div>
    `;
  }

  _registerApps() {
    // Inline-SVGs statt Emojis. Plattform-konsistent + monochrom + theme-able.
    const sv = (paths) =>
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
    const ICON = {
      jira:    sv(`<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>`),
      teams:   sv(`<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>`),
      logs:    sv(`<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="6" y1="13" x2="18" y2="13"/><line x1="6" y1="17" x2="14" y2="17"/>`),
      notepad: sv(`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M10.4 16.6L17 10l-3-3-6.6 6.6V17h2.4z"/>`),
    };
    this.apps = [
      {
        id: "jira",
        label: "TestLab Tracker",
        icon: ICON.jira,
        inDock: true,
        windowSize: { width: 720, height: 480 },
        onOpen: () => this._buildJira(),
      },
      {
        id: "teams",
        label: "Teams",
        icon: ICON.teams,
        inDock: true,
        windowSize: { width: 760, height: 500 },
        onOpen: () => this._buildTeams(),
      },
      {
        id: "logs",
        label: "Logs",
        icon: ICON.logs,
        inDock: true,
        windowSize: { width: 720, height: 480 },
        onOpen: () => this._buildLogs(),
      },
      {
        id: "notepad",
        label: "Bug Template",
        icon: ICON.notepad,
        inDock: true,
        windowSize: { width: 580, height: 500 },
        onOpen: () => this._buildNotepad(),
      },
    ];
  }

  // ─── App-Content-Builders ──────────────────────────────────────────

  _buildJira() {
    const wrap = document.createElement("div");
    wrap.className = "dos-jira";
    wrap.innerHTML = `
      <div class="dos-jira-bar">
        <h3>TestLab Tracker</h3>
        <span class="badge">QA · Designa</span>
      </div>
      <div class="dos-jira-list"></div>
    `;
    const list = wrap.querySelector(".dos-jira-list");
    for (const t of TICKETS) {
      const card = document.createElement("div");
      card.className = `dos-ticket ${t.priority}`;
      card.innerHTML = `
        <div class="dos-ticket-id">${t.id}</div>
        <div class="dos-ticket-title">${this._escape(t.title)}</div>
        <div class="dos-ticket-meta">
          <span class="status ${t.status}">${t.status}</span>
          <span class="dos-ticket-assignee" aria-label="Assignee"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${t.assignee}</span>
          <span>${t.priority}</span>
        </div>
      `;
      card.addEventListener("click", () => {
        // Detail-Toggle
        let detail = card.querySelector(".dos-ticket-detail");
        if (detail) { detail.remove(); return; }
        detail = document.createElement("div");
        detail.className = "dos-ticket-detail";
        detail.textContent = t.desc + (t.resolution ? `\n\n[Resolution] ${t.resolution}` : "");
        card.appendChild(detail);
      });
      list.appendChild(card);
    }
    return wrap;
  }

  _buildTeams() {
    const wrap = document.createElement("div");
    wrap.className = "dos-teams";
    wrap.innerHTML = `
      <div class="dos-teams-sidebar"></div>
      <div class="dos-teams-main">
        <div class="dos-teams-header"></div>
        <div class="dos-teams-messages"></div>
      </div>
    `;
    const sidebar = wrap.querySelector(".dos-teams-sidebar");
    const header = wrap.querySelector(".dos-teams-header");
    const messages = wrap.querySelector(".dos-teams-messages");

    const renderChannel = (ch) => {
      header.textContent = ch.name;
      messages.innerHTML = "";
      for (const m of ch.messages) {
        const el = document.createElement("div");
        el.className = "dos-teams-msg";
        el.innerHTML = `
          <div class="dos-teams-msg-head">
            <span class="dos-teams-msg-author">${this._escape(m.author)}</span>
            <span class="dos-teams-msg-time">${m.time}</span>
          </div>
          <div class="dos-teams-msg-text">${this._escape(m.text)}</div>
        `;
        messages.appendChild(el);
      }
    };

    for (const ch of TEAMS_CHANNELS) {
      const btn = document.createElement("div");
      btn.className = "dos-teams-channel";
      btn.textContent = ch.name;
      btn.addEventListener("click", () => {
        sidebar.querySelectorAll(".dos-teams-channel").forEach((b) =>
          b.classList.remove("active"));
        btn.classList.add("active");
        renderChannel(ch);
      });
      sidebar.appendChild(btn);
    }
    // First channel selected by default
    sidebar.firstElementChild.classList.add("active");
    renderChannel(TEAMS_CHANNELS[0]);

    return wrap;
  }

  _buildLogs() {
    const wrap = document.createElement("div");
    wrap.className = "dos-teams";   // gleicher sidebar-style
    wrap.innerHTML = `
      <div class="dos-teams-sidebar"></div>
      <div class="dos-teams-main">
        <div class="dos-teams-header">Select a log file</div>
        <div class="dos-notepad" style="flex:1;"></div>
      </div>
    `;
    const sidebar = wrap.querySelector(".dos-teams-sidebar");
    const header = wrap.querySelector(".dos-teams-header");
    const content = wrap.querySelector(".dos-notepad");

    for (const f of LOG_FILES) {
      const item = document.createElement("div");
      item.className = "dos-teams-channel";
      item.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" style="vertical-align:-2px;margin-right:6px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>${f.name}`;
      item.addEventListener("click", () => {
        sidebar.querySelectorAll(".dos-teams-channel").forEach((b) =>
          b.classList.remove("active"));
        item.classList.add("active");
        header.textContent = f.name;
        content.textContent = f.content;
      });
      sidebar.appendChild(item);
    }
    sidebar.firstElementChild.click();
    return wrap;
  }

  _buildNotepad() {
    const wrap = document.createElement("div");
    wrap.className = "dos-notepad";
    wrap.textContent = BUG_TEMPLATE;
    // editable damit Recruiter rumtippen können
    wrap.setAttribute("contenteditable", "true");
    wrap.style.outline = "none";
    return wrap;
  }
}
