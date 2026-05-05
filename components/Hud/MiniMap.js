"use client";

import { useEffect, useRef } from "react";
import { bikeState, MAP_META } from "@/lib/bikeStore";

const SIZE = 144;

/**
 * Compact canvas mini-map fixed in the top-right corner.
 *
 * Renders the island silhouette, every landmark marker, and a triangle
 * representing the bike (rotated by its yaw). Self-driven via rAF, so it
 * never causes React re-renders.
 */
export default function MiniMap({ activeId }) {
  const canvasRef = useRef(null);
  const activeRef = useRef(activeId);

  // Keep the rAF loop seeing the latest activeId without re-binding
  useEffect(() => {
    activeRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);

    let rafId;
    const half = SIZE / 2;
    const islandRadius = MAP_META.islandSize / 2;
    const padding = 8;
    const drawScale = (half - padding) / islandRadius; // world unit → px

    const draw = () => {
      ctx.clearRect(0, 0, SIZE, SIZE);

      // Island disc background
      ctx.beginPath();
      ctx.arc(half, half, half - 2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(28, 38, 60, 0.55)";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(120, 200, 255, 0.4)";
      ctx.stroke();

      // North marker
      ctx.fillStyle = "rgba(190, 220, 255, 0.55)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("N", half, 12);

      // Landmark dots
      const id = activeRef.current;
      MAP_META.landmarks.forEach((lm) => {
        const x = half + lm.x * drawScale;
        const y = half + lm.z * drawScale;
        const isActive = id === lm.id;

        // Pulsing glow when active
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

      // Bike marker (triangle pointing forward)
      const bx = half + bikeState.x * drawScale;
      const by = half + bikeState.z * drawScale;
      ctx.save();
      ctx.translate(bx, by);
      // Yaw 0 = facing -Z (north); rotate canvas so triangle points there
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
  }, []);

  return (
    <div
      className="pointer-events-none absolute right-5 top-5 z-30 select-none"
      aria-hidden
    >
      <div
        className="relative rounded-2xl border border-white/10 bg-zinc-900/55 p-2 shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl ring-1 ring-white/5"
        style={{ width: SIZE + 16, height: SIZE + 30 }}
      >
        <div className="mb-1 px-1 text-[9px] font-medium uppercase tracking-[0.22em] text-zinc-400">
          Map
        </div>
        <canvas
          ref={canvasRef}
          style={{ width: SIZE, height: SIZE }}
          className="rounded-xl"
        />
      </div>
    </div>
  );
}
