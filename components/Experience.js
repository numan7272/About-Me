"use client";

import { Canvas, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  OrthographicCamera,
  ContactShadows,
  SoftShadows,
} from "@react-three/drei";
import { Suspense, useEffect, useRef, useState } from "react";

import Platform from "./Platform";
import Waypoint from "./Waypoint";
import Avatar from "./Avatar";
import SocialDock from "./SocialDock";

const STATIONS = [
  {
    id: "foundation",
    position: [-3.2, 0, -1.6],
    color: "#22d3ee",
    accent: "#06b6d4",
    shape: "academic",
    title: "Wirtschaftsinformatik & Mindset",
    subtitle: "HAW Kiel",
    text: "Fasziniert von Cutting-Edge Tech, Biologie und Physik. Meine Philosophie: Wer viel weiß, versteht, dass er nicht alles wissen kann.",
  },
  {
    id: "origin",
    position: [0, 0, 2.4],
    color: "#fb923c",
    accent: "#ef4444",
    shape: "warm",
    title: "Gastro-Wurzeln & MVPs",
    subtitle: "Der Dönerladen der Familie",
    text: "Während der Abi-Zeit jahrelang im Dönerladen meines Vaters gearbeitet. Ich kenne das Zettel-Chaos und den puren Stress hinter der Theke. Genau dieser Schmerz treibt mich heute an, extrem schnelle, digitale POS-Lösungen für lokale Betriebe zu bauen.",
  },
  {
    id: "lab",
    position: [3.0, 0, -1.8],
    color: "#34d399",
    accent: "#10b981",
    shape: "tech",
    title: "Qualitätssicherung & Bug-Hunting",
    subtitle: "Designa Verkehrsleittechnik",
    text: "Werkstudent im Testing Lab. Ich protokolliere das Verhalten neuer Software und Firmware, suche Edge-Cases und breche Systeme, damit sie sicherer werden. Mein Code sieht nicht nur gut aus – er ist stressgetestet.",
  },
];

function ResponsiveOrthoCamera() {
  const cameraRef = useRef();
  const { size } = useThree();

  useEffect(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    // Fit ~12 world units along the smaller axis -> always shows the whole map.
    const target = Math.min(size.width, size.height) / 12;
    cam.zoom = target;
    cam.updateProjectionMatrix();
  }, [size.width, size.height]);

  return (
    <OrthographicCamera
      ref={cameraRef}
      makeDefault
      position={[10, 10, 10]}
      zoom={70}
      near={0.1}
      far={200}
    />
  );
}

export default function Experience() {
  const [activeId, setActiveId] = useState(null);

  // Close any open card on Escape, for keyboard accessibility.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setActiveId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[radial-gradient(ellipse_at_center,_#0b1020_0%,_#05060a_60%,_#000_100%)]">
      {/* Subtle ambient grid backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(148,163,184,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.6)_1px,transparent_1px)] [background-size:48px_48px]"
      />

      {/* Hint label — top left */}
      <div className="pointer-events-none absolute left-5 top-5 z-40 select-none">
        <div className="text-[10px] uppercase tracking-[0.32em] text-zinc-400/80">
          Numan&apos;s Roadmap
        </div>
        <div className="mt-1 text-sm text-zinc-300/80">
          Klicken &middot; Schwenken &middot; Zoomen
        </div>
      </div>

      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        className="absolute inset-0"
      >
        <color attach="background" args={["#06080d"]} />
        <fog attach="fog" args={["#06080d", 22, 55]} />

        <Suspense fallback={null}>
          <ResponsiveOrthoCamera />
          <SoftShadows size={28} samples={12} focus={0.6} />

          {/* Lighting — afternoon sunlight + cool fill */}
          <ambientLight intensity={0.45} color="#a3b8ff" />
          <hemisphereLight
            args={["#cfe3ff", "#1a1326", 0.35]}
          />
          <directionalLight
            position={[8, 12, 6]}
            intensity={1.65}
            color="#fff1d6"
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-near={0.1}
            shadow-camera-far={50}
            shadow-camera-left={-12}
            shadow-camera-right={12}
            shadow-camera-top={12}
            shadow-camera-bottom={-12}
            shadow-bias={-0.0005}
            shadow-normalBias={0.04}
          />

          {/* Scene */}
          <Platform />
          {/* Crisp waypoint contact shadows on the deck */}
          <ContactShadows
            position={[0, 0.028, 0]}
            opacity={0.55}
            scale={11}
            blur={2.4}
            far={4}
            color="#000000"
          />
          {/* Soft floating-island halo shadow underneath */}
          <ContactShadows
            position={[0, -1.22, 0]}
            opacity={0.35}
            scale={14}
            blur={3.6}
            far={2}
            color="#000000"
          />

          {STATIONS.map((station) => (
            <Waypoint
              key={station.id}
              station={station}
              active={activeId === station.id}
              dimmed={activeId !== null && activeId !== station.id}
              onActivate={() => setActiveId(station.id)}
              onClose={() => setActiveId(null)}
            />
          ))}

          <Avatar position={[0.9, 0, -0.2]} />

          {/* Strict isometric — pan & zoom only, no rotation */}
          <OrbitControls
            makeDefault
            enableRotate={false}
            enablePan
            enableZoom
            screenSpacePanning
            minZoom={45}
            maxZoom={180}
            zoomSpeed={0.8}
            panSpeed={0.9}
          />
        </Suspense>
      </Canvas>

      {/* 2D HUD — outside the Canvas so it never interferes with R3F controls */}
      <SocialDock />
    </main>
  );
}
