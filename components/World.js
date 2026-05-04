"use client";

import { Suspense, useRef } from "react";
import {
  Environment,
  SoftShadows,
  Sky,
  ContactShadows,
} from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";

import Ground from "./Ground";
import Player from "./Player";
import Landmark from "./Landmark";
import FollowCamera from "./FollowCamera";
import Decorations from "./Decorations";

/**
 * Props:
 *   onEnter / onExit — sensor callbacks forwarded to each Landmark.
 *   followModeRef    — mutable ref that controls FollowCamera follow behaviour.
 *   orbitRef         — ref to the OrbitControls instance inside FollowCamera.
 */
export default function World({ onEnter, onExit, followModeRef, orbitRef }) {
  const playerRef = useRef(null);

  return (
    <Suspense fallback={null}>
      {/* ── Atmosphere ─────────────────────────────────────────────────── */}
      <color attach="background" args={["#87ceeb"]} />
      <fog attach="fog" args={["#c8e8f0", 60, 150]} />
      <Sky
        distance={4500}
        sunPosition={[50, 35, -10]}
        inclination={0.48}
        azimuth={0.22}
        turbidity={4}
        rayleigh={0.8}
        mieCoefficient={0.004}
        mieDirectionalG={0.88}
      />

      {/* ── Lighting ─────────────────────────────────────────────────────── */}
      <ambientLight intensity={0.55} color="#e8f4ff" />
      <hemisphereLight args={["#d4eeff", "#4a7c59", 0.5]} />

      {/* Main sun — high-res shadow map */}
      <directionalLight
        position={[30, 45, 20]}
        intensity={2.2}
        color="#fff6e0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={180}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-bias={-0.0004}
        shadow-normalBias={0.05}
      />

      {/* Fill light from opposite side */}
      <directionalLight
        position={[-20, 20, -20]}
        intensity={0.4}
        color="#b0d4ff"
      />

      {/* Soft shadows overlay */}
      <SoftShadows size={24} samples={10} focus={0.5} />

      {/* Contact shadows for grounded feel near the bike */}
      <ContactShadows
        position={[0, 0.01, 0]}
        opacity={0.35}
        width={80}
        height={80}
        blur={2.5}
        far={10}
        color="#2d4a30"
      />

      {/* HDRI for PBR reflections on logos */}
      <Environment preset="city" background={false} />

      {/* ── Hybrid camera ─────────────────────────────────────────────────── */}
      <FollowCamera
        targetRef={playerRef}
        followModeRef={followModeRef}
        orbitRef={orbitRef}
      />

      {/* ── Physics world ─────────────────────────────────────────────────── */}
      <Physics gravity={[0, -16, 0]}>
        <Ground />
        <Decorations />

        {/* ── Landmark 1: HAW Kiel ───────────────────────────────────────── */}
        <Landmark
          id="haw"
          model="/haw-logo-transformed.glb"
          position={[-22, 0, -20]}
          rotation={[0, Math.PI * 0.18, 0]}
          colliderHalfExtents={[2.0, 2.0, 0.8]}
          sensorHalfExtents={[4.5, 3.0, 4.5]}
          color="#22d3ee"
          glow="#06b6d4"
          label="HAW Kiel"
          modelScale={8}
          glossy
          floating
          onEnter={onEnter}
          onExit={onExit}
        />

        {/* ── Landmark 2: Designa ────────────────────────────────────────── */}
        <Landmark
          id="designa"
          model="/designa-logo-transformed.glb"
          position={[26, 0, -14]}
          rotation={[0, -Math.PI * 0.22, 0]}
          colliderHalfExtents={[2.2, 1.8, 0.8]}
          sensorHalfExtents={[4.5, 3.0, 4.5]}
          color="#34d399"
          glow="#10b981"
          label="Designa"
          modelScale={8}
          glossy
          floating
          onEnter={onEnter}
          onExit={onExit}
        />

        {/* ── Landmark 3: Kebab Shop ─────────────────────────────────────── */}
        <Landmark
          id="kebab"
          model="/yekdoener-transformed.glb"
          glossy={false}
          floating={false}
          position={[4, 0, 26]}
          rotation={[0, -Math.PI * 0.12, 0]}
          colliderHalfExtents={[1.8, 1.6, 1.8]}
          sensorHalfExtents={[4.5, 3.0, 4.5]}
          color="#fb923c"
          glow="#ef4444"
          label="Yek Döner"
          modelScale={8}
          onEnter={onEnter}
          onExit={onExit}
        />

        {/* ── Landmark 4: Thor Heyerdahl Gymnasium (procedural) ─────────── */}
        <Landmark
          id="highschool"
          proceduralShape="diamond"
          position={[-20, 0, 22]}
          rotation={[0, Math.PI * 0.1, 0]}
          colliderHalfExtents={[1.6, 1.6, 1.6]}
          sensorHalfExtents={[4.5, 3.0, 4.5]}
          color="#a78bfa"
          glow="#7c3aed"
          label="Thor Heyerdahl"
          modelYOffset={1.5}
          onEnter={onEnter}
          onExit={onExit}
        />

        {/* ── Landmark 5: Homebase HQ (procedural sphere) ───────────────── */}
        <Landmark
          id="homebase"
          proceduralShape="sphere"
          position={[0, 0, 0]}
          colliderHalfExtents={[1.4, 1.4, 1.4]}
          sensorHalfExtents={[4.5, 3.0, 4.5]}
          color="#f472b6"
          glow="#ec4899"
          label="HQ"
          modelYOffset={1.2}
          onEnter={onEnter}
          onExit={onExit}
        />

        <Player playerRef={playerRef} />
      </Physics>

      {/* ── Post-processing ───────────────────────────────────────────────── */}
      <EffectComposer multisampling={0} disableNormalPass>
        <Bloom
          intensity={0.5}
          luminanceThreshold={0.88}
          luminanceSmoothing={0.4}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.22} darkness={0.5} />
      </EffectComposer>
    </Suspense>
  );
}
