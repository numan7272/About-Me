/**
 * Terminal — schwebendes Pseudo-Terminal-Fenster für Easter-Egg Mini-Games.
 *
 * Sandbox-Modus: User-Commands werden gegen ein Script-Mapping geprüft. Es
 * gibt KEINE echte Shell — alle Output-Zeilen kommen aus dem Script. Das
 * macht das Mini-Game deterministisch, sicher und schnell zu bauen.
 *
 * Custom Theme:
 *   - Kali-Look (default): grüner Prompt, weißer Text auf schwarzem Background
 *   - Matrix: alles grün, Glitter-Effekt
 *   - Light: weißer Background, dunkler Text (Recruiter-Friendly)
 *
 * Usage:
 *   const term = new Terminal({
 *     prompt: "numan@kali:~$ ",
 *     theme: "kali",
 *     onSubmit: (cmd) => { ... return string|string[]|null ... },
 *     onClose: () => { ... },
 *   });
 *   term.open();
 *   term.print("Welcome to the lab.");
 *   term.print(["multi", "line"]);
 *   term.close();
 *
 * onSubmit returns:
 *   - string → printed as one line
 *   - string[] → printed as multiple lines
 *   - null/undefined → just push prompt, no output (e.g. cleared screen)
 *   - Promise<...> → awaited then printed
 */

const TERM_FONT = "'Departure Mono','JetBrains Mono','Courier New',monospace";

const THEMES = {
  kali: {
    bg: "#0d0e10",
    barBg: "rgba(255,255,255,0.04)",
    text: "#e6e6e6",
    promptColor: "#7eff7e",
    accent: "#fb923c",
    error: "#ff6b6b",
    selBg: "rgba(126,255,126,0.25)",
    scanlines: 0.05,
    fontFamily: TERM_FONT,
  },
  matrix: {
    bg: "#000",
    barBg: "rgba(40,255,40,0.06)",
    text: "#28ff28",
    promptColor: "#88ff88",
    accent: "#28ff28",
    error: "#ff5555",
    selBg: "rgba(40,255,40,0.4)",
    scanlines: 0.09,
    fontFamily: TERM_FONT,
  },
  light: {
    bg: "#f8f8f7",
    barBg: "rgba(0,0,0,0.05)",
    text: "#1a1a1a",
    promptColor: "#0a5e0a",
    accent: "#e35d10",
    error: "#c92a2a",
    selBg: "rgba(126,255,126,0.4)",
    scanlines: 0,
    fontFamily: TERM_FONT,
  },
};

export class Terminal {
  constructor({
    prompt = "numan@kali:~$ ",
    theme = "kali",
    onSubmit = () => null,
    onClose = () => {},
    welcome = [],
    title = "Terminal",
    allowTabComplete = [],
  } = {}) {
    this.prompt = prompt;
    this.themeName = theme;
    this.theme = THEMES[theme] || THEMES.kali;
    this.onSubmit = onSubmit;
    this.onClose = onClose;
    this.welcome = Array.isArray(welcome) ? welcome : [welcome];
    this.title = title;
    this.allowTabComplete = allowTabComplete;

    this.history = [];
    this.historyIndex = -1;
    this.buffer = "";
    this.cursor = 0;     // Cursor-Position innerhalb von this.buffer (0 .. buffer.length)

    this._buildDom();
  }

