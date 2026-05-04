"use client";

import { Suspense, useRef } from "react";
import {
  Environment,
  PerspectiveCamera,
  SoftShadows,
  Sky,
} from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";

import Ground from "./Ground";
import Player from "./Player";
import Landmark from "./Landmark";
import FollowCamera from "./FollowCamera";
import Decorations from "./Decorations";

/**
 * The full 3D world inside the <Canvas>.
 *
 * - Suspense boundary covers all GLB loaders + Environment HDRI.
 * - Physics powers the bike + sensor triggers.
 * - Camera follows the player smoothly at an isometric angle.
 */
export default function World({ onEnter, onExit }) {
  const playerRef = useRef(null);

  return (
    <Suspense fallback={null}>
      {/* Camera — perspective with low FOV for isometric feel */}
      <PerspectiveCamera
        makeDefault
        fov={32}
        position={[14, 16, 14]}
        near={0.5}
        far={250}
      />
      <FollowCamera targetRef={playerRef} offset={[12, 14, 12]} />

      {/* Atmosphere */}
      <color attach="background" args={["#0a0d18"]} />
      <fog attach="fog" args={["#0a0d18", 30, 90]} />
      <Sky
        distance={4500}
        sunPosition={[40, 30, -20]}
        inclination={0.49}
        azimuth={0.25}
        turbidity={6}
        rayleigh={1.2}
        mieCoefficient={0.006}
        mieDirectionalG={0.85}
      />

      {/* Lighting */}
      <ambientLight intensity={0.35} color="#bcd0ff" />
      <hemisphereLight args={["#cfe3ff", "#0a0d18", 0.4]} />
      <directionalLight
        position={[18, 26, 12]}
        intensity={1.6}
        color="#fff1d6"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.1}
        shadow-camera-far={120}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-bias={-0.0005}
        shadow-normalBias={0.04}
      />
      <SoftShadows size={32} samples={12} focus={0.6} />

      {/* HDRI environment for PBR reflections on the logos */}
      <Environment preset="sunset" background={false} />

      {/* Physics world */}
      <Physics gravity={[0, -16, 0]}>
        <Ground />

        <Decorations />

        {/* Strategic landmark placement around the island */}
        <Landmark
          id="haw"
          model="/haw-logo-transformed.glb"
          position={[-12, 0, -10]}
          rotation={[0, Math.PI * 0.18, 0]}
          colliderHalfExtents={[1.6, 1.6, 0.6]}
          sensorHalfExtents={[3.2, 2.4, 3.2]}
          color="#22d3ee"
          glow="#06b6d4"
          label="HAW Kiel"
          onEnter={onEnter}
          onExit={onExit}
        />

        <Landmark
          id="designa"
          model="/designa-logo-transformed.glb"
          position={[14, 0, -8]}
          rotation={[0, -Math.PI * 0.22, 0]}
          colliderHalfExtents={[1.8, 1.4, 0.6]}
          sensorHalfExtents={[3.4, 2.4, 3.4]}
          color="#34d399"
          glow="#10b981"
          label="Designa"
          onEnter={onEnter}
          onExit={onExit}
        />

        <Landmark
          id="kebab"
          variant="kebab"
          position={[2, 0, 14]}
          rotation={[0, -Math.PI * 0.12, 0]}
          colliderHalfExtents={[1.4, 1.2, 1.4]}
          sensorHalfExtents={[3.2, 2.4, 3.2]}
          color="#fb923c"
          glow="#ef4444"
          label="Dönerladen"
          onEnter={onEnter}
          onExit={onExit}
        />

        {/* Player */}
        <Player playerRef={playerRef} />
      </Physics>

      {/* Post-processing — subtle, cinematic */}
      <EffectComposer multisampling={0} disableNormalPass>
        <Bloom
          intensity={0.7}
          luminanceThreshold={0.85}
          luminanceSmoothing={0.45}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.25} darkness={0.6} />
      </EffectComposer>
    </Suspense>
  );
}
