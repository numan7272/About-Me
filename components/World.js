"use client";

import { Suspense, useRef, useMemo } from "react";
import {
  Environment,
  SoftShadows,
  Sky,
  ContactShadows,
} from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from "@react-three/postprocessing";
import { Vector2 } from "three";

import Ground from "./Ground";
import Player from "./Player";
import Landmark from "./Landmark";
import FollowCamera from "./FollowCamera";
import Decorations from "./Decorations";

// ─────────────────────────────────────────────────────────────────────────────
// Landmark world positions — spread across a 120×120 unit island
// ─────────────────────────────────────────────────────────────────────────────
const LM = {
  haw:        { x: -38, z: -35 },
  designa:    { x:  42, z: -22 },
  kebab:      { x:   8, z:  40 },
  highschool: { x: -36, z:  32 },
  homebase:   { x:   0, z:   0 },
};

export default function World({ onEnter, onExit, followModeRef, orbitRef }) {
  const playerRef = useRef(null);

  // Stable Vector2 for ChromaticAberration — must NOT be re-created each render
  // or postprocessing will throw a uniform lookup error.
  const caOffset = useMemo(() => new Vector2(0.0005, 0.0005), []);

  return (
    <Suspense fallback={null}>

      {/* ── Background colour — NO <fog> (incompatible with postprocessing RenderPass) */}
      <color attach="background" args={["#8ec8e8"]} />

      <Sky
        distance={4500}
        sunPosition={[60, 40, -15]}
        inclination={0.47}
        azimuth={0.21}
        turbidity={3.5}
        rayleigh={0.6}
        mieCoefficient={0.003}
        mieDirectionalG={0.9}
      />

      {/* ── Lighting ─────────────────────────────────────────────────────── */}
      <ambientLight intensity={0.45} color="#ddeeff" />

      <hemisphereLight
        args={["#c8e8ff", "#3d6b44", 0.55]}
        position={[0, 50, 0]}
      />

      <directionalLight
        position={[45, 65, 30]}
        intensity={2.6}
        color="#fff4d6"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={250}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-bias={-0.0003}
        shadow-normalBias={0.06}
      />

      <directionalLight
        position={[-30, 25, -25]}
        intensity={0.5}
        color="#a8c8ff"
        castShadow={false}
      />

      <directionalLight
        position={[0, -8, 0]}
        intensity={0.18}
        color="#a8d8a0"
        castShadow={false}
      />

      <SoftShadows size={28} samples={12} focus={0.55} />

      <ContactShadows
        position={[0, 0.015, 0]}
        opacity={0.28}
        width={120}
        height={120}
        blur={3}
        far={12}
        color="#1a3a22"
        frames={1}
      />

      <Environment preset="city" background={false} />

      {/* ── Camera ─────────────────────────────────────────────────────────── */}
      <FollowCamera
        targetRef={playerRef}
        followModeRef={followModeRef}
        orbitRef={orbitRef}
      />

      {/* ── Physics world ────────────────────────────────────────────────────── */}
      <Physics gravity={[0, -18, 0]}>
        <Ground landmarkPositions={LM} />
        <Decorations />

        {/* 1 · HAW Kiel */}
        <Landmark
          id="haw"
          model="/haw-logo-transformed.glb"
          position={[LM.haw.x, 0, LM.haw.z]}
          rotation={[0, Math.PI * 0.15, 0]}
          colliderHalfExtents={[3.0, 3.5, 1.0]}
          sensorHalfExtents={[6.0, 4.0, 6.0]}
          color="#22d3ee"
          glow="#06b6d4"
          label="HAW Kiel"
          modelScale={10}
          glossy
          floating
          onEnter={onEnter}
          onExit={onExit}
        />

        {/* 2 · Designa */}
        <Landmark
          id="designa"
          model="/designa-logo-transformed.glb"
          position={[LM.designa.x, 0, LM.designa.z]}
          rotation={[0, -Math.PI * 0.2, 0]}
          colliderHalfExtents={[3.2, 2.8, 1.0]}
          sensorHalfExtents={[6.0, 4.0, 6.0]}
          color="#34d399"
          glow="#10b981"
          label="Designa"
          modelScale={10}
          glossy
          floating
          onEnter={onEnter}
          onExit={onExit}
        />

        {/* 3 · Kebab Shop */}
        <Landmark
          id="kebab"
          model="/yekdoener-transformed.glb"
          glossy={false}
          floating={false}
          position={[LM.kebab.x, 0, LM.kebab.z]}
          rotation={[0, -Math.PI * 0.1, 0]}
          colliderHalfExtents={[2.5, 2.2, 2.5]}
          sensorHalfExtents={[6.0, 4.0, 6.0]}
          color="#fb923c"
          glow="#ef4444"
          label="Yek Döner"
          modelScale={10}
          onEnter={onEnter}
          onExit={onExit}
        />

        {/* 4 · High School */}
        <Landmark
          id="highschool"
          proceduralShape="diamond"
          position={[LM.highschool.x, 0, LM.highschool.z]}
          rotation={[0, Math.PI * 0.08, 0]}
          colliderHalfExtents={[2.2, 2.2, 2.2]}
          sensorHalfExtents={[6.0, 4.0, 6.0]}
          color="#a78bfa"
          glow="#7c3aed"
          label="Thor Heyerdahl"
          modelYOffset={2.0}
          onEnter={onEnter}
          onExit={onExit}
        />

        {/* 5 · Homebase HQ */}
        <Landmark
          id="homebase"
          proceduralShape="sphere"
          position={[LM.homebase.x, 0, LM.homebase.z]}
          colliderHalfExtents={[1.8, 1.8, 1.8]}
          sensorHalfExtents={[6.0, 4.0, 6.0]}
          color="#f472b6"
          glow="#ec4899"
          label="HQ"
          modelYOffset={1.5}
          onEnter={onEnter}
          onExit={onExit}
        />

        <Player playerRef={playerRef} followModeRef={followModeRef} />
      </Physics>

      {/* ── Post-processing ───────────────────────────────────────────────────
        NOTE: <fog> must NOT be used alongside this EffectComposer.
        Three.js refreshFogUniforms() dereferences a uniform that the
        postprocessing RenderPass does not initialise, causing a crash.
        Atmospheric depth is handled by the Sky component instead.
      */}
      <EffectComposer multisampling={0} disableNormalPass>
        <Bloom
          intensity={0.65}
          luminanceThreshold={0.82}
          luminanceSmoothing={0.5}
          mipmapBlur
        />
        <ChromaticAberration
          offset={caOffset}
          radialModulation={false}
          modulationOffset={0}
        />
        <Vignette eskil={false} offset={0.2} darkness={0.55} />
      </EffectComposer>

    </Suspense>
  );
}
