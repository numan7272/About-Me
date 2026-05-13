/**
 * App — React-Root für UI-Overlays.
 *
 * Phase 1: zeigt nur einen Banner oben in der Mitte damit man sieht
 * dass die UI über dem 3D-Canvas rendert.
 *
 * Phase 6 wird hier der Settings-Modal, MiniMap, Speed-HUD,
 * InfoCard, StartScreen etc. landen.
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
    <>
      {/* Banner oben */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 rounded-full
                      border border-white/15 bg-black/40 px-5 py-2
                      text-[12px] tracking-[0.25em] text-zinc-200
                      backdrop-blur-md">
        Numan · Vite + Three.js · Phase 1
      </div>

      {/* FPS-Counter unten rechts */}
      <div className="fixed bottom-4 right-4 rounded-md border border-white/10
                      bg-black/40 px-3 py-1.5 text-xs text-zinc-300
                      backdrop-blur-md tabular-nums">
        {fps} FPS
      </div>
    </>
  );
}
