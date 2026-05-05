"use client";

import { Suspense, useRef, useMemo } from "react";
import { Environment, SoftShadows, Sky, ContactShadows } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from "@react-three/postprocessing";
import { Vector2 } from "three";

import Ground from "./Ground";
import Player from "./Player";
import Landmark from "./Landmark";
import FollowCamera from "./FollowCamera";
import Decorations from "./Decorations";

// ─── Landmark positions (single source of truth) ─────────────────────────────
const LM = {
  haw:        { x: -38, z: -35 },
  designa:    { x:  42, z: -22 },
  kebab:      { x:   8, z:  40 },
  highschool: { x: -36, z:  32 },
  homebase:   { x:   0, z:   0 },
};

/**
 * Compute the Y rotation so a building's +Z (front) faces the HQ at origin.
 * offset: extra radians to fine-tune per-building (e.g. if the model's
 * "front" isn't +Z in its local space).
 */
function faceHQ(x, z, offset = 0) {
  // Angle from building toward HQ (0,0) — atan2(dx, dz) gives Y-rot in Three.js
  return Math.atan2(0 - x, 0 - z) + offset;
}

export default function World({ onEnter, onExit, onClickOpen, followModeRef, orbitRef }) {
  const playerRef = useRef(null);
  const caOffset  = useMemo(() => new Vector2(0.0005, 0.0005), []);

  return (
    <Suspense fallback={null}>
      <color attach="background" args={["#8ec8e8"]} />

      <Sky
        distance={4500} sunPosition={[60,40,-15]} inclination={0.47} azimuth={0.21}
        turbidity={3.5} rayleigh={0.6} mieCoefficient={0.003} mieDirectionalG={0.9}
      />

      <ambientLight intensity={0.45} color="#ddeeff" />
      <hemisphereLight args={["#c8e8ff","#3d6b44",0.55]} position={[0,50,0]} />
      <directionalLight
        position={[45,65,30]} intensity={2.6} color="#fff4d6" castShadow
        shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-near={0.5} shadow-camera-far={250}
        shadow-camera-left={-70} shadow-camera-right={70}
        shadow-camera-top={70} shadow-camera-bottom={-70}
        shadow-bias={-0.0003} shadow-normalBias={0.06}
      />
      <directionalLight position={[-30,25,-25]} intensity={0.5} color="#a8c8ff" />
      <directionalLight position={[0,-8,0]}     intensity={0.18} color="#a8d8a0" />

      <SoftShadows size={28} samples={12} focus={0.55} />
      <ContactShadows position={[0,0.015,0]} opacity={0.28} width={120} height={120} blur={3} far={12} color="#1a3a22" frames={1} />
      <Environment preset="city" background={false} />

      <FollowCamera targetRef={playerRef} followModeRef={followModeRef} orbitRef={orbitRef} />

      <Physics gravity={[0,-18,0]}>
        <Ground landmarkPositions={LM} />
        <Decorations />

        {/* ── HAW Kiel ─────────────────────────────────────────────────────── */}
        {/* GLB model sits flat on the plaza; no floating, uses ground decal */}
        <Landmark id="haw"
          model="/haw-logo-transformed.glb"
          position={[LM.haw.x, 0, LM.haw.z]}
          rotation={[0, faceHQ(LM.haw.x, LM.haw.z), 0]}
          colliderHalfExtents={[3.0, 1.0, 1.0]}
          sensorHalfExtents={[6.5, 3.5, 6.5]}
          color="#22d3ee" glow="#06b6d4" label="HAW Kiel"
          modelScale={3}
          glossy
          floating={false}
          modelYOffset={0.05}
          onEnter={onEnter} onExit={onExit} onClickOpen={onClickOpen}
        />

        {/* ── Designa ──────────────────────────────────────────────────────── */}
        <Landmark id="designa"
          model="/designa-logo-transformed.glb"
          position={[LM.designa.x, 0, LM.designa.z]}
          rotation={[0, faceHQ(LM.designa.x, LM.designa.z), 0]}
          colliderHalfExtents={[3.2, 2.8, 1.0]}
          sensorHalfExtents={[6.5, 4.0, 6.5]}
          color="#34d399" glow="#10b981" label="Designa"
          modelScale={10} glossy floating
          onEnter={onEnter} onExit={onExit} onClickOpen={onClickOpen}
        />

        {/* ── Yek Döner ────────────────────────────────────────────────────── */}
        <Landmark id="kebab"
          model="/yekdoener-transformed.glb"
          glossy={false} floating={false}
          position={[LM.kebab.x, 0, LM.kebab.z]}
          rotation={[0, faceHQ(LM.kebab.x, LM.kebab.z), 0]}
          colliderHalfExtents={[2.5, 2.2, 2.5]}
          sensorHalfExtents={[6.5, 4.0, 6.5]}
          color="#fb923c" glow="#ef4444" label="Yek Döner"
          modelScale={10}
          onEnter={onEnter} onExit={onExit} onClickOpen={onClickOpen}
        />

        {/* ── Thor Heyerdahl Gymnasium ─────────────────────────────────────── */}
        <Landmark id="highschool"
          proceduralShape="school"
          position={[LM.highschool.x, 0, LM.highschool.z]}
          rotation={[0, faceHQ(LM.highschool.x, LM.highschool.z), 0]}
          colliderHalfExtents={[3.5, 3.0, 2.2]}
          sensorHalfExtents={[6.5, 4.0, 6.5]}
          color="#a78bfa" glow="#7c3aed" label="Thor Heyerdahl"
          modelYOffset={0}
          onEnter={onEnter} onExit={onExit} onClickOpen={onClickOpen}
        />

        {/* ── Homebase HQ ──────────────────────────────────────────────────── */}
        {/* No rotation needed — it IS the HQ, faces +Z by default */}
        <Landmark id="homebase"
          proceduralShape="house"
          position={[LM.homebase.x, 0, LM.homebase.z]}
          colliderHalfExtents={[2.0, 2.5, 1.6]}
          sensorHalfExtents={[6.5, 4.0, 6.5]}
          color="#f472b6" glow="#ec4899" label="HQ"
          modelYOffset={0}
          onEnter={onEnter} onExit={onExit} onClickOpen={onClickOpen}
        />

        <Player playerRef={playerRef} followModeRef={followModeRef} />
      </Physics>

      <EffectComposer multisampling={0} disableNormalPass>
        <Bloom intensity={0.65} luminanceThreshold={0.82} luminanceSmoothing={0.5} mipmapBlur />
        <ChromaticAberration offset={caOffset} radialModulation={false} modulationOffset={0} />
        <Vignette eskil={false} offset={0.2} darkness={0.55} />
      </EffectComposer>
    </Suspense>
  );
}
