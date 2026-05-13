/**
 * SqlInjectionLab — Easter-Egg: User übt SQL-Injection an einem fiktiven
 * Customer-Login einer Restaurant-Reservation-App.
 *
 * UI ist ein "vulnerable Login-Form" mit Live-SQL-Preview daneben:
 * der User tippt seinen Input und sieht in Echtzeit die generierte
 * SQL-Query. Bei korrektem Payload (' OR 1=1 -- etc) → Bypass.
 *
 * Levels:
 *   L1: Klassischer "OR 1=1" Bypass
 *   L2: Optional — UNION SELECT um Daten zu exfiltrieren
 *
 * Stil: Login-Form als zentriertes Card-Overlay, kein Terminal.
 * Theme-Switch: Kali/Light/Cyber.
 */

const THEMES = {
  kali: {
    overlayBg: "rgba(8, 9, 12, 0.92)",
    cardBg: "#1a1c20",
    text: "#e6e6e6",
    accent: "#7eff7e",
    error: "#ff6b6b",
    border: "rgba(255,255,255,0.12)",
    inputBg: "#0d0e10",
  },
  light: {
    overlayBg: "rgba(245, 245, 245, 0.94)",
    cardBg: "#ffffff",
    text: "#1a1a1a",
    accent: "#0a7a0a",
    error: "#c92a2a",
    border: "rgba(0,0,0,0.10)",
    inputBg: "#f5f5f5",
  },
  cyber: {
    overlayBg: "rgba(10, 0, 20, 0.92)",
    cardBg: "#1a0a2c",
    text: "#f0e6ff",
    accent: "#ff5cff",
    error: "#ff6b6b",
    border: "rgba(255,92,255,0.25)",
    inputBg: "#0d0418",
  },
};

// Level-1: klassischer Tautology-Bypass
const LEVEL1_TAUTOLOGY = [
  /'\s*or\s*'1'\s*=\s*'1/i,
  /'\s*or\s*1\s*=\s*1/i,
  /'\s*or\s*"1"\s*=\s*"1/i,
  /'\s*\|\|\s*'1'\s*=\s*'1/i,
];

// Level-2: Comment-Bypass — schließt Username-Quote + kommentiert Password aus
const LEVEL2_COMMENT = [
  /^admin'\s*--/i,
  /^admin'\s*#/i,
  /^admin'\/\*/i,
];

// Level-3: UNION-based Data Exfiltration
const LEVEL3_UNION = /union\s+select.*from\s+users/i;

