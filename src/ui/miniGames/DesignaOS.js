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

      /* Win11-Taskbar unten */
      .dos .fos-dock {
        bottom: 8px;
        background: rgba(28, 32, 44, 0.85);
        backdrop-filter: blur(28px) saturate(180%);
        -webkit-backdrop-filter: blur(28px) saturate(180%);
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 10px;
        padding: 6px 12px;
        gap: 8px;
      }
      .dos .fos-dock-icon {
        font-size: 24px;
        padding: 4px 8px;
        border-radius: 6px;
      }
      .dos .fos-dock-icon:hover {
        background: rgba(255,255,255,0.10);
        transform: translateY(-2px) scale(1.05);
      }

      /* Win11-Fenster — eckiger, weniger Rundung als macOS */
      .dos .fos-window {
        border-radius: 8px;
        background: rgba(28, 32, 44, 0.96);
      }
      .dos .fos-win-titlebar {
        height: 36px;
        background: linear-gradient(180deg, rgba(36,40,52,0.95), rgba(28,32,44,0.95));
      }
      .dos .fos-win-controls button {
        width: 32px; height: 28px;
        border-radius: 0;
      }

      /* Start-Button auf der Taskbar (links) */
      .dos-startbtn {
        position: absolute;
        bottom: 8px;
        left: calc(50% - 200px);
        width: 38px; height: 38px;
        background: rgba(28, 32, 44, 0.85);
        backdrop-filter: blur(28px);
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 8px;
        display: flex; align-items: center; justify-content: center;
        font-size: 18px;
        z-index: 800;
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
    return `<div class="dos-startbtn" title="Start">⊞</div>`;
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
    this.apps = [
      {
        id: "jira",
        label: "TestLab Tracker",
        icon: "🎯",
        inDock: true,
        windowSize: { width: 720, height: 480 },
        onOpen: (host) => this._buildJira(),
      },
      {
        id: "teams",
        label: "Teams",
        icon: "💬",
        inDock: true,
        windowSize: { width: 760, height: 500 },
        onOpen: (host) => this._buildTeams(),
      },
      {
        id: "logs",
        label: "Logs",
        icon: "📂",
        inDock: true,
        windowSize: { width: 720, height: 480 },
        onOpen: (host) => this._buildLogs(),
      },
      {
        id: "notepad",
        label: "Bug Template",
        icon: "📝",
        inDock: true,
        windowSize: { width: 580, height: 500 },
        onOpen: (host) => this._buildNotepad(),
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
          <span>👤 ${t.assignee}</span>
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
      item.innerHTML = `📄 ${f.name}`;
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
