"use client";

import { useCallback, useEffect } from "react";
import { Camera, Download, X } from "lucide-react";

/**
 * Photo-mode controller.
 *
 * Press `P` (or click the camera button) to enter photo mode:
 *   - All HUDs fade out (parent toggles their visibility from the
 *     `enabled` state we expose via the `usePhotoMode` hook below).
 *   - A small "Take Screenshot / Exit" pill appears at the bottom.
 *   - Clicking "Take Screenshot" grabs the current Canvas frame as a
 *     PNG and triggers a browser download.
 *
 * The screenshot is captured straight from the WebGL `<canvas>` DOM
 * element via toDataURL — that's the same frame the player sees, with
 * post-processing baked in.
 */

export default function PhotoMode({ enabled, onEnter, onExit }) {
  // Global keybinds: P toggles, Esc exits when in photo mode.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "KeyP") {
        e.preventDefault();
        if (enabled) onExit?.();
        else        onEnter?.();
      } else if (e.code === "Escape" && enabled) {
        e.preventDefault();
        onExit?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, onEnter, onExit]);

  const takeScreenshot = useCallback(() => {
    const canvas = document.querySelector("main canvas");
    if (!canvas) return;
    // requestAnimationFrame ensures the next frame is rendered after we
    // (potentially) hid HUD overlays that paint over the Canvas. R3F
    // uses preserveDrawingBuffer:false by default, so we need to grab
    // inside an rAF before the buffer is swapped.
    const grab = () => {
      try {
        const url = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = url;
        a.download = `roadmap-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (err) {
        console.warn("[photo-mode] toDataURL failed:", err);
      }
    };
    // Two rAFs: first to clear pending React state into a paint, second
    // to capture the resulting frame.
    requestAnimationFrame(() => requestAnimationFrame(grab));
  }, []);

  // Toggle button — visible always, its label flips when photo mode is
  // active. Sits on the right side under the mini-map.
  return (
    <>
      <button
        type="button"
        aria-label={enabled ? "Exit photo mode" : "Enter photo mode (P)"}
        title={enabled ? "Exit photo mode" : "Photo mode (P)"}
        onClick={() => (enabled ? onExit?.() : onEnter?.())}
        className="pointer-events-auto absolute right-4 bottom-[14rem] z-30 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-zinc-900/55 text-zinc-200 shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur-xl ring-1 ring-white/5 transition hover:bg-white/10 hover:text-white"
      >
        {enabled ? <X size={16} strokeWidth={2.2} /> : <Camera size={16} strokeWidth={2.2} />}
      </button>

      {/* Bottom pill — only visible while photo mode is active */}
      {enabled && (
        <div
          className="pointer-events-none absolute left-1/2 z-40 -translate-x-1/2 select-none
                     bottom-32 md:bottom-32"
          style={{ animation: "pmFadeIn 0.32s cubic-bezier(0.16,1,0.3,1) both" }}
        >
          <style>{`
            @keyframes pmFadeIn {
              from { opacity: 0; transform: translate(-50%, 6px); }
              to   { opacity: 1; transform: translate(-50%, 0); }
            }
          `}</style>
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-white/15 bg-black/55 px-4 py-2 text-[12px] text-zinc-100 backdrop-blur-md">
            <button
              type="button"
              onClick={takeScreenshot}
              className="flex items-center gap-2 rounded-full bg-emerald-500/85 px-3 py-1 text-[12px] font-medium text-emerald-950 transition hover:bg-emerald-400"
            >
              <Download size={14} strokeWidth={2.4} />
              <span>Take screenshot</span>
            </button>
            <span className="hidden text-[11px] uppercase tracking-[0.22em] text-zinc-400 md:inline">
              Photo mode · press P to exit
            </span>
          </div>
        </div>
      )}
    </>
  );
}