// Level-4: Blind / Time-based — User triggert ein SLEEP/BENCHMARK/WAITFOR
const LEVEL4_BLIND = [
  /sleep\s*\(\s*\d+\s*\)/i,
  /benchmark\s*\(/i,
  /waitfor\s+delay/i,
  /pg_sleep\s*\(/i,
];

const HINTS = [
  "L1: Was passiert wenn deine Eingabe ein einzelnes Anführungszeichen enthält? Probier einfach: '",
  "L1: Brich die WHERE-Klausel mit Tautology: ' OR 1=1 --",
  "L2: Statt OR 1=1 — versuch direkt admin'-- als Username. Das Quote schließt den String, -- kommentiert den Rest aus.",
  "L3: Extrahier Daten mit UNION. Probier: ' UNION SELECT username, password FROM users --",
  "L4: Wenn das Login-Response gleich aussieht für richtig und falsch — Blind-SQLi. Probier ' AND SLEEP(5) -- und schau auf die Response-Time.",
];

export class SqlInjectionLab {
  constructor(game) {
    this.game = game;
    this.dom = null;
    this.themeName = "kali";
    this.theme = THEMES.kali;
    this.state = {
      level1Solved: false,   // Tautology (OR 1=1)
      level2Solved: false,   // Comment-Bypass (admin'--)
      level3Solved: false,   // UNION SELECT
      level4Solved: false,   // Time-based blind
      hintsUsed: 0,
    };
  }

  open() {
    if (this.dom) return;
    this._buildDom();
    document.body.appendChild(this.dom.root);
    requestAnimationFrame(() => {
      this.dom.root.style.opacity = "1";
      this.dom.userInput.focus();
    });
  }

  _buildDom() {
    const t = this.theme;
    const isMobile = window.matchMedia("(max-width: 640px)").matches;

    const root = document.createElement("div");
    root.className = "sqli-overlay";
    root.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      display: flex; align-items: ${isMobile ? "flex-start" : "center"}; justify-content: center;
      background: ${t.overlayBg};
      backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      opacity: 0; transition: opacity 220ms ease;
      font-family: 'JetBrains Mono','Courier New',monospace;
      color: ${t.text};
      padding: ${isMobile ? "0" : "20px"};
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    `;

    const card = document.createElement("div");
    card.style.cssText = `
      max-width: 720px; width: 100%;
      background: ${t.cardBg};
      border: ${isMobile ? "0" : `1px solid ${t.border}`};
      border-radius: ${isMobile ? "0" : "12px"};
      padding: ${isMobile ? "20px 18px" : "28px 30px"};
      box-shadow: 0 24px 60px rgba(0,0,0,0.6);
      position: relative;
      min-height: ${isMobile ? "100vh" : "auto"};
      box-sizing: border-box;
    `;

    card.innerHTML = `
      <div class="sqli-bar" style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:18px;gap:12px;flex-wrap:wrap;">
        <div style="flex:1;min-width:200px;">
          <div style="font-size:11px;letter-spacing:1px;color:${t.accent};text-transform:uppercase;">Easter Egg · Lab</div>
          <h2 style="margin:4px 0 0;font-size:${isMobile ? "16px" : "20px"};">Restaurant-Reservation · Customer Login</h2>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <button class="sqli-btn" data-theme="kali">Kali</button>
          <button class="sqli-btn" data-theme="cyber">Cyber</button>
          <button class="sqli-btn" data-theme="light">Light</button>
          <button class="sqli-btn" data-action="close" style="margin-left:6px;color:${t.error};">✕ Close</button>
        </div>
      </div>

      <p style="margin:0 0 16px;opacity:0.75;font-size:13px;line-height:1.5;">
        This is a deliberately vulnerable login form. The query is built by string
        concatenation — exactly how PortSwigger Lab #1 demonstrates it.
        Try to log in as <code style="color:${t.accent};">admin</code> without knowing the password.
      </p>

      <form class="sqli-form" style="display:grid;grid-template-columns:1fr;gap:10px;">
        <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;opacity:0.8;">
          Username
          <input class="sqli-user" type="text" autocomplete="off" spellcheck="false" autocapitalize="off" autocorrect="off"
                 style="padding:12px;background:${t.inputBg};border:1px solid ${t.border};border-radius:6px;color:${t.text};font-family:inherit;font-size:16px;outline:none;min-height:44px;" />
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;opacity:0.8;">
          Password
          <input class="sqli-pass" type="text" autocomplete="off" spellcheck="false" autocapitalize="off" autocorrect="off"
                 style="padding:12px;background:${t.inputBg};border:1px solid ${t.border};border-radius:6px;color:${t.text};font-family:inherit;font-size:16px;outline:none;min-height:44px;" />
        </label>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;flex-wrap:wrap;gap:8px;">
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button type="button" class="sqli-btn sqli-hint" style="min-height:44px;padding:8px 14px;">Hint (${HINTS.length} left)</button>
            <button type="button" class="sqli-btn sqli-reset" style="min-height:44px;padding:8px 14px;">Reset</button>
          </div>
          <button type="submit" class="sqli-btn sqli-submit" style="background:${t.accent};color:#000;font-weight:700;padding:12px 22px;min-height:44px;font-size:14px;">Login →</button>
        </div>
      </form>

      <div style="margin-top:18px;padding:14px 16px;background:${t.inputBg};border:1px solid ${t.border};border-radius:8px;">
        <div style="font-size:11px;letter-spacing:1px;opacity:0.6;text-transform:uppercase;margin-bottom:6px;">Live SQL Query</div>
        <code class="sqli-preview" style="display:block;font-size:13px;line-height:1.55;color:${t.accent};word-break:break-all;">
          (waiting for input...)
        </code>
      </div>

      <div class="sqli-levels" style="margin-top:14px;display:flex;flex-wrap:wrap;gap:6px;">
        <span class="sqli-lvl" data-level="1" style="padding:4px 9px;border-radius:6px;background:rgba(255,255,255,0.05);border:1px solid ${t.border};font-size:11px;font-family:'JetBrains Mono',monospace;opacity:0.65;">L1 Tautology</span>
        <span class="sqli-lvl" data-level="2" style="padding:4px 9px;border-radius:6px;background:rgba(255,255,255,0.05);border:1px solid ${t.border};font-size:11px;font-family:'JetBrains Mono',monospace;opacity:0.65;">L2 Comment</span>
        <span class="sqli-lvl" data-level="3" style="padding:4px 9px;border-radius:6px;background:rgba(255,255,255,0.05);border:1px solid ${t.border};font-size:11px;font-family:'JetBrains Mono',monospace;opacity:0.65;">L3 UNION</span>
        <span class="sqli-lvl" data-level="4" style="padding:4px 9px;border-radius:6px;background:rgba(255,255,255,0.05);border:1px solid ${t.border};font-size:11px;font-family:'JetBrains Mono',monospace;opacity:0.65;">L4 Blind</span>
      </div>

      <div class="sqli-status" style="margin-top:14px;font-size:13px;min-height:20px;"></div>
    `;

    root.appendChild(card);

    // Style fürs Card
    const style = document.createElement("style");
    style.textContent = `
      .sqli-btn {
        background: rgba(255,255,255,0.08);
        border: 1px solid ${t.border};
        color: inherit;
        padding: 5px 11px;
        border-radius: 5px;
        cursor: pointer;
        font-family: inherit;
        font-size: 11px;
      }
      .sqli-btn:hover { background: rgba(255,255,255,0.18); }
      .sqli-submit:hover { filter: brightness(1.1); }
      .sqli-user:focus, .sqli-pass:focus {
        border-color: ${t.accent} !important;
      }
    `;
    root.appendChild(style);

    this.dom = {
      root,
      card,
      userInput: card.querySelector(".sqli-user"),
      passInput: card.querySelector(".sqli-pass"),
      preview: card.querySelector(".sqli-preview"),
      status: card.querySelector(".sqli-status"),
      form: card.querySelector(".sqli-form"),
      hintBtn: card.querySelector(".sqli-hint"),
      resetBtn: card.querySelector(".sqli-reset"),
      style,
    };

    // Wire-up
    this.dom.userInput.addEventListener("input", () => this._updatePreview());
    this.dom.passInput.addEventListener("input", () => this._updatePreview());
    this.dom.form.addEventListener("submit", (e) => {
      e.preventDefault();
      this._trySubmit();
    });
    this.dom.hintBtn.addEventListener("click", () => this._showHint());
    this.dom.resetBtn.addEventListener("click", () => this._reset());
    card.querySelectorAll("[data-theme]").forEach((b) => {
      b.addEventListener("click", () => this.setTheme(b.dataset.theme));
    });
    card.querySelector("[data-action='close']")
      .addEventListener("click", () => this.close());

    // Esc to close
    this._onKey = (e) => { if (e.key === "Escape") this.close(); };
    document.addEventListener("keydown", this._onKey);

    this._updatePreview();
  }

  _buildQuery() {
    const user = this.dom.userInput.value;
    const pass = this.dom.passInput.value;
    return `SELECT * FROM users WHERE username = '${user}' AND password = '${pass}';`;
  }

  _updatePreview() {
    this.dom.preview.textContent = this._buildQuery();
  }

  _trySubmit() {
    const user = this.dom.userInput.value;
    const pass = this.dom.passInput.value;
    const combined = `${user} ${pass}`;

    // ─── Level 4: Blind / Time-Based ───
    // (vor Level 3 weil UNION-Pattern matchen würde auf "SELECT")
    if (LEVEL4_BLIND.some((rx) => rx.test(user) || rx.test(pass))) {
      this.state.level4Solved = true;
      this._setStatus([
        "⏱  Server hat 5 Sekunden gebraucht zum Antworten…",
        "✅ Blind / Time-Based SQLi bestätigt.",
        "",
        "Auch wenn das Login-Response gleich aussieht — die Response-Time",
        "verrät dir ob deine injizierte Bedingung TRUE ist. Damit kannst du",
        "Daten Byte-für-Byte exfiltrieren, ohne sichtbare Ausgabe.",
        "",
        "Real fix: parametrisierte Queries + Response-Time-Constant-Time.",
      ], "ok");
      this._fireSuccess();
      this._updateLevelTracker();
      return;
    }

    // ─── Level 3: UNION-based Exfil ───
    if (LEVEL3_UNION.test(user) || LEVEL3_UNION.test(pass)) {
      this.state.level3Solved = true;
      this._setStatus([
        "✅ UNION-Attack erfolgreich — extrahierte Rows aus `users`:",
        "  admin | 5f4dcc3b5aa765d61d8327deb882cf99   // MD5('password')",
        "  numan | a8f5f167f44f4964e6c998dee827110c   // MD5('123456')",
        "  guest | 098f6bcd4621d373cade4e832627b4f6   // MD5('test')",
        "",
        "Real fix: parametrisierte Queries (prepared statements) + Least-",
        "Privilege auf DB-User (kein SELECT auf users für den Login-Endpoint).",
      ], "ok");
      this._fireSuccess();
      this._updateLevelTracker();
      return;
    }

    // ─── Level 2: Comment-Bypass (admin'--) ───
    if (LEVEL2_COMMENT.some((rx) => rx.test(user))) {
      this.state.level2Solved = true;
      this._setStatus([
        "✅ Comment-Bypass erfolgreich. Eingeloggt als admin.",
        "",
        "Das Quote schließt den Username-String, `--` kommentiert den Rest",
        "der Query aus. Die Password-Bedingung ist nie evaluiert worden.",
        "",
        "Next: UNION-Exfil (' UNION SELECT username, password FROM users --)",
        "oder Blind/Time-Based (' AND SLEEP(5) --).",
      ], "ok");
      this._fireSuccess();
      this._updateLevelTracker();
      return;
    }

    // ─── Level 1: Tautology (OR 1=1) ───
    if (LEVEL1_TAUTOLOGY.some((rx) => rx.test(user) || rx.test(pass))) {
      this.state.level1Solved = true;
      this._setStatus([
        "✅ Login per Tautology bypassed. Welcome, admin.",
        "",
        "Die WHERE-Klausel wurde für ALLE Rows zu TRUE, der Server hat die",
        "erste Zeile zurückgegeben (= admin, weil zuerst angelegt).",
        "",
        "Next-Levels:",
        "  L2: admin'-- als Username (Comment-Bypass)",
        "  L3: ' UNION SELECT username,password FROM users -- (Exfil)",
        "  L4: ' AND SLEEP(5) -- (Time-Based Blind)",
      ], "ok");
      this._fireSuccess();
      this._updateLevelTracker();
      return;
    }

    // ─── Fehler / Hints ───
    if (user === "admin" && pass === "admin") {
      this._setStatus("Login failed. Das Lab will Injection sehen, nicht raten.", "err");
      return;
    }
    if (!user && !pass) {
      this._setStatus("Bitte was eingeben.", "err");
      return;
    }

    this._setStatus("Login failed. Query gab 0 Rows zurück.", "err");
  }

  _updateLevelTracker() {
    if (!this.dom?.root) return;
    const map = {
      1: this.state.level1Solved,
      2: this.state.level2Solved,
      3: this.state.level3Solved,
      4: this.state.level4Solved,
    };
    const lvls = this.dom.root.querySelectorAll(".sqli-lvl");
    lvls.forEach((el) => {
      const lvl = parseInt(el.dataset.level, 10);
      if (map[lvl]) {
        el.style.opacity = "1";
        el.style.background = `${this.theme.accent}22`;
        el.style.border = `1px solid ${this.theme.accent}`;
        el.style.color = this.theme.accent;
        if (!el.dataset.checked) {
          el.textContent = "✓ " + el.textContent;
          el.dataset.checked = "1";
        }
      }
    });
  }

  _setStatus(line, kind = "info") {
    const color = kind === "ok" ? this.theme.accent
                : kind === "err" ? this.theme.error
                : this.theme.text;
    if (Array.isArray(line)) {
      this.dom.status.innerHTML = line
        .map((l) => `<div style="color:${color};white-space:pre-wrap;">${this._escape(l)}</div>`)
        .join("");
    } else {
      this.dom.status.innerHTML = `<div style="color:${color}">${this._escape(line)}</div>`;
    }
  }

  _escape(s) {
    return String(s).replace(/[&<>]/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;",
    }[c]));
  }

  _showHint() {
    if (this.state.level1Solved && this.state.level2Solved) {
      this._setStatus("Already cracked both levels. Nothing left.", "info");
      return;
    }
    const i = this.state.hintsUsed;
    if (i >= HINTS.length) {
      this._setStatus("All hints exhausted. Try Reset and start over.", "info");
      return;
    }
    this.state.hintsUsed++;
    this._setStatus(`[Hint ${i + 1}/${HINTS.length}] ${HINTS[i]}`, "info");
    this.dom.hintBtn.textContent = `Hint (${HINTS.length - this.state.hintsUsed} left)`;
  }

  _reset() {
    this.dom.userInput.value = "";
    this.dom.passInput.value = "";
    this._updatePreview();
    this.dom.status.innerHTML = "";
  }

  _fireSuccess() {
    if (this._success) return;
    this._success = true;
    const miniGames = this.game.ui?.miniGames;
    miniGames?.markComplete?.("container");
  }

  setTheme(name) {
    const t = THEMES[name] || THEMES.kali;
    this.theme = t;
    this.themeName = name;
    // Re-build (einfach: schließen + öffnen mit alten Status). Aber visuell
    // einfacher: alte DOM raus, neue rein.
    const oldUserVal = this.dom.userInput.value;
    const oldPassVal = this.dom.passInput.value;
    const oldStatusHTML = this.dom.status.innerHTML;
    this.dom.root.remove();
    document.removeEventListener("keydown", this._onKey);
    this.dom = null;
    this._buildDom();
    document.body.appendChild(this.dom.root);
    this.dom.userInput.value = oldUserVal;
    this.dom.passInput.value = oldPassVal;
    this.dom.status.innerHTML = oldStatusHTML;
    this._updatePreview();
    requestAnimationFrame(() => {
      this.dom.root.style.opacity = "1";
    });
  }

  close() {
    if (!this.dom) return;
    this.dom.root.style.opacity = "0";
    document.removeEventListener("keydown", this._onKey);
    const toRemove = this.dom;
    this.dom = null;
    setTimeout(() => toRemove.root.remove(), 220);
  }
}
