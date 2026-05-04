"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

/**
 * Glassmorphism content card with skill tags.
 */
export default function StationCard({ station, active, onClose }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key={station.id}
          initial={{ opacity: 0, y: 16, scale: 0.88 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.92 }}
          transition={{ type: "spring", damping: 22, stiffness: 260, mass: 0.8 }}
          className="relative w-[320px] sm:w-[390px] -translate-x-1/2"
          style={{ transformOrigin: "bottom center" }}
        >
          {/* Outer glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-[2px] rounded-2xl opacity-60 blur-xl"
            style={{
              background: `radial-gradient(60% 60% at 50% 0%, ${station.color}60, transparent 70%)`,
            }}
          />

          <div
            className="relative rounded-2xl overflow-hidden border border-white/10 bg-zinc-900/60 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] text-zinc-100 ring-1 ring-white/5"
            style={{
              boxShadow: `0 0 0 1px ${station.color}30 inset, 0 20px 60px rgba(0,0,0,0.6)`,
            }}
          >
            {/* Top accent bar */}
            <div
              aria-hidden
              className="h-[2px] w-full"
              style={{
                background: `linear-gradient(90deg, transparent 0%, ${station.color} 50%, transparent 100%)`,
              }}
            />

            {/* Close button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/12 hover:text-white hover:border-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <X size={15} strokeWidth={2.4} />
            </button>

            <div className="p-5 pt-6 pr-12">
              <div
                className="text-[10px] font-medium uppercase tracking-[0.22em]"
                style={{ color: station.color }}
              >
                {station.subtitle}
              </div>
              <h3 className="mt-1.5 text-lg sm:text-[1.22rem] font-semibold leading-snug text-white">
                {station.title}
              </h3>

              <div
                className="mt-3 h-px w-10"
                style={{
                  background: `linear-gradient(90deg, ${station.color}, transparent)`,
                }}
              />

              <p className="mt-3 text-[13.5px] leading-relaxed text-zinc-300/90">
                {station.text}
              </p>

              {/* Skill tags */}
              {station.tags && station.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {station.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium"
                      style={{
                        background: `${station.color}18`,
                        color: station.color,
                        border: `1px solid ${station.color}35`,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom inner border */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-3 bottom-0 h-px opacity-35"
              style={{
                background: `linear-gradient(90deg, transparent, ${station.color}66, transparent)`,
              }}
            />
          </div>

          {/* Connector to the 3D object */}
          <div
            aria-hidden
            className="mx-auto mt-2 h-3 w-px"
            style={{
              background: `linear-gradient(180deg, ${station.color}aa, transparent)`,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
