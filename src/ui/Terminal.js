/**
 * Terminal — Fullscreen-Overlay Pseudo-Terminal für Easter-Egg Mini-Games.
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

const THEMES = {
  kali: {
    bg: "#0d0e10",
    text: "#e6e6e6",
    promptColor: "#7eff7e",
    accent: "#fb923c",
    error: "#ff6b6b",
    selBg: "rgba(126,255,126,0.25)",
    fontFamily: "'JetBrains Mono','Courier New',monospace",
  },
  matrix: {
    bg: "#000",
    text: "#28ff28",
    promptColor: "#88ff88",
    accent: "#28ff28",
    error: "#ff5555",
    selBg: "rgba(40,255,40,0.4)",
    fontFamily: "'JetBrains Mono','Courier New',monospace",
  },
  light: {
    bg: "#f8f8f7",
    text: "#1a1a1a",
    promptColor: "#0a5e0a",
    accent: "#e35d10",
    error: "#c92a2a",
    selBg: "rgba(126,255,126,0.4)",
    fontFamily: "'JetBrains Mono','Courier New',monospace",
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

    this._buildDom();
  }

  _buildDom() {
    const t = this.theme;
    const root = document.createElement("div");
    root.className = "term-overlay";
    root.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      display: flex; flex-direction: column;
      background: ${t.bg}; color: ${t.text};
      font-family: ${t.fontFamily};
      font-size: 14px; line-height: 1.45;
      padding: 0; margin: 0;
      opacity: 0; transition: opacity 220ms ease;
    `;

    // Title-Bar mit Schließen + Theme-Switcher
    const bar = document.createElement("div");
    bar.style.cssText = `
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 14px;
      background: rgba(255,255,255,0.04);
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
    root.appendChild(bar);

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
      .term-cursor::after {
        content: "▋"; color: ${t.text};
        animation: term-blink 1s steps(1) infinite;
      }
      @keyframes term-blink { 50% { opacity: 0; } }
      .term-overlay ::selection { background: ${t.selBg}; }
    `;
    root.appendChild(style);

    // Scrollable output
    const output = document.createElement("div");
    output.className = "term-output";
    output.style.cssText = `
      flex: 1; overflow-y: auto;
      padding: 16px 18px;
    `;
    root.appendChild(output);

    // Input-Zeile (Prompt + aktuelle Eingabe + Cursor)
    const inputLine = document.createElement("div");
    inputLine.className = "term-input-line";
    inputLine.style.cssText = `
      padding: 4px 18px 18px; display: flex; align-items: center;
      flex-shrink: 0;
    `;
    inputLine.innerHTML = `
      <span class="term-prompt">${this._escape(this.prompt)}</span>
      <span class="term-buffer" style="margin-left:2px;"></span>
      <span class="term-cursor"></span>
    `;
    root.appendChild(inputLine);

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
    root.appendChild(ta);

    this.dom = {
      root, bar, output, inputLine,
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
    this.dom.bufferSpan.textContent = this.buffer;
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
    if (e.key === "Enter") {
      e.preventDefault();
      const cmd = this.buffer.trim();
      // Echo der eingegebenen Zeile
      this._appendLine(`${this.prompt}${this.buffer}`, "in");
      if (cmd) {
        this.history.push(cmd);
        this.historyIndex = this.history.length;
      }
      this.buffer = "";
      this._renderBuffer();
      // Special: clear / exit
      if (cmd === "clear" || cmd === "cls") {
        this.dom.output.innerHTML = "";
        return;
      }
      if (cmd === "exit" || cmd === "quit") {
        this.close();
        return;
      }
      // Submit via callback
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
      this.buffer = this.buffer.slice(0, -1);
      this._renderBuffer();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (this.history.length === 0) return;
      this.historyIndex = Math.max(0, this.historyIndex - 1);
      this.buffer = this.history[this.historyIndex] || "";
      this._renderBuffer();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (this.history.length === 0) return;
      this.historyIndex = Math.min(this.history.length, this.historyIndex + 1);
      this.buffer = this.history[this.historyIndex] || "";
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
    // Normale Zeichen
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      this.buffer += e.key;
      this._renderBuffer();
    }
  }

  _tryComplete() {
    if (!this.allowTabComplete.length) return;
    const prefix = this.buffer;
    if (!prefix) return;
    const match = this.allowTabComplete.find((s) => s.startsWith(prefix));
    if (match) {
      this.buffer = match;
      this._renderBuffer();
    }
  }

  setTheme(name) {
    const t = THEMES[name] || THEMES.kali;
    this.theme = t;
    this.themeName = name;
    // Re-build mit altem Output erhalten — einfacher: in-place updaten
    const root = this.dom.root;
    root.style.background = t.bg;
    root.style.color = t.text;
    // Style-Block ersetzen
    const oldStyle = root.querySelector("style");
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
      .term-cursor::after { content: "▋"; color: ${t.text}; animation: term-blink 1s steps(1) infinite; }
      @keyframes term-blink { 50% { opacity: 0; } }
      .term-overlay ::selection { background: ${t.selBg}; }
    `;
    root.appendChild(style);
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
