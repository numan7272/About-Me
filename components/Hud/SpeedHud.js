"use client";

import { useEffect, useRef, useState } from "react";
import { bikeState } from "@/lib/bikeStore";

/**
 * Glassmorphism speedometer that animates between values smoothly.
 * Polled via rAF; never triggers React re-renders unless the displayed
 * integer "kmh" actually changes — keeps the DOM cheap.
 */
export default function SpeedHud() {
  const [kmh, setKmh] = useState(0);
  const display = useRef(0);
  const lastPaint = useRef(0);

  useEffect(() => {
    let rafId;
    const tick = (t) => {
      // m/s → km/h is ×3.6 — but we map MAX_SPEED (7.5) to a "feels right" 60 kmh
      const targetKmh = bikeState.speed * 8;
      // Critically-damped catch-up
      display.current += (targetKmh - display.current) * 0.18;

      const rounded = Math.round(display.current);
      // throttle setState to ~30 fps when the value changes
      if (rounded !== lastPaint.current && t - (tick.last || 0) > 33) {
        lastPaint.current = rounded;
        setKmh(rounded);
        tick.last = t;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Bar fill % (cap at 100%)
  const barPct = Math.min(100, (kmh / 60) * 100);
  // Heat color shifts to amber/red as speed approaches max
  const accent =
    barPct < 60 ? "#22d3ee" : barPct < 85 ? "#fbbf24" : "#f87171";

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-24 right-5 z-30 select-none md:bottom-28"
    >
      <div className="relative rounded-2xl border border-white/10 bg-zinc-900/55 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl ring-1 ring-white/5">
        <div className="mb-1 text-[9px] font-medium uppercase tracking-[0.22em] text-zinc-400">
          Speed
        </div>
        <div className="flex items-baseline gap-1.5 tabular-nums">
          <span
            className="text-[28px] font-semibold leading-none transition-colors duration-300"
            style={{ color: accent, textShadow: `0 0 12px ${accent}55` }}
          >
            {kmh}
          </span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
            km/h
          </span>
        </div>
        {/* Speed bar */}
        <div className="mt-2 h-1 w-28 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-[width,background-color] duration-150"
            style={{
              width: `${barPct}%`,
              backgroundColor: accent,
              boxShadow: `0 0 8px ${accent}88`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
