/**
 * App — React-Root für UI-Overlays.
 *
 * Aktuell nur ein FPS-Counter unten rechts. Die anderen UI-Komponenten
 * (Hud, MiniMap, Settings, Drawer, ContactPanel, ...) werden imperative
 * via Ui.js eingehängt — nicht React-rendered.
 */

import React, { useEffect, useState } from "react";

export function App({ game }) {
  const [fps, setFps] = useState(0);

  // Mini-FPS-Counter — polled das Game-Time-Delta einmal pro Sekunde
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

  return (
    <div className="fixed bottom-4 right-4 rounded-md border border-white/10
                    bg-black/40 px-3 py-1.5 text-xs text-zinc-300
                    backdrop-blur-md tabular-nums">
      {fps} FPS
    </div>
  );
}
