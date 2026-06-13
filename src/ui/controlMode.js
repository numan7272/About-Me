/**
 * controlMode — kleiner Singleton-Store für die Bike-Steuerung-Variante.
 *
 * Werte:
 *   "joystick" — In-World 3D Joystick (Default auf Mobile)
 *   "tap"      — League-of-Legends-Style Tap-to-Move (Default auf Mobile-Wahl)
 *
 * Persistiert in localStorage. Pub-Sub für Settings-UI + Player + TapToMove.
 */

const STORAGE_KEY = "numan-portfolio-control-mode-v1";
const PICKER_SEEN_KEY = "numan-portfolio-control-picker-seen-v1";

let _mode = "joystick";
const _subs = new Set();

try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "joystick" || saved === "tap") _mode = saved;
} catch {}

export function getControlMode() {
  return _mode;
}

export function setControlMode(mode) {
  if (mode !== "joystick" && mode !== "tap") return;
  if (mode === _mode) return;
  _mode = mode;
  try { localStorage.setItem(STORAGE_KEY, mode); } catch {}
  for (const fn of _subs) {
    try { fn(_mode); } catch (err) { console.error("[ControlMode] subscriber failed:", err); }
  }
}

export function subscribeControlMode(fn) {
  _subs.add(fn);
  return () => _subs.delete(fn);
}

export function hasPickerBeenSeen() {
  try { return !!localStorage.getItem(PICKER_SEEN_KEY); } catch { return false; }
}

export function markPickerSeen() {
  try { localStorage.setItem(PICKER_SEEN_KEY, "1"); } catch {}
}
