"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { touchInput, resetTouchInput } from "@/lib/inputStore";

/**
 * Bruno-Simon-style virtual joystick.
 *
 * Anchored bottom-left on touch viewports (md:hidden). Pull the knob in any
 * direction; the (x, y) vector is normalised to [-1, 1] and written into
 * `touchInput.joystickX/Y`. The controller in Player.js converts that vector
 * into a desired heading + throttle, so pulling the stick straight right
 * makes the bike turn right *while moving forward*, never spin in place.
 */
const BASE_PX  = 132;
const KNOB_PX  = 56;
const DEADZONE = 0.08;

export default function MobileControls() {
  const baseRef    = useRef(null);
  const activeRef  = useRef(false);
  const pointerId  = useRef(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  // Cleanup if the tab loses focus mid-drag, otherwise the bike keeps driving
  useEffect(() => {
    const cleanup = () => {
      activeRef.current = false;
      pointerId.current = null;
      resetTouchInput();
      setKnob({ x: 0, y: 0 });
    };
    window.addEventListener("blur", cleanup);
    window.addEventListener("visibilitychange", cleanup);
    return () => {
      window.removeEventListener("blur", cleanup);
      window.removeEventListener("visibilitychange", cleanup);
      resetTouchInput();
    };
  }, []);

  const updateFromPointer = useCallback((e) => {
    const base = baseRef.current;
    if (!base) return;
    const rect  = base.getBoundingClientRect();
    const cx    = rect.left + rect.width / 2;
    const cy    = rect.top  + rect.height / 2;
    let dx      = e.clientX - cx;
    let dy      = e.clientY - cy;
    const maxR  = (BASE_PX - KNOB_PX) / 2;
    const dist  = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setKnob({ x: dx, y: dy });

    // Normalise & write — invert Y so pushing UP on screen = +Y in store
    const nx = dx / maxR;
    const ny = -dy / maxR;
    const mag = Math.hypot(nx, ny);
    touchInput.joystickX = mag < DEADZONE ? 0 : nx;
    touchInput.joystickY = mag < DEADZONE ? 0 : ny;
  }, []);

  const onPointerDown = useCallback(
    (e) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      activeRef.current = true;
      pointerId.current = e.pointerId;
      touchInput.joystickActive = true;
      updateFromPointer(e);
    },
    [updateFromPointer],
  );

  const onPointerMove = useCallback(
    (e) => {
      if (!activeRef.current || e.pointerId !== pointerId.current) return;
      updateFromPointer(e);
    },
    [updateFromPointer],
  );

  const release = useCallback((e) => {
    if (e && e.pointerId !== pointerId.current) return;
    e?.currentTarget?.releasePointerCapture?.(e.pointerId);
    activeRef.current        = false;
    pointerId.current        = null;
    touchInput.joystickActive = false;
    touchInput.joystickX      = 0;
    touchInput.joystickY      = 0;
    setKnob({ x: 0, y: 0 });
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-6 left-5 z-40 md:hidden">
      <div
        ref={baseRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={(e) => activeRef.current && release(e)}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          width:  BASE_PX,
          height: BASE_PX,
          touchAction: "none",
          WebkitTapHighlightColor: "transparent",
          userSelect: "none",
        }}
        className="pointer-events-auto relative rounded-full border border-white/15 bg-zinc-900/55 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.5)] ring-1 ring-white/5"
      >
        {/* Direction guides */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-3 rounded-full border border-white/10"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-2 h-2 w-2 -translate-x-1/2 rounded-full bg-white/30"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 bottom-2 h-2 w-2 -translate-x-1/2 rounded-full bg-white/15"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2 h-2 w-2 -translate-y-1/2 rounded-full bg-white/15"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-2 h-2 w-2 -translate-y-1/2 rounded-full bg-white/15"
        />

        {/* Knob */}
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-full border border-white/30 bg-gradient-to-br from-zinc-600 to-zinc-800 shadow-lg"
          style={{
            width:  KNOB_PX,
            height: KNOB_PX,
            left:   "50%",
            top:    "50%",
            transform: `translate(${knob.x - KNOB_PX / 2}px, ${knob.y - KNOB_PX / 2}px)`,
            transition: activeRef.current ? "none" : "transform 0.18s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      </div>
    </div>
  );
}
