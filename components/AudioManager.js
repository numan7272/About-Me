"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { bikeState } from "@/lib/bikeStore";

/**
 * Three-track audio layer for the portfolio.
 *
 * Tracks (drop these files into /public/ at the project root — Next.js
 * serves /public/foo.mp3 at the URL /foo.mp3):
 *   - /ambient.mp3 → looped meadow wind / distant birds (very low volume)
 *   - /wheels.mp3  → looped tire-on-asphalt loop, volume scaled by speed
 *   - /click.mp3   → one-shot UI click; played on the `ui:click` window
 *                    event so any component can trigger it without prop-
 *                    drilling.
 *
 * Missing files don't crash anything — load errors are caught and
 * logged, and the affected track is just disabled.
 *
 * Browsers block autoplay until a user gesture, so we defer the first
 * `play()` until the player taps/clicks/keys (the StartScreen click
 * counts). The mute toggle is persisted in localStorage.
 */

const STORAGE_KEY = "numan-roadmap.muted.v1";

function readMuted() {
  if (typeof window === "undefined") return false;
  try { return window.localStorage.getItem(STORAGE_KEY) === "1"; }
  catch { return false; }
}
function writeMuted(v) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORAGE_KEY, v ? "1" : "0"); }
  catch { /* noop */ }
}

/** Public helper for components that want to trigger a UI click sfx
 *  without subscribing to refs. Dispatches a window event the manager
 *  listens for. */
export function playClick() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("ui:click"));
}

export default function AudioManager() {
  const [muted, setMuted]     = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // One Audio element per track. Refs survive re-renders.
  const ambientRef = useRef(null);
  const wheelsRef  = useRef(null);
  const clickRef   = useRef(null);
  const startedRef = useRef(false);

  // Hydrate the muted flag from localStorage after mount (avoids SSR
  // mismatch).
  useEffect(() => {
    setMuted(readMuted());
    setHydrated(true);
  }, []);

  // Build the Audio elements once. If a file 404s the load error fires
  // on the element and we just skip that track.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const make = (src, { loop = false, volume = 1 } = {}) => {
      try {
        const a = new Audio(src);
        a.loop      = loop;
        a.volume    = volume;
        a.preload   = "auto";
        a.crossOrigin = "anonymous";
        a.addEventListener("error", () => {
          console.warn(`[audio] failed to load ${src}`);
        });
        return a;
      } catch (e) {
        console.warn(`[audio] could not create Audio for ${src}:`, e);
        return null;
      }
    };

    ambientRef.current = make("/ambient.mp3", { loop: true,  volume: 0.22 });
    wheelsRef.current  = make("/wheels.mp3",  { loop: true,  volume: 0.0  });
    clickRef.current   = make("/click.mp3",   { loop: false, volume: 0.55 });

    return () => {
      [ambientRef, wheelsRef, clickRef].forEach((r) => {
        if (r.current) {
          try { r.current.pause(); } catch { /* noop */ }
          r.current.src = "";
          r.current = null;
        }
      });
    };
  }, []);

  // Apply mute changes whenever the muted flag flips.
  useEffect(() => {
    [ambientRef, wheelsRef].forEach((r) => {
      if (r.current) r.current.muted = muted;
    });
    if (clickRef.current) clickRef.current.muted = muted;
  }, [muted]);

  // Start the loops on the first user interaction. Browsers block
  // play() before that, so this guarantees a clean first-play.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const start = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      const tryPlay = (a) => a?.play()?.catch(() => { /* still blocked, drop silently */ });
      tryPlay(ambientRef.current);
      tryPlay(wheelsRef.current);
    };
    window.addEventListener("pointerdown", start, { once: true });
    window.addEventListener("keydown",     start, { once: true });
    window.addEventListener("touchstart",  start, { once: true });
    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown",     start);
      window.removeEventListener("touchstart",  start);
    };
  }, []);

  // UI click — listen for the global `ui:click` event and play the
  // one-shot. Reset currentTime so rapid clicks all fire. We also clamp
  // the playback to 700 ms via a setTimeout: if the user accidentally
  // dropped a long file in /click.mp3, this stops it from ringing out
  // forever. A real ~50 ms click finishes well before the timeout.
  useEffect(() => {
    let stopTimer = null;
    const onClick = () => {
      const a = clickRef.current;
      if (!a) return;
      if (stopTimer) {
        window.clearTimeout(stopTimer);
        stopTimer = null;
      }
      try {
        a.currentTime = 0;
        a.play().catch(() => { /* blocked, ignore */ });
      } catch { /* noop */ }
      stopTimer = window.setTimeout(() => {
        try { a.pause(); a.currentTime = 0; } catch { /* noop */ }
        stopTimer = null;
      }, 700);
    };
    window.addEventListener("ui:click", onClick);
    return () => {
      window.removeEventListener("ui:click", onClick);
      if (stopTimer) window.clearTimeout(stopTimer);
    };
  }, []);

  // Wheel volume modulation — drive the looping track from bikeState.speed.
  // We poll instead of subscribing because bikeState is mutated in
  // useFrame on every physics tick (no React-side updates).
  useEffect(() => {
    let raf;
    const tick = () => {
      const a = wheelsRef.current;
      if (a) {
        // Mute → 0 immediately; otherwise scale 0..0.45 over 0..maxSpeed.
        const target = muted
          ? 0
          : Math.min(0.45, (bikeState.speed ?? 0) / (bikeState.maxSpeed || 7.5) * 0.45);
        // Smooth toward target so volume doesn't pop on stop/start.
        a.volume = a.volume + (target - a.volume) * 0.12;
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [muted]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      writeMuted(next);
      return next;
    });
  }, []);

  if (!hydrated) return null;

  return (
    <button
      type="button"
      onClick={toggleMute}
      aria-label={muted ? "Unmute" : "Mute"}
      title={muted ? "Unmute" : "Mute"}
      className="pointer-events-auto absolute right-4 bottom-[10rem] z-30 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-zinc-900/55 text-zinc-200 shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur-xl ring-1 ring-white/5 transition hover:bg-white/10 hover:text-white"
    >
      {muted ? <VolumeX size={16} strokeWidth={2.2} /> : <Volume2 size={16} strokeWidth={2.2} />}
    </button>
  );
}
