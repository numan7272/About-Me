"use client";

import { useState, useMemo, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { KeyboardControls } from "@react-three/drei";

import World from "./World";
import InfoCard from "./InfoCard";
import SocialDock from "./SocialDock";
import MobileControls from "./MobileControls";

const KEY_MAP = [
  { name: "forward", keys: ["ArrowUp", "KeyW", "KeyZ"] },
  { name: "backward", keys: ["ArrowDown", "KeyS"] },
  { name: "left", keys: ["ArrowLeft", "KeyA", "KeyQ"] },
  { name: "right", keys: ["ArrowRight", "KeyD"] },
  { name: "brake", keys: ["Space"] },
];

export const LANDMARKS = {
  haw: {
    id: "haw",
    title: "HAW Kiel",
    subtitle: "Wirtschaftsinformatik & Mindset",
    text: "Wer viel weiß, versteht, dass er nicht alles wissen kann.",
    color: "#22d3ee",
    accent: "#06b6d4",
  },
  designa: {
    id: "designa",
    title: "Designa Verkehrsleittechnik",
    subtitle: "Qualitätssicherung & Bug-Hunting",
    text: "Stressgetesteter Code.",
    color: "#34d399",
    accent: "#10b981",
  },
  kebab: {
    id: "kebab",
    title: "Der Dönerladen der Familie",
    subtitle: "Gastro-Wurzeln & MVPs",
    text: "Vom Zettel-Chaos zu schnellen digitalen Lösungen.",
    color: "#fb923c",
    accent: "#ef4444",
  },
};

export default function Experience() {
  const [activeId, setActiveId] = useState(null);

  const handleEnter = useCallback((id) => setActiveId(id), []);
  const handleExit = useCallback((id) => {
    // Only clear if the leaving sensor is the one currently shown — guards
    // against fast back-to-back enter/exit fired while overlapping multiple
    // sensors during a tight turn.
    setActiveId((cur) => (cur === id ? null : cur));
  }, []);

  const activeCard = useMemo(
    () => (activeId ? LANDMARKS[activeId] : null),
    [activeId],
  );

  return (
    <main className="relative h-[100dvh] w-screen overflow-hidden bg-black select-none">
      {/* Top hint */}
      <div className="pointer-events-none absolute left-1/2 top-5 z-30 -translate-x-1/2 text-center">
        <div className="text-[10px] uppercase tracking-[0.32em] text-zinc-400/80">
          Numan&apos;s Roadmap
        </div>
        <div className="mt-1 text-[12px] text-zinc-300/80">
          <span className="hidden md:inline">
            Drive with{" "}
            <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px]">
              W A S D
            </kbd>{" "}
            /{" "}
            <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px]">
              ↑ ← ↓ →
            </kbd>
          </span>
          <span className="md:hidden">Tippe die Pads, um zu fahren</span>
          {" — "}
          <span className="text-zinc-400/70">
            besuche jeden Landmark, um mehr zu erfahren
          </span>
        </div>
      </div>

      <KeyboardControls map={KEY_MAP}>
        <Canvas
          shadows
          dpr={[1, 2]}
          gl={{
            antialias: true,
            powerPreference: "high-performance",
            stencil: false,
          }}
          className="absolute inset-0"
        >
          <World onEnter={handleEnter} onExit={handleExit} />
        </Canvas>
      </KeyboardControls>

      <InfoCard card={activeCard} />
      <MobileControls />
      <SocialDock />
    </main>
  );
}
