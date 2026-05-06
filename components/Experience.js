"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { KeyboardControls } from "@react-three/drei";
import * as THREE from "three";

import World from "./World";
import InfoCard from "./InfoCard";
import SocialDock from "./SocialDock";
import MiniMap from "./Hud/MiniMap";
import SpeedHud from "./Hud/SpeedHud";
import StartScreen from "./StartScreen";
import DiscoveryHud from "./DiscoveryHud";
import PhotoMode from "./PhotoMode";
import AudioManager, { playClick } from "./AudioManager";
import useDiscoveries from "@/lib/useDiscoveries";

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
  homebase: {
    id: "homebase",
    title: "Home — Personal Workshop",
    subtitle: "Self-taught & project-driven",
    timeframe: "Ongoing",
    text: "Where I learn by doing. Side projects, prototypes and tools that scratch my own itch — full-stack apps, automation scripts, networking experiments. The fastest way to learn something is to break it on purpose, fix it, and ship the next one.",
    skills: ["Python & FastAPI", "React / Next.js", "Docker", "Linux", "Self-Taught"],
    color: "#f472b6",
    accent: "#ec4899",
  },
};

// Hidden discoveries scattered across the map — clickable little props
// with their own story cards. They share the InfoCard schema so the
// existing overlay system handles them with no changes.
export const EASTER_EGGS = {
  raspberrypi: {
    id: "raspberrypi",
    title: "Hardware Hacking & OSINT",
    subtitle: "Easter Egg · Raspberry Pi Zero",
    timeframe: "Hidden",
    text: "A Raspberry Pi Zero? The perfect tool for invisible network setups and custom security gadgets. I love going beyond writing code — modifying hardware and configuring systems like Kali Linux from the ground up for specific use cases. Real cybersecurity understanding doesn't stop at code; it starts at the hardware.",
    skills: ["Kali Linux", "Hardware Modding", "OSINT"],
    color: "#a3e635",
    accent: "#65a30d",
  },
  router: {
    id: "router",
    title: "The Gastro Pentest",
    subtitle: "Easter Egg · Compromised Router",
    timeframe: "Hidden",
    text: "Three years in the family business meant more than just running the till and serving customers. I used the shop as my first security lab and ran a hands-on review of the network. Result: open ports and unsecured camera systems. I isolated the network, implemented port filtering, and hardened the passwords. Real-world security problem-solving.",
    skills: ["Network Audit", "Port Filtering", "Wi-Fi Hardening"],
    color: "#fb923c",
    accent: "#ea580c",
  },
  container: {
    id: "container",
    title: "Self-Hosted Architectures",
    subtitle: "Easter Egg · Shipping Container",
    timeframe: "Hidden",
    text: "Why rely on someone else's cloud when you can build the architecture yourself? With \"Funke\" I built a complete real-time communication platform (WebRTC, Node.js, Socket.IO). With \"Synapser\" a backend using FastAPI and Google OR-Tools. Everything containerised in Docker and self-hosted. I want full control over my own infrastructure.",
    skills: ["Docker", "WebRTC", "FastAPI", "Self-Hosted"],
    color: "#22d3ee",
    accent: "#0891b2",
  },
  weight: {
    id: "weight",
    title: "Resistance & Growth",
    subtitle: "Easter Egg · 20 kg Plate",
    timeframe: "Hidden",
    text: "Gym membership since late 2019, actively grinding since January 2022. At 183 cm and 109 kg it isn't just about raw strength — it's the counterweight to hours sitting in front of code. Strength training teaches a simple truth that also applies in IT: without consistent resistance there is no growth. Not in muscle, and not in solving complex backend bugs.",
    skills: ["Strength Training", "Discipline", "Mind-Body Balance"],
    color: "#f472b6",
    accent: "#ec4899",
  },
};

// FIX #9: fov 50 for better overview of the 130-unit island
const INITIAL_CAMERA = { fov: 50, position: [14, 18, 14], near: 0.5, far: 300 };

