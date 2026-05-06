"use client";

import { Suspense, useRef, useMemo } from "react";
import { Environment, SoftShadows, ContactShadows, Sparkles } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { EffectComposer, Bloom, Vignette, ChromaticAberration, SSAO } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { Vector2, Fog, Color } from "three";

import Ground from "./Ground";
import Player from "./Player";
import Landmark from "./Landmark";
import FollowCamera from "./FollowCamera";
import Decorations from "./Decorations";
import Water from "./Water";
import Birds from "./Birds";
import MobileControls from "./MobileControls";
import EasterEggs from "./EasterEggs";
import TrackTexture from "./TrackTexture";

import { sample as sampleDayCycle } from "@/lib/dayCycle";

// ─── Landmark positions (single source of truth) ─────────────────────────────
const LM = {
  haw:        { x: -38, z: -35 },
  designa:    { x:  42, z: -22 },
  kebab:      { x:   8, z:  40 },
  highschool: { x: -36, z:  32 },
  homebase:   { x:   0, z:   0 },
};

function faceHQ(x, z, offset = 0) {
  return Math.atan2(0 - x, 0 - z) + offset;
}

/**
 * Drives the dynamic day/night cycle.
 *  - Reads the sun position + sky/ambient/fog colours from the shared
 *    cycle util, applies them to the lights and the scene background.
 *  - Writes a `dayRef.current` snapshot every frame so child components
 *    (grass, cloud shadows) can react too without re-rendering React.
 */
function DayCycle({ sunRef, ambientRef, hemiRef, fillRef, dayRef }) {
  const { scene } = useThree();
  // Reusable colour holders so we don't allocate per frame.
  const skyTint  = useMemo(() => new Color(), []);
  const fogTint  = useMemo(() => new Color(), []);
  // The Fog object is set once and mutated each frame.
  const fog = useMemo(() => new Fog("#bcd8e8", 60, 220), []);
  useMemo(() => { scene.fog = fog; }, [scene, fog]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const s = sampleDayCycle(t, dayRef.current ?? {});
    dayRef.current = s;

    // Sky / scene background — gentle clear colour blend
    skyTint.copy(s.sky);
    scene.background = skyTint;

    // Fog colour follows the sky, distance is fixed but the colour shift
    // is enough to feel "weather changing".
    fogTint.copy(s.fog);
    fog.color.copy(fogTint);

    // Sun light: position from the unit-sphere direction × big radius
    if (sunRef.current) {
      const d = s.sunDir;
      sunRef.current.position.set(d.x * 80, Math.max(8, d.y * 80), d.z * 80);
      sunRef.current.intensity = s.sunIntensity;
      sunRef.current.color.copy(s.sun);
    }
    if (ambientRef.current) {
      ambientRef.current.intensity = s.ambientIntensity;
      ambientRef.current.color.copy(s.ambient);
    }
    if (hemiRef.current) {
      hemiRef.current.intensity = s.hemiIntensity;
      hemiRef.current.color.copy(s.sky);          // top tint = sky
      hemiRef.current.groundColor.copy(s.ambient);
    }
    if (fillRef.current) {
      fillRef.current.intensity = 0.18 + s.dayWeight * 0.32;
    }
  });

  return null;
}

