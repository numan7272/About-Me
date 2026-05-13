/**
 * Debug — Tweakpane Debug-GUI für Live-Tweaking aller Module.
 *
 * Aktivierung:
 *   - URL-Parameter ?debug oder ?debug=1
 *   - Localstorage-Key "numan-debug" auf "1"
 *   - Hotkey H toggelt Sichtbarkeit (Pane bleibt instanziiert)
 *
 * Im Production-Build ist der Pane standardmäßig aus. Module rufen
 *   `debug.addFolder({ title: "Grass", expanded: false })`
 *   `folder.addBinding(grass, "windStrength", { min: 0, max: 3 })`
 * und kriegen automatisch ein Live-Tweaking-Widget. Wenn debug.active
 * false ist, sind `addFolder`/`addBinding` No-Ops und liefern ein
 * Dummy-Objekt zurück — Module müssen NICHT prüfen ob Debug aktiv ist.
 *
 * Persistente Werte (z.B. DayCycle-Override) werden NICHT in localStorage
 * geschrieben — Tweakpane ist nur fürs Session-Tweaken. Wer Defaults
 * ändert, editiert den Code.
 */

import { Pane } from "tweakpane";

const STORAGE_FLAG = "numan-debug";
const STORAGE_GUI_HIDDEN = "numan-debug-gui-hidden";

// Dummy-Folder fürs Off-State — alle .add* Aufrufe sind No-Ops
class NoopFolder {
  addFolder() { return new NoopFolder(); }
  addBinding() {
    return {
      dispose() {},
      on() { return this; },
      refresh() {},
    };
  }
  addButton() {
    return {
      on() { return this; },
      dispose() {},
      refresh() {},
    };
  }
  addBlade() { return { dispose() {}, refresh() {} }; }
  addTab() { return new NoopFolder(); }
  dispose() {}
  refresh() {}
  on() { return this; }
  get hidden() { return true; }
  set hidden(_v) {}
}

function shouldEnable() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has("debug")) {
      const v = params.get("debug");
      return v === null || v === "" || v === "1" || v === "true";
    }
    if (localStorage.getItem(STORAGE_FLAG) === "1") return true;
  } catch (e) {}
  return false;
}

export class Debug {
  constructor() {
    this.active = shouldEnable();

    if (!this.active) {
      // No-Op-Stub — Module dürfen blind addFolder/addBinding rufen
      this.pane = new NoopFolder();
      this._hotkeyHandler = null;
      return;
    }

    this.pane = new Pane({
      title: "Debug — Numan Portfolio",
      expanded: true,
    });

    // Style-Anpassung: rechts oben, dezent
    const el = this.pane.element;
    if (el?.parentElement) {
      Object.assign(el.parentElement.style, {
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: "20",
        width: "300px",
        maxHeight: "calc(100vh - 40px)",
        overflowY: "auto",
      });
    }

    // Sichtbarkeit ggf. wiederherstellen
    try {
      if (localStorage.getItem(STORAGE_GUI_HIDDEN) === "1") {
        this._setHidden(true);
      }
    } catch (e) {}

    // Hotkey H toggelt Sichtbarkeit
    this._hotkeyHandler = (e) => {
      if (e.code === "KeyH" && !e.repeat) {
        // Nicht togglen wenn Fokus auf Input ist
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea") return;
        this._setHidden(!this._isHidden());
      }
    };
    window.addEventListener("keydown", this._hotkeyHandler);

    console.log(
      "[Debug] active — press H to toggle GUI, " +
      "remove ?debug from URL or set localStorage 'numan-debug'=0 to disable",
    );
  }

  _isHidden() {
    return !!this.pane?.element?.parentElement?.style?.display
      && this.pane.element.parentElement.style.display === "none";
  }

  _setHidden(hidden) {
    const parent = this.pane?.element?.parentElement;
    if (!parent) return;
    parent.style.display = hidden ? "none" : "block";
    try {
      localStorage.setItem(STORAGE_GUI_HIDDEN, hidden ? "1" : "0");
    } catch (e) {}
  }

  /** Sub-Module nutzen das hier statt direkten Pane-Zugriff. */
  addFolder(opts) {
    return this.pane.addFolder(opts);
  }

  /** Convenience für statische Werte (FPS etc) */
  addReadout(target, key, opts = {}) {
    return this.pane.addBinding(target, key, { readonly: true, ...opts });
  }

  destroy() {
    if (this._hotkeyHandler) {
      window.removeEventListener("keydown", this._hotkeyHandler);
      this._hotkeyHandler = null;
    }
    this.pane?.dispose?.();
    this.pane = null;
  }
}