export default function Experience() {
  const [activeId,    setActiveId]    = useState(null);
  const [photoMode,   setPhotoMode]   = useState(false);
  const followModeRef = useRef(true);
  const orbitRef      = useRef(null);

  const discoveries = useDiscoveries();

  const handleEnter     = useCallback((id) => setActiveId(id), []);
  const handleExit      = useCallback(
    (id) => setActiveId((cur) => (cur === id ? null : cur)),
    [],
  );
  // Opening any card plays a UI click. Easter-egg ids also mark the
  // discovery so the tracker badge ticks up + the toast fires.
  const handleClickOpen = useCallback((id) => {
    setActiveId(id);
    playClick();
    if (id in EASTER_EGGS) discoveries.markDiscovered(id);
  }, [discoveries]);
  const handleClose     = useCallback(() => setActiveId(null), []);

  const enterPhoto = useCallback(() => {
    setPhotoMode(true);
    setActiveId(null);          // close any open card so the screenshot is clean
  }, []);
  const exitPhoto  = useCallback(() => setPhotoMode(false), []);

  const activeCard = useMemo(
    () => (activeId ? (LANDMARKS[activeId] ?? EASTER_EGGS[activeId] ?? null) : null),
    [activeId],
  );

  // Photo mode hides every UI overlay so the screenshot only contains the
  // 3D world. We just toggle a className on a wrapper around the HUDs.
  const hudVisibility = photoMode ? "opacity-0 pointer-events-none" : "opacity-100";

  return (
    <main className="relative h-[100dvh] w-screen overflow-hidden bg-black select-none">

      <KeyboardControls map={KEY_MAP}>
        <Canvas
          shadows
          dpr={[1, 2]}
          gl={{
            antialias: true,
            powerPreference: "high-performance",
            stencil: false,
            // preserveDrawingBuffer is required for canvas.toDataURL() to
            // return the current frame instead of an empty image — Photo
            // mode relies on this when grabbing screenshots.
            preserveDrawingBuffer: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.05,
            outputColorSpace: THREE.SRGBColorSpace,
          }}
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

      {/* All HUD overlays go inside this wrapper so photo mode can hide
          them in one shot via the opacity class. The Canvas above sits
          behind so the screenshot never picks up any UI chrome. */}
      <div className={`absolute inset-0 transition-opacity duration-300 ${hudVisibility}`}>
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
            <span className="md:hidden">Drag the dial next to the bike — or tap a building</span>
          </div>
        </div>

        {/* Recenter button */}
        <button
          className="pointer-events-auto absolute left-1/2 z-30 -translate-x-1/2 rounded-full border border-white/15 bg-black/40 px-5 py-2 text-[12px] text-white/80 backdrop-blur-md transition hover:bg-white/10 hover:text-white
                     bottom-20 md:bottom-20"
          onClick={() => { followModeRef.current = true; }}
        >
          Recenter
        </button>

        <MiniMap activeId={activeId} />
        <SpeedHud />

        {/* Discovery tracker badge + unlock toast */}
        <DiscoveryHud
          count={discoveries.count}
          total={discoveries.total}
          allFound={discoveries.allFound}
          justUnlocked={discoveries.justUnlocked}
          onToastDone={discoveries.clearJustUnlocked}
        />

        <InfoCard card={activeCard} onClose={handleClose} />
        <SocialDock />

        {/* Audio mute button — also bootstraps the audio system */}
        <AudioManager />
      </div>

      {/* Photo mode lives outside the HUD wrapper so its own button +
          screenshot pill stay visible while the HUDs are hidden. */}
      <PhotoMode enabled={photoMode} onEnter={enterPhoto} onExit={exitPhoto} />

      {/* Click-to-start overlay — fades out on the first user
          interaction. Stays outside the HUD wrapper so it can't be
          accidentally hidden by photo mode. */}
      <StartScreen />
    </main>
  );
}
