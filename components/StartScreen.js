"use client";

import { useEffect, useState } from "react";

/**
 * Bruno-Simon-inspired "Click to start" intro overlay.
 *
 * Sits on top of the running 3D scene until the player clicks anywhere or
 * presses any key.  The Canvas keeps rendering underneath so the world is
 * already warm by the time the overlay fades out — no second loading lag.
 *
 * The overlay disables itself for screen readers once visible content is
 * a no-op so its visual flair doesn't pollute assistive output later.
 */
export default function StartScreen({ onStart }) {
  const [exiting, setExiting] = useState(false);
  const [visible, setVisible] = useState(true);

  // Capture the very first user interaction (click or key) and trigger
  // the fade-out. The fade itself is CSS — once it finishes we hide the
  // node entirely so it can't ever block pointer events again.
  useEffect(() => {
    if (exiting) return;
    const trigger = () => {
      if (exiting) return;
      setExiting(true);
      onStart?.();
      // Match the fade duration in CSS below
      window.setTimeout(() => setVisible(false), 650);
    };
    window.addEventListener("pointerdown", trigger, { once: true });
    window.addEventListener("keydown",     trigger, { once: true });
    return () => {
      window.removeEventListener("pointerdown", trigger);
      window.removeEventListener("keydown",     trigger);
    };
  }, [exiting, onStart]);

  if (!visible) return null;

  return (
    <div
      aria-label="Click to start"
      className={[
        "fixed inset-0 z-[60] flex items-center justify-center select-none",
        "bg-gradient-to-b from-[#0a0d18] via-[#0e1428] to-[#040614]",
        "transition-opacity duration-[650ms] ease-out",
        exiting ? "pointer-events-none opacity-0" : "opacity-100",
      ].join(" ")}
    >
      {/* Faint background grid — pure CSS, picks up the bloom subtly */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(167, 139, 250, 0.6) 1px, transparent 1px),
            linear-gradient(90deg, rgba(167, 139, 250, 0.6) 1px, transparent 1px)
          `,
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.9) 30%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.9) 30%, transparent 75%)",
        }}
      />

      <div className="relative flex flex-col items-center gap-6 px-6 text-center">
        {/* Glowing podium ring — pure CSS spinner with a soft outer halo */}
        <div className="relative flex h-44 w-44 items-center justify-center">
          <div
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(125,211,252,0.35) 0%, rgba(125,211,252,0) 70%)",
            }}
          />
          <div
            aria-hidden
            className="absolute inset-3 rounded-full border border-cyan-300/60 shadow-[0_0_28px_rgba(125,211,252,0.55)]"
            style={{ animation: "ss-spin 7s linear infinite" }}
          />
          <div
            aria-hidden
            className="absolute inset-7 rounded-full border border-pink-300/40"
            style={{ animation: "ss-spin 11s linear infinite reverse" }}
          />
          {/* Centre bike-glyph — uses lucide's outline aesthetic without
              shipping the icon, since the SVG is small enough inline */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="relative h-14 w-14 text-zinc-100 drop-shadow-[0_0_10px_rgba(125,211,252,0.65)]"
            aria-hidden
          >
            <circle cx="6"  cy="17" r="3.5" />
            <circle cx="18" cy="17" r="3.5" />
            <path d="M6 17 L11 7 L15 7 L18 17" />
            <path d="M11 7 L9 7" />
          </svg>
        </div>

        {/* Title */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] uppercase tracking-[0.42em] text-zinc-500">
            Numan Yesil
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100 md:text-3xl">
            Numan&apos;s Roadmap
          </h1>
          <p className="mt-1 text-[12px] uppercase tracking-[0.32em] text-zinc-400">
            an interactive portfolio
          </p>
        </div>

        {/* Click-to-start prompt */}
        <div className="mt-2 flex flex-col items-center gap-2">
          <div
            className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2 text-[13px] tracking-[0.18em] text-zinc-100 backdrop-blur-md"
            style={{ animation: "ss-pulse 1.6s ease-in-out infinite" }}
          >
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
            <span>Click to start</span>
          </div>
          <span className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">
            Drive · Tap a building · Discover
          </span>
        </div>
      </div>

      {/* Local keyframes — scoped to this component so the rest of the
          app doesn't need to know they exist. */}
      <style>{`
        @keyframes ss-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes ss-pulse {
          0%, 100% { transform: translateY(0); opacity: 0.95; }
          50%      { transform: translateY(-3px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
