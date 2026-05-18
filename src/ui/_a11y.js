/**
 * A11y-Utilities: Haptic-Feedback + Reduced-Motion-Detection.
 *
 * `haptic(ms)` — Vibration auf Mobile (Android Chrome, iOS Safari unterstützt
 *   navigator.vibrate aktuell NICHT, aber wir guard'en sauber). No-op auf
 *   Desktop.
 *
 * `prefersReducedMotion()` — synchron, liefert true wenn der User
 *   `prefers-reduced-motion: reduce` gesetzt hat. JS-Animationen sollen
 *   das respektieren (CSS-Transitions sind schon via Media-Query gehandhabt).
 */

let _reducedMotionCached = null;

export function haptic(ms = 10) {
  if (typeof navigator === "undefined") return;
  // Reduced-Motion impliziert auch keine Vibrations-Wünsche.
  if (prefersReducedMotion()) return;
  if (typeof navigator.vibrate !== "function") return;
  try { navigator.vibrate(ms); } catch {}
}

export function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  if (_reducedMotionCached !== null) return _reducedMotionCached;
  try {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    _reducedMotionCached = !!mq.matches;
    // Live-Change-Handler (z.B. User schaltet im OS um)
    if (mq.addEventListener) {
      mq.addEventListener("change", (e) => { _reducedMotionCached = !!e.matches; });
    }
    return _reducedMotionCached;
  } catch {
    return false;
  }
}
