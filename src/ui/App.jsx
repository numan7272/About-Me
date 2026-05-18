/**
 * App — React-Root für UI-Overlays.
 *
 * Aktuell nur ein FPS-Counter unten rechts (brutalist mono).
 * Andere UI-Komponenten werden imperativ via Ui.js eingehängt.
 */

import { useEffect, useState } from "react";

const SIGNAL_FPS_THRESHOLD = 55;

export function App() {
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let last = performance.now();
    let frames = 0;
    let rafId;
    const tick = () => {
      frames++;
      const now = performance.now();
      if (now - last >= 1000) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const isLow = fps > 0 && fps < SIGNAL_FPS_THRESHOLD;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "16px",
        right: "16px",
        padding: "4px 8px",
        fontFamily: "var(--font-mono)",
        fontSize: "11px",
        color: isLow ? "var(--signal)" : "var(--paper-muted)",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "0.02em",
        pointerEvents: "none",
      }}
      aria-label={`${fps} frames per second`}
    >
      {String(fps).padStart(3, " ")} fps
    </div>
  );
}
