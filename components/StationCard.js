"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

/**
 * Glassmorphism content card. Mounted inside drei <Html>, so we wrap it in
 * AnimatePresence to get a clean enter/exit when `active` flips.
 */
export default function StationCard({ station, active, onClose }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key={station.id}
          initial={{ opacity: 0, y: 14, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.92 }}
          transition={{ type: "spring", damping: 22, stiffness: 260, mass: 0.8 }}
          className="relative w-[320px] sm:w-[380px] -translate-x-1/2"
          style={{
            // Counter the drei <Html center> baseline so the card hovers nicely.
            transformOrigin: "bottom center",
          }}
        >
          {/* Outer glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-[2px] rounded-2xl opacity-70 blur-xl"
            style={{
              background: `radial-gradient(60% 60% at 50% 0%, ${station.color}55, transparent 70%)`,
            }}
          />

          <div
            className="relative rounded-2xl overflow-hidden border border-white/10 bg-zinc-900/55 backdrop-blur-2xl shadow-[0_18px_50px_rgba(0,0,0,0.55)] text-zinc-100 ring-1 ring-white/5"
            style={{
              boxShadow: `0 0 0 1px ${station.color}33 inset, 0 18px 50px rgba(0,0,0,0.55)`,
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
              aria-label="Schließen"
              className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10 hover:text-white hover:border-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
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
              <p className="mt-3 text-[13.5px] leading-relaxed text-zinc-300/95">
                {station.text}
              </p>
            </div>

            {/* Subtle bottom inner border */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-3 bottom-0 h-px opacity-40"
              style={{
                background: `linear-gradient(90deg, transparent, ${station.color}66, transparent)`,
              }}
            />
          </div>

          {/* Pointer / connector to the 3D object */}
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
