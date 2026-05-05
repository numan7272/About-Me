"use client";

import { useEffect, useRef } from "react";

/**
 * Glassmorphism info card that slides in from the right.
 * Triggered by both proximity (sensor) and click on a landmark.
 * Closed by the X button or by driving away.
 */
export default function InfoCard({ card, onClose }) {
  const ref = useRef();

  // Focus trap: close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!card) return null;

  const { title, subtitle, timeframe, text, skills, color, accent } = card;

  return (
    <div
      ref={ref}
      className="pointer-events-auto absolute right-5 top-1/2 z-40 w-[min(340px,92vw)] -translate-y-1/2"
      style={{
        animation: "slideIn 0.32s cubic-bezier(0.16,1,0.3,1) both",
      }}
    >
      <style>{`
        @keyframes slideIn {
          from { opacity:0; transform:translateY(-50%) translateX(40px); }
          to   { opacity:1; transform:translateY(-50%) translateX(0); }
        }
      `}</style>

      <div
        className="rounded-2xl border p-5 shadow-2xl"
        style={{
          background: "rgba(10,10,20,0.72)",
          backdropFilter: "blur(22px) saturate(160%)",
          WebkitBackdropFilter: "blur(22px) saturate(160%)",
          borderColor: `${color}44`,
          boxShadow: `0 0 0 1px ${color}22, 0 24px 56px rgba(0,0,0,0.55)`,
        }}
      >
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            {/* Timeframe chip */}
            <span
              className="mb-1.5 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
              style={{ background: `${color}28`, color }}
            >
              {timeframe}
            </span>
            <h2 className="text-[15px] font-bold leading-tight text-white">{title}</h2>
            <p className="mt-0.5 text-[12px] text-zinc-400">{subtitle}</p>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Divider */}
        <div className="mb-3 h-px" style={{ background: `${color}30` }} />

        {/* Body text */}
        <p className="mb-4 text-[13px] leading-relaxed text-zinc-300">{text}</p>

        {/* Skill badges */}
        {skills?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {skills.map((skill) => (
              <span
                key={skill}
                className="rounded-full border px-2.5 py-1 text-[11px] font-medium"
                style={{
                  borderColor: `${color}50`,
                  background:  `${color}14`,
                  color,
                  boxShadow:   `inset 0 1px 0 ${color}18`,
                }}
              >
                {skill}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <p className="mt-4 text-[10px] text-zinc-600">
          {"Drive close to explore · ESC or ✕ to close"}
        </p>
      </div>
    </div>
  );
}
