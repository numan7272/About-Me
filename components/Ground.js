"use client";

import { useMemo } from "react";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const ISLAND   = 130;   // total ground side length
const HALF     = ISLAND / 2;
const THICK    = 1.6;
const WALL_H   = 5;
const PATH_W   = 4.5;
const PATH_Y   = 0.01; // just above grass surface

// ─────────────────────────────────────────────────────────────────────────────
// PathStrip — a flat rectangle connecting two XZ points, slightly elevated
// ─────────────────────────────────────────────────────────────────────────────
function PathStrip({ from, to, width = PATH_W }) {
  const mid   = useMemo(() => new THREE.Vector3(
    (from[0] + to[0]) / 2,
    PATH_Y,
    (from[2] + to[2]) / 2,
  ), [from, to]);

  const length = useMemo(() =>
    Math.hypot(to[0] - from[0], to[2] - from[2]), [from, to]);

  // atan2 gives the angle in XZ from "from" to "to"
  const angle  = useMemo(() =>
    Math.atan2(to[0] - from[0], to[2] - from[2]), [from, to]);

  return (
    <mesh
      position={mid}
      rotation={[-Math.PI / 2, 0, -angle]}
      receiveShadow
    >
      <planeGeometry args={[width, length, 1, 1]} />
      <meshStandardMaterial
        color="#c9b99a"        // warm sandy path
        roughness={0.96}
        metalness={0.0}
      />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PlazaTile — small decorative hex/square near a landmark
// ─────────────────────────────────────────────────────────────────────────────
function PlazaTile({ position, radius = 5 }) {
  return (
    <mesh
      position={[position[0], PATH_Y - 0.002, position[2]]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <circleGeometry args={[radius, 20]} />
      <meshStandardMaterial
        color="#ddd0b8"        // lighter cobblestone tone
        roughness={0.9}
        metalness={0.0}
      />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ground
// ─────────────────────────────────────────────────────────────────────────────
export default function Ground({ landmarkPositions }) {
  const lm = landmarkPositions ?? {};

  // Ordered list of positions for path generation:
  // spoke from HQ to each outer landmark, plus a ring between neighbours.
  const center = [lm.homebase?.x ?? 0,  0, lm.homebase?.z ?? 0];
  const haw    = [lm.haw?.x    ?? -38, 0, lm.haw?.z    ?? -35];
  const des    = [lm.designa?.x?? 42,  0, lm.designa?.z?? -22];
  const keb    = [lm.kebab?.x  ?? 8,   0, lm.kebab?.z  ?? 40];
  const hsc    = [lm.highschool?.x??-36,0,lm.highschool?.z??32];

  const paths = useMemo(() => [
    // Hub & spoke — center to each landmark
    [center, haw],
    [center, des],
    [center, keb],
    [center, hsc],
    // Ring connections between neighbours (clockwise)
    [haw, des],
    [des, keb],
    [keb, hsc],
    [hsc, haw],
  ], []);

  return (
    <group>

      {/* ── Physics body ─────────────────────────────────────────────────── */}
      <RigidBody type="fixed" colliders={false} friction={0.88} restitution={0}>
        <CuboidCollider
          args={[HALF, THICK / 2, HALF]}
          position={[0, -THICK / 2, 0]}
        />

        {/* ── Base slab ───────────────────────────────────────────────────── */}
        {/* Deep earth-tone underside visible at island edges */}
        <mesh
          position={[0, -THICK / 2, 0]}
          receiveShadow
          castShadow
        >
          <boxGeometry args={[ISLAND, THICK, ISLAND]} />
          <meshStandardMaterial
            color="#3d5a3e"   // deep forest green
            roughness={0.9}
            metalness={0.04}
          />
        </mesh>

        {/* ── Turf surface ─────────────────────────────────────────────────*/}
        {/* Slightly warm pastel green — catches sunlight beautifully */}
        <mesh position={[0, 0.005, 0]} receiveShadow>
          <boxGeometry args={[ISLAND - 0.2, 0.08, ISLAND - 0.2]} />
          <meshStandardMaterial
            color="#6abf69"   // vibrant but not neon
            roughness={0.88}
            metalness={0.0}
          />
        </mesh>
      </RigidBody>

      {/* ── Sandy paths ──────────────────────────────────────────────────── */}
      {paths.map(([from, to], i) => (
        <PathStrip key={i} from={from} to={to} />
      ))}

      {/* ── Plaza circles around each landmark ──────────────────────────── */}
      <PlazaTile position={center} radius={7} />
      <PlazaTile position={haw}    radius={6} />
      <PlazaTile position={des}    radius={6} />
      <PlazaTile position={keb}    radius={6} />
      <PlazaTile position={hsc}    radius={6} />

      {/* ── Subtle outer border ring ──────────────────────────────────────── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]}>
        <ringGeometry args={[HALF - 1.5, HALF - 0.8, 128]} />
        <meshBasicMaterial
          color="#a3e635"
          transparent
          opacity={0.12}
          depthWrite={false}
        />
      </mesh>

      {/* ── Boundary walls — invisible, prevents bike falling off ─────────── */}
      {[
        { pos: [0, WALL_H / 2,  HALF], args: [HALF, WALL_H / 2, 0.5] },
        { pos: [0, WALL_H / 2, -HALF], args: [HALF, WALL_H / 2, 0.5] },
        { pos: [ HALF, WALL_H / 2, 0], args: [0.5, WALL_H / 2, HALF] },
        { pos: [-HALF, WALL_H / 2, 0], args: [0.5, WALL_H / 2, HALF] },
      ].map((w, i) => (
        <RigidBody key={i} type="fixed" colliders={false}>
          <CuboidCollider args={w.args} position={w.pos} />
        </RigidBody>
      ))}

    </group>
  );
}
