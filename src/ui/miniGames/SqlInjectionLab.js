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

const VALID_BYPASSES = [
  /'\s*or\s*'1'\s*=\s*'1/i,
  /'\s*or\s*1\s*=\s*1/i,
  /'\s*or\s*"1"\s*=\s*"1/i,
  /admin'\s*--/i,
  /admin'\s*#/i,
  /'\s*\|\|\s*'1'\s*=\s*'1/i,
];

const UNION_SUCCESS = /union\s+select.*from\s+users/i;

const HINTS = [
  "What happens if your input contains a single quote? Try just: ' (one quote).",
  "Try to break the WHERE-clause logic with: ' OR 1=1 --",
  "The `--` (two dashes + space) starts a comment in SQL — it ignores the rest.",
  "Bonus: Use `UNION SELECT username, password FROM users --` to exfiltrate data.",
];

export class SqlInjectionLab {
  constructor(game) {
    this.game = game;
    this.dom = null;
    this.themeName = "kali";
    this.theme = THEMES.kali;
    this.state = {
      level1Solved: false,
      level2Solved: false,
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
    const root = document.createElement("div");
    root.className = "sqli-overlay";
    root.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      display: flex; align-items: center; justify-content: center;
      background: ${t.overlayBg};
      backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      opacity: 0; transition: opacity 220ms ease;
      font-family: 'JetBrains Mono','Courier New',monospace;
      color: ${t.text};
      padding: 20px;
    `;

    const card = document.createElement("div");
    card.style.cssText = `
      max-width: 720px; width: 100%;
      background: ${t.cardBg};
      border: 1px solid ${t.border};
      border-radius: 12px;
      padding: 28px 30px;
      box-shadow: 0 24px 60px rgba(0,0,0,0.6);
      position: relative;
    `;

    card.innerHTML = `
      <div class="sqli-bar" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
        <div>
          <div style="font-size:11px;letter-spacing:1px;color:${t.accent};text-transform:uppercase;">Easter Egg · Lab</div>
          <h2 style="margin:4px 0 0;font-size:20px;">Restaurant-Reservation · Customer Login</h2>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
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
          <input class="sqli-user" type="text" autocomplete="off" spellcheck="false"
                 style="padding:9px 11px;background:${t.inputBg};border:1px solid ${t.border};border-radius:6px;color:${t.text};font-family:inherit;font-size:14px;outline:none;" />
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;opacity:0.8;">
          Password
          <input class="sqli-pass" type="text" autocomplete="off" spellcheck="false"
                 style="padding:9px 11px;background:${t.inputBg};border:1px solid ${t.border};border-radius:6px;color:${t.text};font-family:inherit;font-size:14px;outline:none;" />
        </label>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;">
          <div style="display:flex;gap:6px;">
            <button type="button" class="sqli-btn sqli-hint">Hint (${HINTS.length} left)</button>
            <button type="button" class="sqli-btn sqli-reset">Reset</button>
          </div>
          <button type="submit" class="sqli-btn sqli-submit" style="background:${t.accent};color:#000;font-weight:700;padding:8px 18px;">Login →</button>
        </div>
      </form>

      <div style="margin-top:18px;padding:14px 16px;background:${t.inputBg};border:1px solid ${t.border};border-radius:8px;">
        <div style="font-size:11px;letter-spacing:1px;opacity:0.6;text-transform:uppercase;margin-bottom:6px;">Live SQL Query</div>
        <code class="sqli-preview" style="display:block;font-size:13px;line-height:1.55;color:${t.accent};word-break:break-all;">
          (waiting for input...)
        </code>
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
    const query = this._buildQuery();

    // Level 2: UNION SELECT
    if (UNION_SUCCESS.test(user) || UNION_SUCCESS.test(pass)) {
      this.state.level2Solved = true;
      this._setStatus([
        "✅ UNION attack succeeded. Exfiltrated rows:",
        "  admin | 5f4dcc3b5aa765d61d8327deb882cf99",
        "  numan | a8f5f167f44f4964e6c998dee827110c",
        "  guest | 098f6bcd4621d373cade4e832627b4f6",
        "",
        "Real fix: parameterized queries (prepared statements).",
      ], "ok");
      this._fireSuccess();
      return;
    }

    // Level 1: Classic bypass — checke ob ein VALID_BYPASS in user ODER pass passt
    const combined = `${user} ${pass}`;
    const bypassed = VALID_BYPASSES.some((rx) => rx.test(user) || rx.test(pass));
    // Special-case: nur `admin'--` als user, leeres pass
    if (bypassed) {
      this.state.level1Solved = true;
      this._setStatus([
        "✅ Login bypassed. Welcome, admin.",
        "",
        "The WHERE-clause evaluated to TRUE for every row, so the server",
        "returned row #1 (the first user — usually admin).",
        "",
        "Bonus: try `UNION SELECT username, password FROM users --` in the",
        "username field to exfiltrate the password hashes.",
      ], "ok");
      this._fireSuccess();
      return;
    }

    if (user === "admin" && pass === "admin") {
      this._setStatus("Login failed (correct guess on credentials, but this lab wants you to USE injection — not guess).", "err");
      return;
    }
    if (!user && !pass) {
      this._setStatus("Please enter something.", "err");
      return;
    }

    this._setStatus(`Login failed. Query returned 0 rows.`, "err");
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
