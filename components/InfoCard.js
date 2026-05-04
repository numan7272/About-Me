"use client";

import { motion, AnimatePresence } from "framer-motion";
import { MapPin } from "lucide-react";

/**
 * Fixed UI card that slides in from above when the bike enters a sensor.
 * Renders nothing when `card` is null. Animated with framer-motion.
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
            {/* Outer glow */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-3 rounded-3xl opacity-70 blur-2xl"
              style={{
                background: `radial-gradient(60% 60% at 50% 0%, ${card.color}55, transparent 70%)`,
              }}
            />

            <div
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/55 px-5 py-4 text-zinc-100 shadow-[0_18px_50px_rgba(0,0,0,0.55)] ring-1 ring-white/5 backdrop-blur-2xl"
              style={{
                boxShadow: `inset 0 0 0 1px ${card.color}33, 0 18px 50px rgba(0,0,0,0.55)`,
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

              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-white/10 bg-white/5"
                  style={{
                    boxShadow: `0 0 18px ${card.color}55`,
                  }}
                >
                  <MapPin size={16} style={{ color: card.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className="text-[10px] font-semibold uppercase tracking-[0.22em]"
                    style={{ color: card.color }}
                  >
                    {card.subtitle}
                  </div>
                  <h2 className="mt-1 truncate text-base font-semibold text-white sm:text-lg">
                    {card.title}
                  </h2>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-300/95 sm:text-sm">
                    {card.text}
                  </p>
                </div>
              </div>

              {/* Bottom hint */}
              <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-zinc-400/80">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor: card.color,
                      boxShadow: `0 0 8px ${card.color}`,
                    }}
                  />
                  In Reichweite
                </span>
                <span className="text-zinc-500">
                  Fahre weg, um zu schließen
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
