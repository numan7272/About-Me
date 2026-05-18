/**
 * FakeOS — Base-Klasse für fake Desktop-Environments.
 *
 * Bietet:
 *   - Boot-Screen mit konfigurierbaren Text-Zeilen
 *   - Desktop-Container mit Wallpaper + Icon-Grid
 *   - Dock/Taskbar (positioniert je nach Subklasse)
 *   - Window-Management: open/close/min/max + Drag + Resize
 *   - Schließ-Logik per Esc und "Close OS"-Button
 *
 * Subklassen implementieren:
 *   _buildShell() — eigene Top-Bar / Taskbar / Wallpaper-Styles
 *   _registerApps() — return-Array von App-Configs:
 *     [{ id, label, icon, onOpen: (host) => contentNode, inDock?: bool }]
 *
 * Plus Convenience-Methoden:
 *   openApp(id) — startet eine App per ID
 *   close() — beendet die ganze fake-OS
 */

export class FakeOS {
  /**
   * @param {Game} game — Three-Game-Instance, für ui.miniGames.markComplete etc.
   * @param {Object} opts
   * @param {string} opts.osName — "NumanOS", "Designa Win11", "HAW-Moodle"
   * @param {string} opts.osClass — CSS-Klasse fürs Root-Element (auch CSS-Namespace)
   * @param {string[]} opts.bootLines — Text-Zeilen für den Boot-Screen (empty = skip boot)
   * @param {string} opts.bootBg — CSS-Background für Boot-Screen
   * @param {string} opts.bootColor — CSS-Color für Boot-Text
   */
  constructor(game, opts = {}) {
    this.game = game;
    this.opts = Object.assign({
      osName: "FakeOS",
      osClass: "fos",
      bootLines: [],
      bootBg: "#000",
      bootColor: "#b6f7b6",
    }, opts);

    this.dom = null;
    this.windowStack = [];
    this.zCounter = 100;
    this.apps = [];
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────

  open() {
    if (this.dom) return;
    this._buildDom();
    document.body.appendChild(this.dom.root);
    this._registerApps();
    this._renderIconsAndDock();
    this._startBootSequence();
  }

  close() {
    if (!this.dom) return;
    document.removeEventListener("keydown", this._onKey);
    this.dom.root.style.opacity = "0";
    const toRemove = this.dom.root;
    this.dom = null;
    setTimeout(() => toRemove.remove(), 220);
  }

  // ─── Subklassen-Hooks (override these) ────────────────────────────

  /** Subklassen können CSS-Spezial-Styles ergänzen. */
  _customStyles() { return ""; }

  /** Subklassen geben Apps zurück:
   *  [{ id, label, icon, onOpen: (host) => HTMLElement, inDock?, onDesktop? }]
   */
  _registerApps() {
    this.apps = [];
  }

  /** Subklassen können den Desktop-Wallpaper anpassen */
  _wallpaperStyle() {
    return `
      background:
        radial-gradient(1200px 800px at 20% 30%, rgba(85,150,255,0.18), transparent 60%),
        radial-gradient(900px 700px at 80% 70%, rgba(220,90,180,0.13), transparent 60%),
        linear-gradient(135deg, #1d1d1f 0%, #0b0b0d 100%);
    `;
  }

  /** Subklassen rendern ihr eigenes Chrome (TopBar bei mac, Taskbar bei Win11) */
  _renderChrome() {
    return "";
  }

  // ─── DOM-Bau ────────────────────────────────────────────────────────

  _buildDom() {
    const o = this.opts;
    const root = document.createElement("div");
    root.className = `fos-root ${o.osClass}`;
    root.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: #000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      color: #f5f5f7;
      opacity: 0; transition: opacity 220ms ease;
      overflow: hidden;
      user-select: none;
      -webkit-user-select: none;
    `;

    const style = document.createElement("style");
    style.textContent = this._baseStyles() + this._customStyles();
    root.appendChild(style);

    // Boot-Screen
    const boot = document.createElement("div");
    boot.className = "fos-boot";
    boot.style.background = o.bootBg;
    boot.style.color = o.bootColor;
    boot.innerHTML = `<div class="fos-boot-text"></div>`;
    root.appendChild(boot);

    // Desktop
    const desktop = document.createElement("div");
    desktop.className = "fos-desktop";
    desktop.style.cssText = this._wallpaperStyle();

    // Chrome (TopBar / Taskbar)
    const chrome = document.createElement("div");
    chrome.innerHTML = this._renderChrome();
    while (chrome.firstChild) desktop.appendChild(chrome.firstChild);

    // Desktop-Area mit Icons + Window-Layer
    const area = document.createElement("div");
    area.className = "fos-area";
    desktop.appendChild(area);

    const icons = document.createElement("div");
    icons.className = "fos-icons";
    area.appendChild(icons);

    const dock = document.createElement("div");
    dock.className = "fos-dock";
    area.appendChild(dock);

    // Globaler "Close OS"-Button — immer sichtbar oben rechts, schließt das ganze
    // fake-OS und kehrt zurück auf die Insel. Hat höhere z-index als alle Windows.
    const closeBtn = document.createElement("button");
    closeBtn.className = "fos-close-os";
    closeBtn.title = `${o.osName} schließen (Esc)`;
    closeBtn.innerHTML = `✕ Close ${o.osName}`;
    closeBtn.addEventListener("click", () => this.close());
    desktop.appendChild(closeBtn);

    root.appendChild(desktop);
    this.dom = { root, boot, desktop, area, icons, dock, closeBtn };

    this._wireGlobalEvents();
  }

  _wireGlobalEvents() {
    this._onKey = (e) => {
      if (e.key === "Escape") {
        if (this.windowStack.length > 0) {
          const top = this.windowStack[this.windowStack.length - 1];
          this._closeWindow(top);
        } else {
          this.close();
        }
      }
    };
    document.addEventListener("keydown", this._onKey);

    // Deselect Icons bei Click außerhalb
    this.dom.area.addEventListener("click", (e) => {
      if (!e.target.closest(".fos-icon") && !e.target.closest(".fos-window")
          && !e.target.closest(".fos-dock-icon")) {
        this.dom.icons.querySelectorAll(".fos-icon").forEach((el) =>
          el.classList.remove("selected"));
      }
    });
  }

  // ─── Boot ───────────────────────────────────────────────────────────

  _startBootSequence() {
    const lines = this.opts.bootLines;
    requestAnimationFrame(() => { this.dom.root.style.opacity = "1"; });
    if (!lines || lines.length === 0) {
      // Skip Boot, sofort Desktop
      this.dom.boot.style.display = "none";
      return;
    }
    const text = this.dom.boot.querySelector(".fos-boot-text");
    let i = 0;
    const tick = () => {
      if (i >= lines.length) {
        setTimeout(() => this._showDesktop(), 320);
        return;
      }
      const line = document.createElement("div");
      line.className = "fos-boot-line";
      line.textContent = lines[i];
      text.appendChild(line);
      i++;
      setTimeout(tick, 220);
    };
    setTimeout(tick, 280);
  }

  _showDesktop() {
    this.dom.boot.style.opacity = "0";
    setTimeout(() => { this.dom.boot.style.display = "none"; }, 440);
  }

  // ─── App-Rendering ──────────────────────────────────────────────────

  _renderIconsAndDock() {
    this.dom.icons.innerHTML = "";
    this.dom.dock.innerHTML = "";

    for (const app of this.apps) {
      if (app.onDesktop !== false) {
        const ic = document.createElement("div");
        ic.className = "fos-icon";
        ic.dataset.appId = app.id;
        ic.innerHTML = `
          <div class="fos-icon-glyph">${app.icon}</div>
          <div class="fos-icon-label">${app.label}</div>
        `;
        this.dom.icons.appendChild(ic);
      }
      if (app.inDock) {
        const di = document.createElement("div");
        di.className = "fos-dock-icon";
        di.dataset.appId = app.id;
        di.title = app.label;
        di.setAttribute("aria-label", app.label);
        // innerHTML statt textContent damit auch Inline-SVG-Icons rendern,
        // nicht nur Emoji-Strings.
        di.innerHTML = app.icon || "";
        this.dom.dock.appendChild(di);
      }
    }

    // Double-Click auf Desktop-Icons öffnet
    let lastClickTime = 0;
    let lastClickId = null;
    this.dom.icons.addEventListener("click", (e) => {
      const ic = e.target.closest(".fos-icon");
      if (!ic) return;
      const id = ic.dataset.appId;
      const now = Date.now();
      const isDouble = (id === lastClickId) && (now - lastClickTime < 380);
      lastClickTime = now;
      lastClickId = id;
      if (isDouble) {
        this.openApp(id);
      } else {
        this.dom.icons.querySelectorAll(".fos-icon").forEach((el) =>
          el.classList.toggle("selected", el.dataset.appId === id));
      }
    });

    // Single-Click im Dock öffnet
    this.dom.dock.addEventListener("click", (e) => {
      const di = e.target.closest(".fos-dock-icon");
      if (di) this.openApp(di.dataset.appId);
    });
  }

  /** Öffnet eine App per ID — Subklassen können das überschreiben. */
  openApp(id) {
    const app = this.apps.find((a) => a.id === id);
    if (!app) {
      console.warn(`[FakeOS] no app for id "${id}"`);
      return;
    }
    if (typeof app.onOpen === "function") {
      const node = app.onOpen(this);
      if (node) {
        this._openWindow(id, app.label || id, node, app.windowSize);
      }
    }
  }

  // ─── Window-Management ──────────────────────────────────────────────

  _openWindow(id, title, contentNode, sizeOpt = {}) {
    const existing = this.windowStack.find((w) => w.id === id);
    if (existing) {
      if (existing.minimized) {
        existing.el.classList.remove("fos-win-minimized");
        existing.minimized = false;
      }
      existing.el.style.zIndex = String(++this.zCounter);
      return existing;
    }

    const win = document.createElement("div");
    win.className = "fos-window";
    win.style.zIndex = String(++this.zCounter);

    const offsetX = 80 + (this.windowStack.length * 28);
    const offsetY = 60 + (this.windowStack.length * 24);
    const sizeW = sizeOpt.width  || 640;
    const sizeH = sizeOpt.height || 420;
    win.style.cssText += `
      left: ${offsetX}px; top: ${offsetY}px;
      width: ${sizeW}px; height: ${sizeH}px;
    `;

    win.innerHTML = this._renderWindowChrome(title);
    const body = document.createElement("div");
    body.className = "fos-win-body";
    body.appendChild(contentNode);
    win.appendChild(body);

    // Resize-Handles
    for (const dir of ["n","s","e","w","ne","nw","se","sw"]) {
      const h = document.createElement("div");
      h.className = `fos-resize-handle fos-resize-${dir}`;
      win.appendChild(h);
      this._makeResizable(win, h, dir);
    }

    const titlebar = win.querySelector(".fos-win-titlebar");
    this._makeDraggable(win, titlebar);

    const winRef = { el: win, id, prevState: null, minimized: false, maximized: false };

    // Buttons (close/min/max können je nach OS-Style anders heißen, aber alle haben data-action)
    win.querySelectorAll("[data-action='close']").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation(); this._closeWindow(winRef);
      }));
    win.querySelectorAll("[data-action='minimize']").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation(); this._minimizeWindow(winRef);
      }));
    win.querySelectorAll("[data-action='maximize']").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation(); this._toggleMaximize(winRef);
      }));

    titlebar.addEventListener("dblclick", (e) => {
      if (e.target.closest(".fos-traffic, .fos-win-controls")) return;
      this._toggleMaximize(winRef);
    });

    win.addEventListener("mousedown", () => {
      win.style.zIndex = String(++this.zCounter);
    });

    this.dom.area.appendChild(win);
    requestAnimationFrame(() => win.classList.add("shown"));
    this.windowStack.push(winRef);
    return winRef;
  }

  /** Subklassen überschreiben fürs eigene Window-Chrome (macOS Ampel vs Win11 Controls). */
  _renderWindowChrome(title) {
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

  _closeWindow(winRef) {
    const idx = this.windowStack.findIndex((w) => w === winRef);
    if (idx < 0) return;
    const { el } = winRef;
    el.classList.remove("shown");
    setTimeout(() => el.remove(), 200);
    this.windowStack.splice(idx, 1);
  }

  _minimizeWindow(winRef) {
    if (winRef.minimized) {
      winRef.el.classList.remove("fos-win-minimized");
      winRef.minimized = false;
    } else {
      winRef.el.classList.add("fos-win-minimized");
      winRef.minimized = true;
    }
  }

  _toggleMaximize(winRef) {
    const el = winRef.el;
    if (winRef.maximized) {
      const p = winRef.prevState;
      if (p) {
        el.style.left = p.left; el.style.top = p.top;
        el.style.width = p.width; el.style.height = p.height;
      }
      winRef.maximized = false;
      winRef.prevState = null;
    } else {
      winRef.prevState = {
        left: el.style.left, top: el.style.top,
        width: el.style.width, height: el.style.height,
      };
      const area = this.dom.area;
      el.style.left = "0px"; el.style.top = "0px";
      el.style.width = area.clientWidth + "px";
      el.style.height = area.clientHeight + "px";
      winRef.maximized = true;
    }
  }

  _makeDraggable(win, handle) {
    let offX = 0, offY = 0, dragging = false;
    handle.addEventListener("mousedown", (e) => {
      if (e.target.closest("[data-action]")) return;
      dragging = true;
      const rect = win.getBoundingClientRect();
      offX = e.clientX - rect.left;
      offY = e.clientY - rect.top;
      handle.style.cursor = "grabbing";
    });
    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const parentRect = this.dom.area.getBoundingClientRect();
      win.style.left = `${Math.max(0, e.clientX - parentRect.left - offX)}px`;
      win.style.top = `${Math.max(0, e.clientY - parentRect.top - offY)}px`;
    });
    document.addEventListener("mouseup", () => {
      dragging = false;
      handle.style.cursor = "grab";
    });
  }

  _makeResizable(win, handle, dir) {
    let startX = 0, startY = 0, startW = 0, startH = 0, startL = 0, startT = 0;
    let resizing = false;
    handle.addEventListener("mousedown", (e) => {
      const rect = win.getBoundingClientRect();
      startX = e.clientX; startY = e.clientY;
      startW = rect.width; startH = rect.height;
      startL = parseInt(win.style.left, 10) || 0;
      startT = parseInt(win.style.top, 10) || 0;
      resizing = true;
      e.preventDefault(); e.stopPropagation();
      win.style.zIndex = String(++this.zCounter);
    });
    document.addEventListener("mousemove", (e) => {
      if (!resizing) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      let w = startW, h = startH, l = startL, t = startT;
      if (dir.includes("e")) w = Math.max(280, startW + dx);
      if (dir.includes("s")) h = Math.max(180, startH + dy);
      if (dir.includes("w")) { w = Math.max(280, startW - dx); l = startL + (startW - w); }
      if (dir.includes("n")) { h = Math.max(180, startH - dy); t = startT + (startH - h); }
      win.style.left = l + "px"; win.style.top = t + "px";
      win.style.width = w + "px"; win.style.height = h + "px";
    });
    document.addEventListener("mouseup", () => { resizing = false; });
  }

  _escape(s) {
    return String(s).replace(/[&<>]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
  }

  // ─── Base-Styles (geteilt durch alle FakeOS-Varianten) ─────────────

  _baseStyles() {
    return `
      .fos-root *, .fos-root *::before, .fos-root *::after { box-sizing: border-box; }

      .fos-boot {
        position: absolute; inset: 0;
        display: flex; flex-direction: column;
        justify-content: center; align-items: center;
        padding: 40px;
        font-family: 'JetBrains Mono', 'SF Mono', 'Courier New', monospace;
        font-size: 13px;
        transition: opacity 400ms ease;
      }
      .fos-boot-line { opacity: 0; animation: fos-boot-fade 280ms ease forwards; }
      @keyframes fos-boot-fade { to { opacity: 1; } }

      .fos-desktop {
        position: absolute; inset: 0;
        display: flex; flex-direction: column;
      }
      .fos-area {
        flex: 1; position: relative;
        overflow: hidden;
        padding: 28px 36px;
      }

      .fos-icons {
        display: grid;
        grid-template-columns: repeat(auto-fill, 92px);
        gap: 14px;
        align-content: start;
      }
      .fos-icon {
        display: flex; flex-direction: column; align-items: center;
        gap: 6px;
        padding: 8px 6px;
        border-radius: 8px;
        cursor: pointer;
        transition: background 120ms ease;
        text-align: center;
      }
      .fos-icon:hover { background: rgba(255,255,255,0.07); }
      .fos-icon.selected { background: rgba(80,140,255,0.32); }
      .fos-icon-glyph {
        font-size: 38px;
        line-height: 1;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
      }
      .fos-icon-label {
        font-size: 12px;
        line-height: 1.25;
        color: #fff;
        text-shadow: 0 1px 2px rgba(0,0,0,0.65);
      }

      .fos-dock {
        position: absolute;
        bottom: 12px;
        left: 50%; transform: translateX(-50%);
        display: flex; gap: 10px;
        background: rgba(48,48,50,0.55);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 14px;
        padding: 8px 12px;
        z-index: 800;
      }
      .fos-dock-icon {
        font-size: 30px;
        color: #fff;
        cursor: pointer;
        transition: transform 180ms ease;
        line-height: 1;
        display: flex; align-items: center; justify-content: center;
      }
      .fos-dock-icon svg { width: 30px; height: 30px; display: block; }
      .fos-dock-icon:hover { transform: translateY(-6px) scale(1.15); }
      .fos-icon-glyph svg { width: 40px; height: 40px; display: block; color: #fff; }

      .fos-window {
        position: absolute;
        background: rgba(40,40,42,0.96);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 10px;
        box-shadow: 0 24px 60px rgba(0,0,0,0.55);
        display: flex; flex-direction: column;
        overflow: hidden;
        min-width: 280px; min-height: 180px;
        opacity: 0; transform: scale(0.94);
        transition: opacity 180ms ease, transform 180ms ease;
      }
      .fos-window.shown { opacity: 1; transform: scale(1); }
      .fos-win-titlebar {
        height: 34px;
        background: linear-gradient(180deg, rgba(60,60,62,0.95), rgba(48,48,50,0.95));
        border-bottom: 1px solid rgba(255,255,255,0.05);
        display: flex; align-items: center;
        padding: 0 12px;
        cursor: grab;
        gap: 10px;
        flex-shrink: 0;
      }
      .fos-win-title {
        flex: 1; font-size: 13px;
        opacity: 0.9; font-weight: 500;
      }
      .fos-win-controls {
        display: flex; gap: 4px;
      }
      .fos-win-controls button {
        width: 26px; height: 22px;
        background: transparent;
        border: 0; color: inherit;
        cursor: pointer; opacity: 0.65;
        border-radius: 3px;
      }
      .fos-win-controls button:hover { background: rgba(255,255,255,0.12); opacity: 1; }
      .fos-win-controls button[data-action="close"]:hover { background: #e81123; color: #fff; }

      .fos-win-body {
        flex: 1; overflow: auto; padding: 16px 18px;
        font-size: 13px; line-height: 1.5;
      }

      .fos-resize-handle { position: absolute; z-index: 10; }
      .fos-resize-n  { top: -3px; left: 8px; right: 8px; height: 6px; cursor: ns-resize; }
      .fos-resize-s  { bottom: -3px; left: 8px; right: 8px; height: 6px; cursor: ns-resize; }
      .fos-resize-e  { top: 8px; right: -3px; bottom: 8px; width: 6px; cursor: ew-resize; }
      .fos-resize-w  { top: 8px; left: -3px; bottom: 8px; width: 6px; cursor: ew-resize; }
      .fos-resize-ne { top: -3px; right: -3px; width: 12px; height: 12px; cursor: nesw-resize; }
      .fos-resize-nw { top: -3px; left: -3px; width: 12px; height: 12px; cursor: nwse-resize; }
      .fos-resize-se { bottom: -3px; right: -3px; width: 12px; height: 12px; cursor: nwse-resize; }
      .fos-resize-sw { bottom: -3px; left: -3px; width: 12px; height: 12px; cursor: nesw-resize; }

      .fos-win-minimized {
        transform: scale(0.05) translateY(800px) !important;
        opacity: 0 !important;
        pointer-events: none;
        transition: transform 280ms ease, opacity 220ms;
      }

      /* Globaler "Close OS"-Button — oben rechts, über allem */
      .fos-close-os {
        position: absolute;
        top: 14px; right: 14px;
        z-index: 9999;
        padding: 7px 14px;
        background: rgba(255, 90, 90, 0.18);
        border: 1px solid rgba(255, 90, 90, 0.45);
        color: #ffb0b0;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        transition: background 120ms, color 120ms;
      }
      .fos-close-os:hover {
        background: rgba(255, 90, 90, 0.55);
        color: #fff;
        border-color: rgba(255, 90, 90, 0.85);
      }

      @media (max-width: 640px) {
        .fos-area { padding: 16px 14px; }
        .fos-icons { grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 10px; }
        .fos-icon-glyph { font-size: 34px; }
        .fos-window {
          position: fixed !important;
          left: 0 !important; top: 32px !important;
          width: 100% !important; height: calc(100vh - 32px) !important;
          border-radius: 0; border: 0;
        }
        .fos-win-titlebar { cursor: default; }
        .fos-resize-handle { display: none; }
        .fos-close-os {
          top: 8px; right: 8px;
          padding: 6px 10px;
          font-size: 11px;
        }
      }
    `;
  }
}