  _buildDom() {
    const t = this.theme;
    // Backdrop + schwebendes Terminal-Fenster statt Fullscreen-Overlay.
    // Das Fenster ist diegetisch (gehört zur Spielwelt, nicht zum HUD),
    // darf also Schatten + größeren Radius tragen.
    const root = document.createElement("div");
    root.className = "term-overlay";
    root.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      display: flex; align-items: center; justify-content: center;
      background: rgba(9, 17, 16, 0.62);
      padding: 3vh 3vw;
      opacity: 0; transition: opacity 220ms ease;
    `;

    const win = document.createElement("div");
    win.className = "term-window";
    win.style.cssText = `
      position: relative;
      display: flex; flex-direction: column;
      width: min(940px, 100%); height: min(620px, 100%);
      background: ${t.bg}; color: ${t.text};
      font-family: ${t.fontFamily};
      font-size: 14px; line-height: 1.45;
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 10px;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55);
      overflow: hidden;
    `;
    root.appendChild(win);

    // CRT-Scanlines — subtil, nur bei dunklen Themes sichtbar
    const scan = document.createElement("div");
    scan.className = "term-scanlines";
    scan.style.cssText = `
      position: absolute; inset: 0; pointer-events: none; z-index: 2;
      background: repeating-linear-gradient(
        0deg, rgba(0,0,0,0.55) 0px, rgba(0,0,0,0.55) 1px,
        transparent 1px, transparent 3px);
      opacity: ${t.scanlines};
    `;
    win.appendChild(scan);

    // Title-Bar mit Schließen + Theme-Switcher
    const bar = document.createElement("div");
    bar.style.cssText = `
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 14px;
      background: ${t.barBg};
      border-bottom: 1px solid rgba(255,255,255,0.08);
      flex-shrink: 0;
    `;
    bar.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:#ff5f56;"></span>
        <span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:#ffbd2e;"></span>
        <span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:#27c93f;"></span>
        <span style="opacity:0.7;margin-left:8px;font-size:12px;">${this.title}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;font-size:12px;">
        <button data-theme="kali" class="term-btn">Kali</button>
        <button data-theme="matrix" class="term-btn">Matrix</button>
        <button data-theme="light" class="term-btn">Light</button>
        <button data-action="close" class="term-btn" style="margin-left:6px;color:${t.error};">✕ Close [Esc]</button>
      </div>
    `;
    win.appendChild(bar);

    // Style für theme-buttons
    const style = document.createElement("style");
    style.textContent = `
      .term-btn {
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.12);
        color: inherit;
        padding: 3px 9px;
        border-radius: 5px;
        cursor: pointer;
        font-family: inherit;
        font-size: 11px;
      }
      .term-btn:hover { background: rgba(255,255,255,0.18); }
      .term-line { white-space: pre-wrap; word-break: break-word; }
      .term-line.in { opacity: 0.95; }
      .term-line.out { opacity: 0.88; }
      .term-line.err { color: ${t.error}; }
      .term-line.dim { opacity: 0.55; }
      .term-line.accent { color: ${t.accent}; }
      .term-line.success { color: ${t.promptColor}; font-weight: 600; }
      .term-prompt { color: ${t.promptColor}; }
      .term-cursor-inline {
        display: inline-block;
        background: ${t.text};
        color: ${t.bg};
        min-width: 0.55em;
        animation: term-blink 1.1s steps(1) infinite;
      }
      @keyframes term-blink { 50% { background: transparent; color: ${t.text}; } }
      .term-overlay ::selection { background: ${t.selBg}; }

      /* ── Mobile (≤ 640px): Fenster wird fullscreen ── */
      @media (max-width: 640px) {
        .term-overlay { padding: 0; }
        .term-window {
          width: 100% !important;
          height: 100% !important;
          border-radius: 0 !important;
          border: 0 !important;
          font-size: 12px;
        }
        .term-btn {
          padding: 6px 10px;
          font-size: 11px;
          min-height: 32px;
        }
        .term-output { padding: 12px 14px; font-size: 12px; }
        .term-input-line { padding: 4px 14px 12px; font-size: 14px; }
        .term-prompt { font-size: 12px; }
        .term-cursor::after { font-size: 12px; }
      }
    `;
    win.appendChild(style);

    // Scrollable output
    const output = document.createElement("div");
    output.className = "term-output";
    output.style.cssText = `
      flex: 1; overflow-y: auto;
      padding: 16px 18px;
    `;
    win.appendChild(output);

    // Input-Zeile (Prompt + aktuelle Eingabe + Cursor)
    const inputLine = document.createElement("div");
    inputLine.className = "term-input-line";
    inputLine.style.cssText = `
      padding: 4px 18px 18px; display: flex; align-items: center;
      flex-shrink: 0;
    `;
    inputLine.innerHTML = `
      <span class="term-prompt">${this._escape(this.prompt)}</span>
      <span class="term-buffer" style="margin-left:2px;white-space:pre;"></span>
    `;
    win.appendChild(inputLine);

    // Hidden <textarea> für echte Keyboard-Events (besser als window-Listener
    // wegen iOS-Focus-Verhalten)
    const ta = document.createElement("textarea");
    ta.className = "term-hidden-input";
    ta.style.cssText = `
      position: absolute; opacity: 0; pointer-events: none;
      top: -1000px;
    `;
    ta.setAttribute("autocomplete", "off");
    ta.setAttribute("autocorrect", "off");
    ta.setAttribute("autocapitalize", "off");
    ta.setAttribute("spellcheck", "false");
    win.appendChild(ta);

