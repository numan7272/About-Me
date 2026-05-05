"use client";

import { useEffect, useRef, useState } from "react";
import { Map as MapIcon, X } from "lucide-react";
import { bikeState, MAP_META, teleportRequest } from "@/lib/bikeStore";

const SIZE = 144;
const PADDING = 8;
const DRAW_SCALE = (SIZE / 2 - PADDING) / (MAP_META.islandSize / 2);

// Friendly labels for the quick-travel hover tip / aria-label
const LM_LABEL = {
  homebase:   "Home (HQ)",
  haw:        "HAW Kiel",
  designa:    "Designa",
  kebab:      "Yek Döner",
  highschool: "Thor Heyerdahl Gymnasium",
};

/**
 * Compact canvas mini-map fixed in the top-right corner.
 *
 * Closed by default on mobile (< md breakpoint) — surface a small icon
 * button instead. On desktop opens by default. The canvas redraw loop
 * pauses while collapsed so it doesn't waste a per-frame allocation.
 */
export default function MiniMap({ activeId }) {
  const canvasRef = useRef(null);
  const activeRef = useRef(activeId);
  const [isOpen, setIsOpen]   = useState(true);

  // Default state per breakpoint, set after mount to avoid SSR mismatch
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOpen(window.matchMedia("(min-width: 768px)").matches);
  }, []);

  // Keep the rAF loop seeing the latest activeId without re-binding
  useEffect(() => {
    activeRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);

    let rafId;
    const half = SIZE / 2;
    const drawScale = DRAW_SCALE;

    const draw = () => {
      ctx.clearRect(0, 0, SIZE, SIZE);

      ctx.beginPath();
      ctx.arc(half, half, half - 2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(28, 38, 60, 0.55)";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(120, 200, 255, 0.4)";
      ctx.stroke();

      ctx.fillStyle = "rgba(190, 220, 255, 0.55)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("N", half, 12);

      const id = activeRef.current;
      MAP_META.landmarks.forEach((lm) => {
        const x = half + lm.x * drawScale;
        const y = half + lm.z * drawScale;
        const isActive = id === lm.id;

        if (isActive) {
          const t = (performance.now() / 600) % (Math.PI * 2);
          const r = 8 + Math.sin(t) * 2.5;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = lm.color + "44";
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(x, y, isActive ? 4.2 : 3, 0, Math.PI * 2);
        ctx.fillStyle = lm.color;
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      const bx = half + bikeState.x * drawScale;
      const by = half + bikeState.z * drawScale;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(bikeState.yaw);
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 5);
      ctx.lineTo(-5, 5);
      ctx.closePath();
      ctx.fillStyle = "#fde68a";
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();

      rafId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafId);
  }, [isOpen]);

  // ── Closed: small toggle button ─────────────────────────────────────────
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Karte öffnen"
        className="pointer-events-auto absolute right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-zinc-900/55 text-zinc-200 shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur-xl ring-1 ring-white/5 transition hover:bg-white/10 hover:text-white"
      >
        <MapIcon size={16} strokeWidth={2.2} />
      </button>
    );
  }

  // ── Open: full mini-map (with quick-travel buttons over each dot) ───────
  return (
    <div className="pointer-events-auto absolute right-4 top-4 z-30 select-none">
      <div
        className="relative rounded-2xl border border-white/10 bg-zinc-900/55 p-2 shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl ring-1 ring-white/5"
        style={{ width: SIZE + 16, height: SIZE + 50 }}
      >
        <div className="flex items-center justify-between px-1 pb-1">
          <span className="text-[9px] font-medium uppercase tracking-[0.22em] text-zinc-400">
            Travel
          </span>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Karte schließen"
            className="pointer-events-auto -mr-0.5 flex h-5 w-5 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            <X size={11} strokeWidth={2.4} />
          </button>
        </div>

        {/* Canvas + click overlays. The wrapper is `relative` and sized to
            the canvas so absolute-positioned buttons line up with dots. */}
        <div className="relative" style={{ width: SIZE, height: SIZE }}>
          <canvas
            ref={canvasRef}
            style={{ width: SIZE, height: SIZE }}
            className="rounded-xl"
            aria-hidden
          />

          {MAP_META.landmarks.map((lm) => {
            const lx = SIZE / 2 + lm.x * DRAW_SCALE;
            const ly = SIZE / 2 + lm.z * DRAW_SCALE;
            const HIT = 24;
            return (
              <button
                key={lm.id}
                type="button"
                onClick={() => teleportRequest(lm.id)}
                aria-label={`Schnellreise zu ${LM_LABEL[lm.id] ?? lm.id}`}
                title={LM_LABEL[lm.id] ?? lm.id}
                className="group absolute rounded-full transition hover:scale-110"
                style={{
                  left: lx - HIT / 2,
                  top:  ly - HIT / 2,
                  width:  HIT,
                  height: HIT,
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                {/* Soft ring on hover for affordance */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition group-hover:opacity-100"
                  style={{
                    boxShadow: `0 0 0 2px ${lm.color}aa, 0 0 14px ${lm.color}99`,
                  }}
                />
              </button>
            );
          })}
        </div>

        <p className="mt-1 px-1 text-[8.5px] uppercase tracking-[0.2em] text-zinc-500">
          Klicke ein Symbol
        </p>
      </div>
    </div>
  );
}
