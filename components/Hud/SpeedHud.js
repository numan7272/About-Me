"use client";

import { useEffect, useRef, useState } from "react";
import { bikeState } from "@/lib/bikeStore";

/**
 * Glassmorphism speedometer that animates between values smoothly.
 *
 * Layout:
 *  - Mobile (< md): compact pill in the top-left under the hint label,
 *    so it never collides with the steering D-pad in the bottom-right.
 *  - Desktop (≥ md): roomier pill in the bottom-right, well above the
 *    Zentrieren button.
 *
 * Polled via rAF; only re-renders React when the displayed integer
 * actually changes.
 */
export default function SpeedHud() {
  const [kmh, setKmh] = useState(0);
  const display   = useRef(0);
  const lastPaint = useRef(0);

  useEffect(() => {
    let rafId;
    const tick = (t) => {
      // m/s → km/h is ×3.6 — but we map MAX_SPEED (7.5) to a "feels right" 60 kmh
      const targetKmh = bikeState.speed * 8;
      display.current += (targetKmh - display.current) * 0.18;

      const rounded = Math.round(display.current);
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

  const barPct = Math.min(100, (kmh / 60) * 100);
  const accent =
    barPct < 60 ? "#22d3ee" : barPct < 85 ? "#fbbf24" : "#f87171";

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-30 select-none
                 left-4 top-16
                 md:left-auto md:top-auto md:right-5 md:bottom-24"
    >
      <div className="relative rounded-2xl border border-white/10 bg-zinc-900/55 backdrop-blur-xl ring-1 ring-white/5 shadow-[0_10px_30px_rgba(0,0,0,0.5)]
                      px-3 py-2
                      md:px-4 md:py-3">
        <div className="text-[9px] font-medium uppercase tracking-[0.22em] text-zinc-400 md:mb-1">
          Speed
        </div>
        <div className="flex items-baseline gap-1.5 tabular-nums">
          <span
            className="font-semibold leading-none transition-colors duration-300
                       text-[20px] md:text-[28px]"
            style={{ color: accent, textShadow: `0 0 12px ${accent}55` }}
          >
            {kmh}
          </span>
          <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 md:text-[10px]">
            km/h
          </span>
        </div>
        <div className="mt-1.5 h-1 w-20 overflow-hidden rounded-full bg-white/10 md:mt-2 md:w-28">
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