export default function World({ onEnter, onExit, onClickOpen, followModeRef, orbitRef }) {
  const playerRef = useRef(null);
  const caOffset  = useMemo(() => new Vector2(0.0005, 0.0005), []);

  // Refs for the lights so DayCycle can mutate their props per frame
  // without rerendering React. The `dayRef` is shared down to grass +
  // cloud shadows so they can colour-shift with the sun.
  const sunRef     = useRef(null);
  const ambientRef = useRef(null);
  const hemiRef    = useRef(null);
  const fillRef    = useRef(null);
  const dayRef     = useRef({ dayWeight: 1 });

  return (
    <Suspense fallback={null}>
      <color attach="background" args={["#8ec8e8"]} />

      <ambientLight ref={ambientRef} intensity={0.45} color="#ddeeff" />
      <hemisphereLight ref={hemiRef} args={["#c8e8ff","#3d6b44",0.55]} position={[0,50,0]} />
      <directionalLight
        ref={sunRef}
        position={[45,65,30]} intensity={2.6} color="#fff4d6" castShadow
        shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-near={0.5} shadow-camera-far={250}
        shadow-camera-left={-70} shadow-camera-right={70}
        shadow-camera-top={70} shadow-camera-bottom={-70}
        shadow-bias={-0.0003} shadow-normalBias={0.06}
      />
      {/* Cool fill light for the side away from the sun. Intensity is
          modulated per frame in DayCycle. */}
      <directionalLight ref={fillRef} position={[-30,25,-25]} intensity={0.5} color="#a8c8ff" />
      <directionalLight position={[0,-8,0]}     intensity={0.18} color="#a8d8a0" />

      <SoftShadows size={28} samples={12} focus={0.55} />
      <ContactShadows position={[0,0.015,0]} opacity={0.28} width={120} height={120} blur={3} far={12} color="#1a3a22" frames={1} />
      <Environment preset="city" background={false} />

      <DayCycle
        sunRef={sunRef}
        ambientRef={ambientRef}
        hemiRef={hemiRef}
        fillRef={fillRef}
        dayRef={dayRef}
      />

      <FollowCamera targetRef={playerRef} followModeRef={followModeRef} orbitRef={orbitRef} />

      {/* Water surrounding the floating island — no physics, purely visual */}
      <Water dayRef={dayRef} />

      {/* Off-screen track-texture pipeline. Renders the bike's recent
          path into a render target every frame; the grass shader reads
          that texture and squashes blades where the bike has been. */}
      <TrackTexture />

      {/* Flock of birds circling overhead */}
      <Birds />

      <Physics gravity={[0,-18,0]}>
        <Ground landmarkPositions={LM} />
        <Decorations dayRef={dayRef} />

        <Landmark id="haw"
          model="/haw-logo-transformed.glb"
          position={[LM.haw.x, 0, LM.haw.z]}
          rotation={[0, faceHQ(LM.haw.x, LM.haw.z), 0]}
          colliderHalfExtents={[3.2, 2.8, 1.0]}
          sensorHalfExtents={[6.5, 4.0, 6.5]}
          color="#22d3ee" glow="#06b6d4" label="HAW Kiel"
          modelScale={10} glossy floating
          onEnter={onEnter} onExit={onExit} onClickOpen={onClickOpen}
        />

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

      <MobileControls />

      <EasterEggs onClickOpen={onClickOpen} />

      <Sparkles
        count={140}
        size={3}
        speed={0.18}
        scale={[120, 18, 120]}
        position={[0, 9, 0]}
        color="#ffe9b3"
        opacity={0.55}
      />
      <Sparkles
        count={90}
        size={1.6}
        speed={0.08}
        scale={[110, 4, 110]}
        position={[0, 2, 0]}
        color="#bfd9ff"
        opacity={0.4}
      />

      <EffectComposer multisampling={0}>
        {/* SSAO pass — soft contact shadows where geometry meets the
            ground, makes the bike + buildings feel grounded. */}
        <SSAO
          blendFunction={BlendFunction.MULTIPLY}
          samples={16}
          radius={4}
          intensity={20}
          luminanceInfluence={0.7}
          worldDistanceThreshold={0.5}
          worldDistanceFalloff={0.1}
          worldProximityThreshold={6}
          worldProximityFalloff={2}
          fade={0.02}
        />
        <Bloom intensity={0.65} luminanceThreshold={0.82} luminanceSmoothing={0.5} mipmapBlur />
        <ChromaticAberration offset={caOffset} radialModulation={false} modulationOffset={0} />
        <Vignette eskil={false} offset={0.2} darkness={0.55} />
      </EffectComposer>
    </Suspense>
  );
}
