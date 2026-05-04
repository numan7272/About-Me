"use client";

import { motion, AnimatePresence } from "framer-motion";
import { MapPin } from "lucide-react";

/**
 * Fixed UI card that slides in from above when the bike enters a sensor.
 * Skills are rendered as glassmorphism badges.
 * Factual English content, sleek cybersecurity-focused palette.
 */
export default function InfoCard({ card }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-40 flex justify-center px-4">
      <AnimatePresence mode="wait">
        {card && (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: -28, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            transition={{
              type: "spring",
              damping: 22,
              stiffness: 240,
              mass: 0.8,
            }}
            className="pointer-events-auto relative w-full max-w-md"
            style={{ transformOrigin: "top center" }}
          >
            {/* Outer ambient glow */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-3 rounded-3xl opacity-60 blur-2xl"
              style={{
                background: `radial-gradient(60% 60% at 50% 0%, ${card.color}44, transparent 70%)`,
              }}
            />

            <div
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60 px-5 py-4 text-zinc-100 backdrop-blur-2xl"
              style={{
                boxShadow: `inset 0 0 0 1px ${card.color}28, 0 20px 60px rgba(0,0,0,0.55)`,
              }}
            >
              {/* Top accent bar */}
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-[2px]"
                style={{
                  background: `linear-gradient(90deg, transparent, ${card.color}, transparent)`,
                }}
              />

              {/* Header row */}
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-white/10 bg-white/5"
                  style={{ boxShadow: `0 0 18px ${card.color}44` }}
                >
                  <MapPin size={16} style={{ color: card.color }} />
                </div>

                <div className="min-w-0 flex-1">
                  {/* Timeframe chip */}
                  {card.timeframe && (
                    <span
                      className="mb-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest"
                      style={{
                        background: `${card.color}22`,
                        color: card.color,
                        border: `1px solid ${card.color}44`,
                      }}
                    >
                      {card.timeframe}
                    </span>
                  )}

                  <div
                    className="text-[10px] font-semibold uppercase tracking-[0.22em]"
                    style={{ color: card.color }}
                  >
                    {card.subtitle}
                  </div>

                  <h2 className="mt-0.5 truncate text-base font-semibold text-white sm:text-lg">
                    {card.title}
                  </h2>

                  <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-300/90 sm:text-sm">
                    {card.text}
                  </p>
                </div>
              </div>

              {/* Skill badges — glassmorphism */}
              {card.skills && card.skills.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {card.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-medium backdrop-blur-sm"
                      style={{
                        background: `${card.color}18`,
                        color: card.color,
                        border: `1px solid ${card.color}35`,
                        boxShadow: `inset 0 1px 0 ${card.color}20`,
                      }}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-zinc-400/80">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor: card.color,
                      boxShadow: `0 0 8px ${card.color}`,
                    }}
                  />
                  In Range
                </span>
                <span className="text-zinc-500">Drive away to close</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