    this.dom = {
      root, win, scan, bar, output, inputLine,
      bufferSpan: inputLine.querySelector(".term-buffer"),
      promptSpan: inputLine.querySelector(".term-prompt"),
      ta,
    };

    // Wire-up
    bar.querySelectorAll("[data-theme]").forEach((b) => {
      b.addEventListener("click", () => this.setTheme(b.dataset.theme));
    });
    bar.querySelector("[data-action='close']")
      .addEventListener("click", () => this.close());

    // Click anywhere → focus
    root.addEventListener("click", () => ta.focus());

    // Keyboard
    ta.addEventListener("keydown", (e) => this._onKey(e));
  }

  _escape(s) {
    return String(s).replace(/[&<>]/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;",
    }[c]));
  }

  _renderBuffer() {
    // Buffer in 3 Teile splitten: vor-Cursor, an-Cursor (1 Zeichen), nach-Cursor.
    // Damit kann der Block-Cursor mitten im Text liegen.
    const c = Math.max(0, Math.min(this.buffer.length, this.cursor));
    const before = this.buffer.slice(0, c);
    const atCursor = this.buffer.slice(c, c + 1);
    const after = this.buffer.slice(c + 1);
    this.dom.bufferSpan.innerHTML =
      this._escape(before) +
      `<span class="term-cursor-inline">${this._escape(atCursor) || " "}</span>` +
      this._escape(after);
  }

  _appendLine(text, cls = "out") {
    const line = document.createElement("div");
    line.className = `term-line ${cls}`;
    line.textContent = String(text);
    this.dom.output.appendChild(line);
    this.dom.output.scrollTop = this.dom.output.scrollHeight;
  }

  /** print() — fügt eine oder mehrere Zeilen zum Output hinzu. */
  print(line, cls = "out") {
    if (line === null || line === undefined) return;
    if (Array.isArray(line)) {
      for (const l of line) this._appendLine(l, cls);
    } else {
      this._appendLine(line, cls);
    }
  }

  _onKey(e) {
    // ── Ctrl+C — laufenden Befehl abbrechen, neue Prompt-Zeile ──
    if (e.ctrlKey && (e.key === "c" || e.key === "C")) {
      e.preventDefault();
      this._appendLine(`${this.prompt}${this.buffer}^C`, "in");
      this.buffer = "";
      this.cursor = 0;
      this._renderBuffer();
      return;
    }
    // ── Ctrl+L — clear screen (Bash-Standard) ──
    if (e.ctrlKey && (e.key === "l" || e.key === "L")) {
      e.preventDefault();
      this.dom.output.innerHTML = "";
      return;
    }
    // ── Ctrl+A — Cursor an Anfang ──
    if (e.ctrlKey && (e.key === "a" || e.key === "A")) {
      e.preventDefault();
      this.cursor = 0;
      this._renderBuffer();
      return;
    }
    // ── Ctrl+E — Cursor ans Ende ──
    if (e.ctrlKey && (e.key === "e" || e.key === "E")) {
      e.preventDefault();
      this.cursor = this.buffer.length;
      this._renderBuffer();
      return;
    }
    // ── Ctrl+U — Zeile bis Cursor löschen ──
    if (e.ctrlKey && (e.key === "u" || e.key === "U")) {
      e.preventDefault();
      this.buffer = this.buffer.slice(this.cursor);
      this.cursor = 0;
      this._renderBuffer();
      return;
    }
    // ── Ctrl+K — Zeile ab Cursor löschen ──
    if (e.ctrlKey && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      this.buffer = this.buffer.slice(0, this.cursor);
      this._renderBuffer();
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const cmd = this.buffer.trim();
      this._appendLine(`${this.prompt}${this.buffer}`, "in");
      if (cmd) {
        this.history.push(cmd);
        this.historyIndex = this.history.length;
      }
      this.buffer = "";
      this.cursor = 0;
      this._renderBuffer();
      if (cmd === "clear" || cmd === "cls") {
        this.dom.output.innerHTML = "";
        return;
      }
      if (cmd === "exit" || cmd === "quit") {
        this.close();
        return;
      }
      let result;
      try {
        result = this.onSubmit(cmd);
      } catch (err) {
        this._appendLine(`error: ${err.message}`, "err");
        return;
      }
      if (result && typeof result.then === "function") {
        result.then((r) => this.print(r));
      } else if (result !== undefined && result !== null) {
        this.print(result);
      }
      return;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      if (this.cursor > 0) {
        this.buffer = this.buffer.slice(0, this.cursor - 1) + this.buffer.slice(this.cursor);
        this.cursor--;
        this._renderBuffer();
      }
      return;
    }
    if (e.key === "Delete") {
      e.preventDefault();
      if (this.cursor < this.buffer.length) {
        this.buffer = this.buffer.slice(0, this.cursor) + this.buffer.slice(this.cursor + 1);
        this._renderBuffer();
      }
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (this.cursor > 0) {
        this.cursor--;
        this._renderBuffer();
      }
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      if (this.cursor < this.buffer.length) {
        this.cursor++;
        this._renderBuffer();
      }
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      this.cursor = 0;
      this._renderBuffer();
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      this.cursor = this.buffer.length;
      this._renderBuffer();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (this.history.length === 0) return;
      this.historyIndex = Math.max(0, this.historyIndex - 1);
      this.buffer = this.history[this.historyIndex] || "";
      this.cursor = this.buffer.length;
      this._renderBuffer();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (this.history.length === 0) return;
      this.historyIndex = Math.min(this.history.length, this.historyIndex + 1);
      this.buffer = this.history[this.historyIndex] || "";
      this.cursor = this.buffer.length;
      this._renderBuffer();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      this.close();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      this._tryComplete();
      return;
    }
    // Normale Zeichen — an Cursor-Position einfügen
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      this.buffer = this.buffer.slice(0, this.cursor) + e.key + this.buffer.slice(this.cursor);
      this.cursor++;
      this._renderBuffer();
    }
  }

  _tryComplete() {
    if (!this.allowTabComplete.length) return;
    const prefix = this.buffer;
    if (!prefix) return;
    const matches = this.allowTabComplete.filter((s) => s.startsWith(prefix));
    if (matches.length === 1) {
      // Exakt eine Möglichkeit → auto-complete
      this.buffer = matches[0];
      this.cursor = this.buffer.length;
      this._renderBuffer();
    } else if (matches.length > 1) {
      // Mehrere Möglichkeiten → wie Bash: alle anzeigen, buffer unverändert
      this._appendLine(`${this.prompt}${this.buffer}`, "in");
      this._appendLine(matches.join("   "), "dim");
    }
  }

  setTheme(name) {
    const t = THEMES[name] || THEMES.kali;
    this.theme = t;
    this.themeName = name;
    // Re-build mit altem Output erhalten — einfacher: in-place updaten
    const win = this.dom.win;
    win.style.background = t.bg;
    win.style.color = t.text;
    if (this.dom.bar) this.dom.bar.style.background = t.barBg;
    if (this.dom.scan) this.dom.scan.style.opacity = String(t.scanlines);
    // Style-Block ersetzen
    const oldStyle = win.querySelector("style");
    if (oldStyle) oldStyle.remove();
    // Re-inject style
    const style = document.createElement("style");
    style.textContent = `
      .term-btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: inherit; padding: 3px 9px; border-radius: 5px; cursor: pointer; font-family: inherit; font-size: 11px; }
      .term-btn:hover { background: rgba(255,255,255,0.18); }
      .term-line { white-space: pre-wrap; word-break: break-word; }
      .term-line.in { opacity: 0.95; }
      .term-line.out { opacity: 0.88; }
      .term-line.err { color: ${t.error}; }
      .term-line.dim { opacity: 0.55; }
      .term-line.accent { color: ${t.accent}; }
      .term-line.success { color: ${t.promptColor}; font-weight: 600; }
      .term-prompt { color: ${t.promptColor}; }
      .term-cursor-inline { display: inline-block; background: ${t.text}; color: ${t.bg}; min-width: 0.55em; animation: term-blink 1.1s steps(1) infinite; }
      @keyframes term-blink { 50% { background: transparent; color: ${t.text}; } }
      .term-overlay ::selection { background: ${t.selBg}; }
    `;
    win.appendChild(style);
  }

  setPrompt(p) {
    this.prompt = p;
    this.dom.promptSpan.textContent = p;
  }

  open() {
    document.body.appendChild(this.dom.root);
    // Welcome ausgeben
    for (const line of this.welcome) {
      this._appendLine(line, "dim");
    }
    requestAnimationFrame(() => {
      this.dom.root.style.opacity = "1";
      this.dom.ta.focus();
    });
  }

  close() {
    this.dom.root.style.opacity = "0";
    setTimeout(() => {
      this.dom.root.remove();
    }, 220);
    this.onClose?.();
  }
}
