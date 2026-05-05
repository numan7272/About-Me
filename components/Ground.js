"use client";

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";

const ISLAND  = 130;
const HALF    = ISLAND / 2;
const THICK   = 1.6;
const WALL_H  = 5;

// Visual layer Y-offsets — each layer slightly above the one below
const TURF_Y   = 0.005;
const PLAZA_Y  = 0.010;
const ROAD_Y   = 0.016;
const CURB_Y   = 0.020;
const DASH_Y   = 0.026;
const LOGO_Y   = 0.030;

const ROAD_W   = 5.5;
const CURB_W   = 0.42;
const DASH_W   = 0.20;
const DASH_LEN = 1.8;
const DASH_GAP = 1.4;

// ─── Road segment ─────────────────────────────────────────────────────────────
function segmentInfo(from, to) {
  const dx  = to[0] - from[0];
  const dz  = to[2] - from[2];
  const len = Math.hypot(dx, dz);
  const mid = [(from[0] + to[0]) / 2, 0, (from[2] + to[2]) / 2];
  const ang = Math.atan2(dx, dz);
  return { mid, len, ang };
}

function Road({ from, to }) {
  const { mid, len, ang } = useMemo(
    () => segmentInfo(from, to),
    // stringify so the memo updates when coordinates change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [from[0], from[2], to[0], to[2]],
  );

  const dashCount = useMemo(
    () => Math.max(1, Math.floor(len / (DASH_LEN + DASH_GAP))),
    [len],
  );

  const dashOffsets = useMemo(() => {
    const step  = DASH_LEN + DASH_GAP;
    const total = dashCount * step - DASH_GAP;
    const start = -total / 2 + DASH_LEN / 2;
    return Array.from({ length: dashCount }, (_, i) => start + i * step);
  }, [dashCount]);

  const curbOff = (ROAD_W - CURB_W) / 2;

  return (
    <group position={[mid[0], 0, mid[2]]} rotation={[0, ang, 0]}>
      {/* Asphalt */}
      <mesh
        position={[0, ROAD_Y, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        renderOrder={2}
      >
        <planeGeometry args={[ROAD_W, len]} />
        <meshStandardMaterial
          color="#3a3a46"
          roughness={0.96}
          metalness={0.0}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>

      {/* Left kerb */}
      <mesh
        position={[-curbOff, CURB_Y, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        renderOrder={3}
      >
        <planeGeometry args={[CURB_W, len]} />
        <meshStandardMaterial
          color="#8a9290"
          roughness={0.85}
          polygonOffset
          polygonOffsetFactor={-3}
          polygonOffsetUnits={-3}
        />
      </mesh>

      {/* Right kerb */}
      <mesh
        position={[curbOff, CURB_Y, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        renderOrder={3}
      >
        <planeGeometry args={[CURB_W, len]} />
        <meshStandardMaterial
          color="#8a9290"
          roughness={0.85}
          polygonOffset
          polygonOffsetFactor={-3}
          polygonOffsetUnits={-3}
        />
      </mesh>

      {/* Centre dashes */}
      {dashOffsets.map((zOff, i) => (
        <mesh
          key={i}
          position={[0, DASH_Y, zOff]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={4}
        >
          <planeGeometry args={[DASH_W, DASH_LEN]} />
          <meshStandardMaterial
            color="#f5e04a"
            roughness={0.7}
            emissive="#f5e04a"
            emissiveIntensity={0.14}
            polygonOffset
            polygonOffsetFactor={-4}
            polygonOffsetUnits={-4}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─── Plaza tile ───────────────────────────────────────────────────────────────
function PlazaTile({ position, radius = 5 }) {
  return (
    <group>
      <mesh
        position={[position[0], PLAZA_Y, position[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        renderOrder={1}
      >
        <circleGeometry args={[radius, 40]} />
        <meshStandardMaterial
          color="#c8b08a"
          roughness={0.88}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
      <mesh
        position={[position[0], PLAZA_Y + 0.003, position[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={1}
      >
        <ringGeometry args={[radius * 0.58, radius * 0.63, 40]} />
        <meshStandardMaterial
          color="#a8926a"
          roughness={0.9}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
    </group>
  );
}

// ─── HAW Logo decal — flat on the ground ──────────────────────────────────────
function HawGroundDecal({ position }) {
  const { scene } = useGLTF("/haw-logo-transformed.glb");
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      if (!o.isMesh) return;
      o.receiveShadow = true;
      o.castShadow    = false;
      if (o.material) {
        const m = o.material.clone();
        m.roughness            = 0.15;
        m.metalness            = 0.85;
        m.envMapIntensity      = 1.6;
        m.polygonOffset        = true;
        m.polygonOffsetFactor  = -5;
        m.polygonOffsetUnits   = -5;
        o.material    = m;
        o.renderOrder = 5;
      }
    });
    return c;
  }, [scene]);

  return (
    <group
      position={[position[0], LOGO_Y, position[2]]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={14}
    >
      <primitive object={cloned} />
    </group>
  );
}
useGLTF.preload("/haw-logo-transformed.glb");

// ─── Ground ───────────────────────────────────────────────────────────────────
export default function Ground({ landmarkPositions }) {
  const lm = landmarkPositions ?? {};

  // Derive coordinates — these are stable (LM object never changes at runtime)
  const cx = lm.homebase?.x   ??  0;   const cz = lm.homebase?.z   ??  0;
  const hx = lm.haw?.x        ?? -38;  const hz = lm.haw?.z        ?? -35;
  const dx = lm.designa?.x    ??  42;  const dz = lm.designa?.z    ?? -22;
  const kx = lm.kebab?.x      ??   8;  const kz = lm.kebab?.z      ??  40;
  const sx = lm.highschool?.x ?? -36;  const sz = lm.highschool?.z ??  32;

  // Road pairs — useMemo with scalar deps so nothing is stale
  const roads = useMemo(() => [
    [[cx,0,cz],[hx,0,hz]],
    [[cx,0,cz],[dx,0,dz]],
    [[cx,0,cz],[kx,0,kz]],
    [[cx,0,cz],[sx,0,sz]],
    [[hx,0,hz],[dx,0,dz]],
    [[dx,0,dz],[kx,0,kz]],
    [[kx,0,kz],[sx,0,sz]],
    [[sx,0,sz],[hx,0,hz]],
  ], [cx,cz,hx,hz,dx,dz,kx,kz,sx,sz]);

  return (
    <group>
      {/* ── Physics floor (invisible) ── */}
      <RigidBody type="fixed" colliders={false} friction={0.88} restitution={0}>
        <CuboidCollider args={[HALF, THICK / 2, HALF]} position={[0, -THICK / 2, 0]} />
      </RigidBody>

      {/* ── Visual ground slab ── */}
      <mesh position={[0, -THICK / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[ISLAND, THICK, ISLAND]} />
        <meshStandardMaterial color="#2a4428" roughness={0.9} metalness={0.04} />
      </mesh>

      {/* ── Turf ── */}
      <mesh position={[0, TURF_Y, 0]} receiveShadow renderOrder={0}>
        <boxGeometry args={[ISLAND - 0.2, 0.08, ISLAND - 0.2]} />
        <meshStandardMaterial color="#58b050" roughness={0.88} metalness={0.0} />
      </mesh>

      {/* ── Plaza tiles ── */}
      <PlazaTile position={[cx, 0, cz]} radius={8.5} />
      <PlazaTile position={[hx, 0, hz]} radius={7.0} />
      <PlazaTile position={[dx, 0, dz]} radius={7.0} />
      <PlazaTile position={[kx, 0, kz]} radius={7.0} />
      <PlazaTile position={[sx, 0, sz]} radius={7.0} />

      {/* ── Roads ── */}
      {roads.map(([from, to], i) => (
        <Road key={i} from={from} to={to} />
      ))}

      {/* ── HAW logo decal ── */}
      <HawGroundDecal position={[hx, 0, hz]} />

      {/* ── Border glow ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} renderOrder={1}>
        <ringGeometry args={[HALF - 2.0, HALF - 1.2, 128]} />
        <meshBasicMaterial
          color="#a3e635"
          transparent
          opacity={0.08}
          depthWrite={false}
        />
      </mesh>

      {/* ── Boundary wall colliders ── */}
      {[
        { pos: [0,       WALL_H / 2,  HALF], args: [HALF, WALL_H / 2, 0.5] },
        { pos: [0,       WALL_H / 2, -HALF], args: [HALF, WALL_H / 2, 0.5] },
        { pos: [HALF,   WALL_H / 2,  0   ], args: [0.5,  WALL_H / 2, HALF] },
        { pos: [-HALF,  WALL_H / 2,  0   ], args: [0.5,  WALL_H / 2, HALF] },
      ].map((w, i) => (
        <RigidBody key={i} type="fixed" colliders={false}>
          <CuboidCollider args={w.args} position={w.pos} />
        </RigidBody>
      ))}
    </group>
  );
}
