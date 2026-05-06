"use client";

import { useEffect, useState } from "react";

/**
 * Bottom-left "X / N secrets found" badge plus a one-shot toast that
 * pops in when the player just unlocked an egg.
 *
 * The component is a pure presenter — all the persistence logic lives in
 * `lib/useDiscoveries.js`. We just take the numbers and a `justUnlocked`
 * id and render.
 */

const EGG_LABELS = {
  raspberrypi: "Hardware Hacking",
  router:      "The Gastro Pentest",
  container:   "Self-Hosted",
  weight:      "Resistance & Growth",
};

export default function DiscoveryHud({ count, total, allFound, justUnlocked, onToastDone }) {
  const [toastId, setToastId] = useState(null);

  // Latch the just-unlocked id into local state so the badge can play its
  // animation, then clear the parent's flag so we don't re-toast.
  useEffect(() => {
    if (!justUnlocked) return;
    setToastId(justUnlocked);
    onToastDone?.();
    const t = window.setTimeout(() => setToastId(null), 3200);
    return () => window.clearTimeout(t);
  }, [justUnlocked, onToastDone]);

  return (
    <>
      {/* Badge — sits below the social dock on desktop, above it on mobile */}
      <div
        className="pointer-events-none absolute left-5 z-30 select-none
                   bottom-5 md:bottom-5"
        aria-label={`${count} of ${total} secrets discovered`}
      >
        <div
          className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium tracking-wide text-zinc-200 backdrop-blur-md transition-all"
          style={{
            background:  allFound ? "rgba(167,139,250,0.20)" : "rgba(10,10,20,0.55)",
            borderColor: allFound ? "rgba(196,181,253,0.55)" : "rgba(255,255,255,0.10)",
            boxShadow:   allFound
              ? "0 0 18px rgba(167,139,250,0.45), inset 0 0 0 1px rgba(196,181,253,0.20)"
              : "0 4px 16px rgba(0,0,0,0.35)",
          }}
        >
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{
              background: allFound ? "#c4b5fd" : "#34d399",
              boxShadow:  `0 0 8px ${allFound ? "rgba(196,181,253,0.95)" : "rgba(52,211,153,0.85)"}`,
            }}
          />
          <span className="uppercase tracking-[0.16em] text-zinc-400/80">Secrets</span>
          <span className="tabular-nums text-zinc-100">
            {count}<span className="text-zinc-500">/</span>{total}
          </span>
          {allFound && (
            <span className="ml-1 text-[10px] uppercase tracking-[0.18em] text-violet-200">
              · all found
            </span>
          )}
        </div>
      </div>

      {/* Toast — appears centred-top when an egg is freshly discovered */}
      {toastId && (
        <div
          className="pointer-events-none absolute left-1/2 top-24 z-40 -translate-x-1/2 select-none"
          style={{
            animation: "discoveryToast 3.2s cubic-bezier(0.16,1,0.3,1) forwards",
          }}
        >
          <style>{`
            @keyframes discoveryToast {
              0%   { opacity: 0; transform: translate(-50%, -10px) scale(0.94); }
              12%  { opacity: 1; transform: translate(-50%, 0)     scale(1.00); }
              78%  { opacity: 1; transform: translate(-50%, 0)     scale(1.00); }
              100% { opacity: 0; transform: translate(-50%, -8px)  scale(0.96); }
            }
          `}</style>
          <div
            className="flex items-center gap-3 rounded-2xl border border-emerald-300/40 bg-zinc-950/85 px-5 py-3 text-center backdrop-blur-md"
            style={{ boxShadow: "0 12px 36px rgba(16,185,129,0.35)" }}
          >
            <span
              aria-hidden
              className="text-xl"
              style={{ filter: "drop-shadow(0 0 6px rgba(16,185,129,0.7))" }}
            >
              {/* Egg emoji avoids needing an SVG asset */}
              🥚
            </span>
            <div className="flex flex-col items-start">
              <span className="text-[10px] uppercase tracking-[0.32em] text-emerald-300/90">
                Secret discovered
              </span>
              <span className="text-[13px] font-medium text-white">
                {EGG_LABELS[toastId] ?? toastId}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
