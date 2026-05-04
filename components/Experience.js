"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, ContactShadows } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";

import Platform from "./Platform";
import Waypoint from "./Waypoint";
import Avatar from "./Avatar";
import SocialDock from "./SocialDock";
import HeroSection from "./HeroSection";

const STATIONS = [
  {
    id: "about",
    position: [-3.8, 0, -1.8],
    color: "#22d3ee",
    accent: "#06b6d4",
    shape: "academic",
    title: "Business Informatics & Mindset",
    subtitle: "HAW Kiel — B.Sc.",
    tags: ["React", "Next.js", "TypeScript", "Python"],
    text: "Fascinated by cutting-edge tech, biology, and physics. My philosophy: the more you learn, the more you realize how much remains unknown. Building at the intersection of software and real-world impact.",
  },
  {
    id: "origin",
    position: [0.2, 0, 3.2],
    color: "#f97316",
    accent: "#ef4444",
    shape: "warm",
    title: "Gastro Roots & MVP Builder",
    subtitle: "Family Döner Shop",
    tags: ["Product", "POS Systems", "UX", "Lean"],
    text: "Worked years in my father's döner shop during high school. I lived the paper chaos and raw stress behind the counter. This pain drives me to build blazing-fast digital POS solutions for local businesses.",
  },
  {
    id: "lab",
    position: [3.8, 0, -1.8],
    color: "#34d399",
    accent: "#10b981",
    shape: "tech",
    title: "Quality Engineering & Bug Hunting",
    subtitle: "Designa Verkehrsleittechnik",
    tags: ["QA", "Testing", "Firmware", "Edge Cases"],
    text: "Working student in the testing lab. I document new software and firmware behavior, hunt edge cases, and break systems to make them more secure. My code doesn't just look good — it's stress-tested.",
  },
];

/** Slowly drifting colored point lights to give the scene life */
function DynamicLights() {
  const light1 = useRef();
  const light2 = useRef();
  const light3 = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (light1.current) {
      light1.current.position.x = Math.sin(t * 0.35) * 5;
      light1.current.position.z = Math.cos(t * 0.35) * 5;
    }
    if (light2.current) {
      light2.current.position.x = Math.sin(t * 0.27 + 2.1) * 6;
      light2.current.position.z = Math.cos(t * 0.27 + 2.1) * 6;
    }
    if (light3.current) {
      light3.current.position.x = Math.sin(t * 0.41 + 4.2) * 4;
      light3.current.position.z = Math.cos(t * 0.41 + 4.2) * 4;
    }
  });

  return (
    <>
      <pointLight ref={light1} color="#22d3ee" intensity={1.8} distance={14} decay={2} position={[-5, 3, -3]} />
      <pointLight ref={light2} color="#818cf8" intensity={1.4} distance={12} decay={2} position={[5, 2.5, -3]} />
      <pointLight ref={light3} color="#f97316" intensity={1.2} distance={11} decay={2} position={[0, 2, 5]} />
    </>
  );
}

export default function Experience() {
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setActiveId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#03040a]">
      {/* Top-left badge */}
      <div className="pointer-events-none absolute left-5 top-5 z-40 select-none">
        <div className="text-[10px] uppercase tracking-[0.32em] text-cyan-400/70 font-medium">
          Numan&apos;s Portfolio
        </div>
        <div className="mt-1 text-[11px] text-zinc-500/60">
          Click · Orbit · Zoom
        </div>
      </div>

      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
        camera={{ fov: 55, position: [0, 8, 14], near: 0.1, far: 300 }}
        className="absolute inset-0"
      >
        <color attach="background" args={["#03040a"]} />
        <fog attach="fog" args={["#03040a", 28, 70]} />

        <Suspense fallback={null}>
          {/* Stars background */}
          <Stars radius={90} depth={60} count={6000} factor={4} saturation={0} fade speed={0.8} />

          {/* Lighting */}
          <ambientLight intensity={0.12} color="#1a1f3a" />
          <hemisphereLight args={["#1a2a4a", "#050510", 0.25]} />
          <directionalLight
            position={[8, 14, 6]}
            intensity={0.7}
            color="#ffe8c0"
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-near={0.1}
            shadow-camera-far={60}
            shadow-camera-left={-18}
            shadow-camera-right={18}
            shadow-camera-top={18}
            shadow-camera-bottom={-18}
            shadow-bias={-0.0004}
          />

          <DynamicLights />

          {/* Scene geometry */}
          <Platform />

          <ContactShadows
            position={[0, 0.01, 0]}
            opacity={0.4}
            scale={18}
            blur={3.0}
            far={3.5}
            color="#000000"
          />

          <HeroSection position={[0, 1.8, 0]} />

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

          <Avatar position={[1.4, 0.05, 0.8]} />

          {/* Post-processing */}
          <EffectComposer>
            <Bloom
              luminanceThreshold={0.18}
              luminanceSmoothing={0.85}
              intensity={1.6}
              radius={0.75}
            />
            <ChromaticAberration
              blendFunction={BlendFunction.NORMAL}
              offset={new THREE.Vector2(0.0005, 0.0005)}
            />
            <Vignette eskil={false} offset={0.12} darkness={0.55} />
          </EffectComposer>

          <OrbitControls
            makeDefault
            enableRotate
            enablePan
            enableZoom
            minPolarAngle={0.25}
            maxPolarAngle={Math.PI * 0.44}
            minDistance={6}
            maxDistance={24}
            zoomSpeed={0.7}
            panSpeed={0.75}
            rotateSpeed={0.45}
            target={[0, 0.5, 0]}
          />
        </Suspense>
      </Canvas>

      {/* 2D HUD — outside Canvas */}
      <SocialDock />
    </main>
  );
}
