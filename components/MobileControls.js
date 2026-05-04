"use client";

import { useEffect, useRef } from "react";
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";

import { setTouchInput, resetTouchInput } from "@/lib/inputStore";

/**
 * On-screen D-pad pads visible only on touch / small viewports.
 * Each pad uses pointer events so multi-touch (e.g. forward + turn) works.
 *
 * The wrapping <div> is `pointer-events-none` and only the actual buttons
 * accept input, so the rest of the screen still receives canvas events.
 */
function PadButton({ inputKey, ariaLabel, children, className = "" }) {
  const downRef = useRef(false);

  const release = () => {
    if (!downRef.current) return;
    downRef.current = false;
    setTouchInput(inputKey, false);
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        downRef.current = true;
        setTouchInput(inputKey, true);
      }}
      onPointerUp={(e) => {
        e.currentTarget.releasePointerCapture?.(e.pointerId);
        release();
      }}
      onPointerCancel={release}
      onPointerLeave={release}
      style={{
        touchAction: "none",
        WebkitTapHighlightColor: "transparent",
        userSelect: "none",
      }}
      className={
        "pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-zinc-900/60 text-zinc-100 shadow-[0_10px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-transform duration-100 active:scale-95 active:bg-zinc-800/80 " +
        className
      }
    >
      {children}
    </button>
  );
}

export default function MobileControls() {
  // Safety: clear touch input on unmount or when window blurs
  useEffect(() => {
    const onBlur = () => resetTouchInput();
    window.addEventListener("blur", onBlur);
    window.addEventListener("visibilitychange", onBlur);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("visibilitychange", onBlur);
      resetTouchInput();
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 px-5 md:hidden">
      <div className="flex items-end justify-between">
        {/* Left pad — throttle (forward / backward) */}
        <div className="flex flex-col items-center gap-2">
          <PadButton inputKey="forward" ariaLabel="Vorwärts">
            <ArrowUp size={22} strokeWidth={2.4} />
          </PadButton>
          <PadButton inputKey="backward" ariaLabel="Rückwärts">
            <ArrowDown size={22} strokeWidth={2.4} />
          </PadButton>
        </div>

        {/* Right pad — steering */}
        <div className="flex items-center gap-2">
          <PadButton inputKey="left" ariaLabel="Links">
            <ArrowLeft size={22} strokeWidth={2.4} />
          </PadButton>
          <PadButton inputKey="right" ariaLabel="Rechts">
            <ArrowRight size={22} strokeWidth={2.4} />
          </PadButton>
        </div>
      </div>
    </div>
  );
}
