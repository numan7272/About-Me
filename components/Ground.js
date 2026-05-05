"use client";

import { useMemo } from "react";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const ISLAND  = 130;
const HALF    = ISLAND / 2;
const THICK   = 1.6;
const WALL_H  = 5;

const ROAD_Y       = 0.012;   // road surface level
const CURB_Y       = 0.016;   // curb edge sits just above road
const DASH_Y       = 0.018;   // center-line dashes
const PLAZA_Y      = 0.010;

const ROAD_W       = 5.5;     // total road width
const CURB_W       = 0.45;    // each curb strip width
const DASH_W       = 0.18;
const DASH_LEN     = 1.8;
const DASH_GAP     = 1.4;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function vec2(x, z) { return new THREE.Vector2(x, z); }

// Return [midX, midZ, lengthXZ, angleY] for a segment from→to
function segmentInfo(from, to) {
  const dx  = to[0] - from[0];
  const dz  = to[2] - from[2];
  const len = Math.hypot(dx, dz);
  const mid = [(from[0] + to[0]) / 2, 0, (from[2] + to[2]) / 2];
  // atan2(dx,dz) gives angle around Y so that +Z is 0°
  const ang = Math.atan2(dx, dz);
  return { mid, len, ang };
}

// ─────────────────────────────────────────────────────────────────────────────
// Road — asphalt body + two curb strips + dashed center line
// ─────────────────────────────────────────────────────────────────────────────
function Road({ from, to }) {
  const { mid, len, ang } = useMemo(() => segmentInfo(from, to), [from, to]);

  // Center-line dashes: how many fit?
  const dashCount = useMemo(() => {
    const n = Math.floor(len / (DASH_LEN + DASH_GAP));
    return Math.max(1, n);
  }, [len]);

  // Offsets for each dash along the road (local Z of the road plane)
  const dashOffsets = useMemo(() => {
    const step    = DASH_LEN + DASH_GAP;
    const total   = dashCount * step - DASH_GAP;
    const start   = -total / 2 + DASH_LEN / 2;
    return Array.from({ length: dashCount }, (_, i) => start + i * step);
  }, [dashCount]);

  // Curb offset from center-line
  const curbOffset = (ROAD_W - CURB_W) / 2;

  return (
    <group
      position={[mid[0], 0, mid[2]]}
      rotation={[0, ang, 0]}
    >
      {/* Asphalt */}
      <mesh position={[0, ROAD_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ROAD_W, len]} />
        <meshStandardMaterial color="#4a4a55" roughness={0.94} metalness={0.0} />
      </mesh>

      {/* Left curb */}
      <mesh position={[-curbOffset, CURB_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[CURB_W, len]} />
        <meshStandardMaterial color="#9ca3a0" roughness={0.85} metalness={0.05} />
      </mesh>

      {/* Right curb */}
      <mesh position={[curbOffset, CURB_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[CURB_W, len]} />
        <meshStandardMaterial color="#9ca3a0" roughness={0.85} metalness={0.05} />
      </mesh>

      {/* Center dashes */}
      {dashOffsets.map((zOff, i) => (
        <mesh key={i} position={[0, DASH_Y, zOff]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[DASH_W, DASH_LEN]} />
          <meshStandardMaterial
            color="#f9e05a"
            roughness={0.7}
            metalness={0.0}
            emissive="#f9e05a"
            emissiveIntensity={0.08}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PlazaTile — cobblestone circle around each landmark
// ─────────────────────────────────────────────────────────────────────────────
function PlazaTile({ position, radius = 5 }) {
  return (
    <group>
      {/* Base disc */}
      <mesh
        position={[position[0], PLAZA_Y, position[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <circleGeometry args={[radius, 36]} />
        <meshStandardMaterial color="#c9b28a" roughness={0.88} metalness={0.0} />
      </mesh>

      {/* Inner accent ring */}
      <mesh
        position={[position[0], PLAZA_Y + 0.003, position[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[radius * 0.6, radius * 0.65, 36]} />
        <meshStandardMaterial color="#a8936a" roughness={0.9} metalness={0.0} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ground
//
// Road network layout:
//   Hub-and-spoke:  homebase ↔ each of the 4 outer landmarks
//   Perimeter ring: haw ↔ designa ↔ kebab ↔ highschool ↔ haw
// ─────────────────────────────────────────────────────────────────────────────
export default function Ground({ landmarkPositions }) {
  const lm = landmarkPositions ?? {};

  // Resolve positions with fallbacks matching World.js LM constants
  const center = [lm.homebase?.x    ??   0,  0, lm.homebase?.z    ??   0];
  const haw    = [lm.haw?.x         ?? -38,  0, lm.haw?.z         ?? -35];
  const des    = [lm.designa?.x     ??  42,  0, lm.designa?.z     ?? -22];
  const keb    = [lm.kebab?.x       ??   8,  0, lm.kebab?.z       ??  40];
  const hsc    = [lm.highschool?.x  ?? -36,  0, lm.highschool?.z  ??  32];

  // All road segments (from → to pairs)
  const roads = useMemo(() => [
    // Hub spokes
    [center, haw],
    [center, des],
    [center, keb],
    [center, hsc],
    // Outer ring
    [haw, des],
    [des, keb],
    [keb, hsc],
    [hsc, haw],
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  return (
    <group>

      {/* ── Physics ────────────────────────────────────────────────────── */}
      <RigidBody type="fixed" colliders={false} friction={0.88} restitution={0}>
        <CuboidCollider
          args={[HALF, THICK / 2, HALF]}
          position={[0, -THICK / 2, 0]}
        />

        {/* Deep green base slab (visible at island edges) */}
        <mesh position={[0, -THICK / 2, 0]} receiveShadow castShadow>
          <boxGeometry args={[ISLAND, THICK, ISLAND]} />
          <meshStandardMaterial color="#2d4a2e" roughness={0.9} metalness={0.04} />
        </mesh>

        {/* Bright turf surface */}
        <mesh position={[0, 0.005, 0]} receiveShadow>
          <boxGeometry args={[ISLAND - 0.2, 0.08, ISLAND - 0.2]} />
          <meshStandardMaterial color="#5ab553" roughness={0.88} metalness={0.0} />
        </mesh>
      </RigidBody>

      {/* ── Plaza circles ───────────────────────────────────────────────── */}
      <PlazaTile position={center} radius={8} />
      <PlazaTile position={haw}    radius={6.5} />
      <PlazaTile position={des}    radius={6.5} />
      <PlazaTile position={keb}    radius={6.5} />
      <PlazaTile position={hsc}    radius={6.5} />

      {/* ── Roads ───────────────────────────────────────────────────────── */}
      {roads.map(([from, to], i) => (
        <Road key={i} from={from} to={to} />
      ))}

      {/* ── Outer border glow ────────────────────────────────────────────── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[HALF - 2.0, HALF - 1.2, 128]} />
        <meshBasicMaterial
          color="#a3e635"
          transparent
          opacity={0.1}
          depthWrite={false}
        />
      </mesh>

      {/* ── Invisible boundary walls ─────────────────────────────────────── */}
      {[
        { pos: [0,      WALL_H / 2,  HALF], args: [HALF, WALL_H / 2, 0.5] },
        { pos: [0,      WALL_H / 2, -HALF], args: [HALF, WALL_H / 2, 0.5] },
        { pos: [ HALF,  WALL_H / 2,  0],   args: [0.5,  WALL_H / 2, HALF] },
        { pos: [-HALF,  WALL_H / 2,  0],   args: [0.5,  WALL_H / 2, HALF] },
      ].map((w, i) => (
        <RigidBody key={i} type="fixed" colliders={false}>
          <CuboidCollider args={w.args} position={w.pos} />
        </RigidBody>
      ))}

    </group>
  );
}
