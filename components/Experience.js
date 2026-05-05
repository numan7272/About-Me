"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { KeyboardControls } from "@react-three/drei";

import World from "./World";
import InfoCard from "./InfoCard";
import SocialDock from "./SocialDock";
import MobileControls from "./MobileControls";

const KEY_MAP = [
  { name: "forward",  keys: ["ArrowUp",   "KeyW", "KeyZ"] },
  { name: "backward", keys: ["ArrowDown",  "KeyS"] },
  { name: "left",     keys: ["ArrowLeft",  "KeyA", "KeyQ"] },
  { name: "right",    keys: ["ArrowRight", "KeyD"] },
  { name: "brake",    keys: ["Space"] },
];

export const LANDMARKS = {
  haw: {
    id: "haw",
    title: "B.Sc. Business Information Systems",
    subtitle: "HAW Kiel (2nd Semester)",
    timeframe: "Since 09/2025",
    text: "Focusing on cybersecurity, technical analysis, and practical IT security at the intersection of technology and business.",
    skills: ["Cybersecurity", "Technical Analysis", "Business Informatics"],
    color: "#22d3ee",
    accent: "#06b6d4",
  },
  designa: {
    id: "designa",
    title: "Working Student — Testing Lab & QA",
    subtitle: "DESIGNA Verkehrsleittechnik GmbH",
    timeframe: "Since 11/2025",
    text: "Analyzing server and system logs to narrow down root causes of issues in test environments. Documenting incidents, debugging, and testing hardware.",
    skills: ["Log Analysis", "Bug Tracking (Jira)", "SQL", "Hardware Testing"],
    color: "#34d399",
    accent: "#10b981",
  },
  kebab: {
    id: "kebab",
    title: "Gastronomy & IT Security",
    subtitle: "Family Business (Yek Döner & Pizzeria)",
    timeframe: "01/2022 – 03/2025",
    text: "Managed day-to-day operations and cash handling. Proactively conducted a practical security review, identifying weaknesses and improving network isolation, Wi-Fi security, and port filtering.",
    skills: ["Network Isolation", "Vulnerability Awareness", "Operations"],
    color: "#fb923c",
    accent: "#ef4444",
  },
  highschool: {
    id: "highschool",
    title: "Abitur (Higher Education Entrance)",
    subtitle: "Thor Heyerdahl Gymnasium, Kiel",
    timeframe: "Graduated 07/2025",
    text: "Completed general higher education entrance qualification, building the foundation for analytical thinking and my transition into computer science.",
    skills: ["Analytical Thinking", "General Education"],
    color: "#a78bfa",
    accent: "#7c3aed",
  },
  // FIX #1: Correct homebase data (was placeholder text)
  homebase: {
    id: "homebase",
    title: "Cybersecurity & Development HQ",
    subtitle: "Independent Projects & Certifications",
    timeframe: "Ongoing",
    text: "Building full-stack applications like scheduling assistants and threat intelligence dashboards. Currently completing the Google Cybersecurity Professional Certificate and documenting my learning track on GitHub.",
    skills: ["Python & FastAPI", "React / Next.js", "Docker", "Kali Linux", "OSINT"],
    color: "#f472b6",
    accent: "#ec4899",
  },
};

// FIX #9: fov 50 for better overview of the 130-unit island
const INITIAL_CAMERA = { fov: 50, position: [14, 18, 14], near: 0.5, far: 300 };

export default function Experience() {
  const [activeId, setActiveId] = useState(null);
  const followModeRef = useRef(true);
  const orbitRef      = useRef(null);

  const handleEnter     = useCallback((id) => setActiveId(id), []);
  const handleExit      = useCallback(
    (id) => setActiveId((cur) => (cur === id ? null : cur)),
    [],
  );
  const handleClickOpen = useCallback((id) => setActiveId(id), []);
  const handleClose     = useCallback(() => setActiveId(null), []);

  const activeCard = useMemo(
    () => (activeId ? LANDMARKS[activeId] : null),
    [activeId],
  );

  return (
    <main className="relative h-[100dvh] w-screen overflow-hidden bg-black select-none">

      {/* Hint bar */}
      <div className="pointer-events-none absolute left-1/2 top-5 z-30 -translate-x-1/2 text-center">
        <div className="text-[10px] uppercase tracking-[0.32em] text-zinc-400/80">
          Numan&apos;s Roadmap
        </div>
        <div className="mt-1 text-[12px] text-zinc-300/80">
          <span className="hidden md:inline">
            Drive with{" "}
            <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px]">W A S D</kbd>
            {" / "}
            <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px]">↑ ← ↓ →</kbd>
            {" — or click any building"}
          </span>
          <span className="md:hidden">Tap the pads to drive — or tap a building</span>
        </div>
      </div>

      {/* Zentrieren button */}
      <button
        className="pointer-events-auto absolute bottom-8 left-1/2 z-30 -translate-x-1/2 rounded-full border border-white/15 bg-black/40 px-5 py-2 text-[12px] text-white/80 backdrop-blur-md transition hover:bg-white/10 hover:text-white"
        onClick={() => { followModeRef.current = true; }}
      >
        Zentrieren
      </button>

      <KeyboardControls map={KEY_MAP}>
        <Canvas
          shadows
          dpr={[1, 2]}
          gl={{ antialias: true, powerPreference: "high-performance", stencil: false }}
          camera={INITIAL_CAMERA}
          className="absolute inset-0"
        >
          <World
            onEnter={handleEnter}
            onExit={handleExit}
            onClickOpen={handleClickOpen}
            followModeRef={followModeRef}
            orbitRef={orbitRef}
          />
        </Canvas>
      </KeyboardControls>

      <InfoCard card={activeCard} onClose={handleClose} />
      <MobileControls />
      <SocialDock />
    </main>
  );
}
