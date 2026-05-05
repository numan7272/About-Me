"use client";

import { useMemo } from "react";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";

const ISLAND = 130;
const HALF   = ISLAND / 2;
const THICK  = 1.6;
const WALL_H = 5;

// Road layer heights
const ROAD_Y = 0.014;
const CURB_Y = 0.018;
const DASH_Y = 0.022;
const PLAZA_Y = 0.012;

// Road dimensions
const ROAD_W     = 5.5;
const CURB_W     = 0.45;
const DASH_W     = 0.18;
const DASH_LEN   = 1.8;
const DASH_GAP   = 1.4;

// ─── helpers ─────────────────────────────────────────────────────────────────
function segmentInfo(from, to) {
  const dx  = to[0] - from[0];
  const dz  = to[2] - from[2];
  const len = Math.hypot(dx, dz);
  const mid = [(from[0]+to[0])/2, 0, (from[2]+to[2])/2];
  const ang = Math.atan2(dx, dz);
  return { mid, len, ang };
}

// ─── Road segment: asphalt + curbs + dashed center line ───────────────────────
function Road({ from, to }) {
  const { mid, len, ang } = useMemo(() => segmentInfo(from, to), [from, to]);

  const dashCount = useMemo(() => Math.max(1, Math.floor(len / (DASH_LEN + DASH_GAP))), [len]);
  const dashOffsets = useMemo(() => {
    const step  = DASH_LEN + DASH_GAP;
    const total = dashCount * step - DASH_GAP;
    const start = -total / 2 + DASH_LEN / 2;
    return Array.from({ length: dashCount }, (_, i) => start + i * step);
  }, [dashCount]);

  const curbOffset = (ROAD_W - CURB_W) / 2;

  return (
    <group position={[mid[0], 0, mid[2]]} rotation={[0, ang, 0]}>
      {/* Asphalt */}
      <mesh position={[0, ROAD_Y, 0]} rotation={[-Math.PI/2, 0, 0]} receiveShadow>
        <planeGeometry args={[ROAD_W, len]} />
        <meshStandardMaterial color="#3e3e4a" roughness={0.95} metalness={0.0} />
      </mesh>
      {/* Left curb */}
      <mesh position={[-curbOffset, CURB_Y, 0]} rotation={[-Math.PI/2, 0, 0]} receiveShadow>
        <planeGeometry args={[CURB_W, len]} />
        <meshStandardMaterial color="#8d9490" roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Right curb */}
      <mesh position={[curbOffset, CURB_Y, 0]} rotation={[-Math.PI/2, 0, 0]} receiveShadow>
        <planeGeometry args={[CURB_W, len]} />
        <meshStandardMaterial color="#8d9490" roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Center dashes */}
      {dashOffsets.map((zOff, i) => (
        <mesh key={i} position={[0, DASH_Y, zOff]} rotation={[-Math.PI/2, 0, 0]}>
          <planeGeometry args={[DASH_W, DASH_LEN]} />
          <meshStandardMaterial color="#f9e05a" roughness={0.7} emissive="#f9e05a" emissiveIntensity={0.1} />
        </mesh>
      ))}
    </group>
  );
}

// ─── PlazaTile: cobblestone circle at each landmark ──────────────────────────
function PlazaTile({ position, radius = 5 }) {
  return (
    <group>
      <mesh position={[position[0], PLAZA_Y, position[2]]} rotation={[-Math.PI/2, 0, 0]} receiveShadow>
        <circleGeometry args={[radius, 36]} />
        <meshStandardMaterial color="#c9b28a" roughness={0.88} metalness={0.0} />
      </mesh>
      <mesh position={[position[0], PLAZA_Y+0.003, position[2]]} rotation={[-Math.PI/2, 0, 0]}>
        <ringGeometry args={[radius*0.6, radius*0.65, 36]} />
        <meshStandardMaterial color="#a8936a" roughness={0.9} metalness={0.0} />
      </mesh>
    </group>
  );
}

// ─── Ground ───────────────────────────────────────────────────────────────────
export default function Ground({ landmarkPositions }) {
  const lm = landmarkPositions ?? {};

  const center = [lm.homebase?.x   ??  0,  0, lm.homebase?.z   ??  0];
  const haw    = [lm.haw?.x        ?? -38, 0, lm.haw?.z        ?? -35];
  const des    = [lm.designa?.x    ??  42, 0, lm.designa?.z    ?? -22];
  const keb    = [lm.kebab?.x      ??   8, 0, lm.kebab?.z      ??  40];
  const hsc    = [lm.highschool?.x ?? -36, 0, lm.highschool?.z ??  32];

  // Hub-and-spoke + perimeter ring
  const roads = useMemo(() => [
    [center, haw], [center, des], [center, keb], [center, hsc],
    [haw, des], [des, keb], [keb, hsc], [hsc, haw],
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  return (
    <group>
      {/* ── Physics floor ── */}
      <RigidBody type="fixed" colliders={false} friction={0.88} restitution={0}>
        <CuboidCollider args={[HALF, THICK/2, HALF]} position={[0, -THICK/2, 0]} />
        {/* Underside */}
        <mesh position={[0,-THICK/2,0]} receiveShadow castShadow>
          <boxGeometry args={[ISLAND, THICK, ISLAND]} />
          <meshStandardMaterial color="#2d4a2e" roughness={0.9} metalness={0.04} />
        </mesh>
        {/* Turf top */}
        <mesh position={[0,0.005,0]} receiveShadow>
          <boxGeometry args={[ISLAND-0.2, 0.08, ISLAND-0.2]} />
          <meshStandardMaterial color="#5ab553" roughness={0.88} metalness={0.0} />
        </mesh>
      </RigidBody>

      {/* ── Plaza tiles ── rendered OUTSIDE physics so they're visible */}
      <PlazaTile position={center} radius={8}   />
      <PlazaTile position={haw}    radius={6.5} />
      <PlazaTile position={des}    radius={6.5} />
      <PlazaTile position={keb}    radius={6.5} />
      <PlazaTile position={hsc}    radius={6.5} />

      {/* ── Roads ── rendered OUTSIDE physics — pure visual meshes */}
      {roads.map(([from, to], i) => (
        <Road key={i} from={from} to={to} />
      ))}

      {/* ── Border glow ring ── */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.02,0]}>
        <ringGeometry args={[HALF-2.0, HALF-1.2, 128]} />
        <meshBasicMaterial color="#a3e635" transparent opacity={0.1} depthWrite={false} />
      </mesh>

      {/* ── Boundary walls ── */}
      {[
        {pos:[0,      WALL_H/2,  HALF], args:[HALF, WALL_H/2, 0.5]},
        {pos:[0,      WALL_H/2, -HALF], args:[HALF, WALL_H/2, 0.5]},
        {pos:[ HALF,  WALL_H/2, 0],    args:[0.5,  WALL_H/2, HALF]},
        {pos:[-HALF,  WALL_H/2, 0],    args:[0.5,  WALL_H/2, HALF]},
      ].map((w,i) => (
        <RigidBody key={i} type="fixed" colliders={false}>
          <CuboidCollider args={w.args} position={w.pos} />
        </RigidBody>
      ))}
    </group>
  );
}
