"use client";

import { useMemo } from "react";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";

const ISLAND  = 130;
const HALF    = ISLAND / 2;
const THICK   = 1.6;
const WALL_H  = 5;

// Beach ring around the perimeter — replaces the spotty corner circles.
// The sand band sits between BEACH_INNER and BEACH_OUTER (square distance
// from the island centre using max(|x|,|z|)). Decorations.js mirrors
// BEACH_INNER to keep grass/trees off the shore.
const BEACH_INNER = 58;
const BEACH_OUTER = 64;

// Visual layer Y-offsets — each layer clearly above the previous
const TURF_Y   = 0.005;
const BEACH_Y  = 0.012;   // beach ring sits just above turf, below plazas
const PLAZA_Y  = 0.020;
const ROAD_Y   = 0.035;   // clearly above turf (0.005) and plaza (0.020)
const CURB_Y   = 0.044;
const DASH_Y   = 0.052;
const LOGO_Y   = 0.060;

const ROAD_W   = 5.5;
const CURB_W   = 0.42;
const DASH_W   = 0.20;
const DASH_LEN = 1.8;
const DASH_GAP = 1.4;

// Plaza radius per landmark — roads trimmed to stop at this edge
const PLAZA_R = {
  homebase:   8.5,
  haw:        7.0,
  designa:    7.0,
  kebab:      7.0,
  highschool: 7.0,
};

// Landmark positions as constants (avoids stale closure in useMemo)
// FIX #2 (stale deps): use stable constant positions, not closure vars
const LM_HOMEBASE   = [  0, 0,   0];
const LM_HAW        = [-38, 0, -35];
const LM_DESIGNA    = [ 42, 0, -22];
const LM_KEBAB      = [  8, 0,  40];
const LM_HIGHSCHOOL = [-36, 0,  32];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function segmentInfo(from, to) {
  const dx  = to[0] - from[0];
  const dz  = to[2] - from[2];
  const len = Math.hypot(dx, dz);
  const nx  = dx / len;
  const nz  = dz / len;
  return { len, nx, nz, ang: Math.atan2(dx, dz) };
}

function trimmedRoad(fromPos, toPos, fromR, toR) {
  const info = segmentInfo(fromPos, toPos);
  const trimmedLen = info.len - fromR - toR;
  if (trimmedLen <= 0.5) return null;

  const startX = fromPos[0] + info.nx * fromR;
  const startZ = fromPos[2] + info.nz * fromR;
  const midX   = startX + info.nx * trimmedLen / 2;
  const midZ   = startZ + info.nz * trimmedLen / 2;

  return { mid: [midX, 0, midZ], len: trimmedLen, ang: info.ang };
}

// ─── Road segment ─────────────────────────────────────────────────────────────
function Road({ mid, len, ang }) {
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
      <mesh position={[0, ROAD_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow renderOrder={2}>
        <planeGeometry args={[ROAD_W, len]} />
        <meshStandardMaterial
          color="#3a3a46" roughness={0.96} metalness={0.0}
          polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2}
        />
      </mesh>
      <mesh position={[-curbOff, CURB_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow renderOrder={3}>
        <planeGeometry args={[CURB_W, len]} />
        <meshStandardMaterial color="#8a9290" roughness={0.85} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
      </mesh>
      <mesh position={[curbOff, CURB_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow renderOrder={3}>
        <planeGeometry args={[CURB_W, len]} />
        <meshStandardMaterial color="#8a9290" roughness={0.85} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
      </mesh>
      {dashOffsets.map((zOff, i) => (
        <mesh key={i} position={[0, DASH_Y, zOff]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
          <planeGeometry args={[DASH_W, DASH_LEN]} />
          <meshStandardMaterial
            color="#f5e04a" roughness={0.7} emissive="#f5e04a" emissiveIntensity={0.14}
            polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─── Plaza / Fundament ────────────────────────────────────────────────────────
// Plazas are now cool slate cobblestone — clearly distinct from the warm
// sand of the beach ring so they no longer read as little beach circles in
// the middle of the map.
function PlazaTile({ position, radius = 7 }) {
  return (
    <group>
      {/* Outer slate disc */}
      <mesh position={[position[0], PLAZA_Y, position[2]]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow renderOrder={1}>
        <circleGeometry args={[radius, 56]} />
        <meshStandardMaterial
          color="#8b8a87" roughness={0.85} metalness={0.05}
          polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}
        />
      </mesh>
      {/* Cobblestone joint ring — slightly darker, picks out a "tile" pattern */}
      <mesh position={[position[0], PLAZA_Y + 0.003, position[2]]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <ringGeometry args={[radius * 0.62, radius * 0.66, 64]} />
        <meshStandardMaterial
          color="#6b6a67" roughness={0.92}
          polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2}
        />
      </mesh>
      {/* Centre medallion — paler, polished stone */}
      <mesh position={[position[0], PLAZA_Y + 0.005, position[2]]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <circleGeometry args={[radius * 0.28, 32]} />
        <meshStandardMaterial
          color="#a3a29e" roughness={0.6} metalness={0.18}
          polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3}
        />
      </mesh>
      {/* Centre inset accent ring */}
      <mesh position={[position[0], PLAZA_Y + 0.007, position[2]]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
        <ringGeometry args={[radius * 0.10, 0.14 + radius * 0.02, 32]} />
        <meshStandardMaterial
          color="#5b5a57" roughness={0.7}
          polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4}
        />
      </mesh>
    </group>
  );
}

// ─── Beach ring + island silhouette ───────────────────────────────────────────
// Square ring of sand wrapping the inner perimeter, replacing the eight
// scattered beach circles that previously dotted the map. Built from a
// THREE.Shape with a square hole so it's a single mesh rather than four
// strips that would seam at the corners.
function BeachRing() {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-BEACH_OUTER, -BEACH_OUTER);
    s.lineTo( BEACH_OUTER, -BEACH_OUTER);
    s.lineTo( BEACH_OUTER,  BEACH_OUTER);
    s.lineTo(-BEACH_OUTER,  BEACH_OUTER);
    s.closePath();
    const h = new THREE.Path();
    h.moveTo(-BEACH_INNER, -BEACH_INNER);
    h.lineTo(-BEACH_INNER,  BEACH_INNER);
    h.lineTo( BEACH_INNER,  BEACH_INNER);
    h.lineTo( BEACH_INNER, -BEACH_INNER);
    h.closePath();
    s.holes.push(h);
    return s;
  }, []);

  // Wet-sand inner band — a slightly darker, narrower ring just inside the
  // outer beach. Adds the visual transition from dry sand to surf.
  const wetShape = useMemo(() => {
    const s = new THREE.Shape();
    const w = BEACH_OUTER;
    const i = BEACH_OUTER - 1.6;
    s.moveTo(-w, -w); s.lineTo(w, -w); s.lineTo(w, w); s.lineTo(-w, w); s.closePath();
    const h = new THREE.Path();
    h.moveTo(-i, -i); h.lineTo(-i, i); h.lineTo(i, i); h.lineTo(i, -i); h.closePath();
    s.holes.push(h);
    return s;
  }, []);

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, BEACH_Y, 0]}
        receiveShadow
        renderOrder={1}
      >
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial
          color="#e7c98b"
          roughness={0.95}
          polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}
        />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, BEACH_Y + 0.003, 0]}
        receiveShadow
        renderOrder={2}
      >
        <shapeGeometry args={[wetShape]} />
        <meshStandardMaterial
          color="#c9a35d"
          roughness={0.95}
          transparent
          opacity={0.85}
          polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2}
        />
      </mesh>
    </group>
  );
}

// ─── Ground (main export) ─────────────────────────────────────────────────────
export default function Ground({ landmarkPositions }) {
  // FIX #2: use module-level constant arrays so useMemo has stable deps
  // landmarkPositions prop is still accepted for forward-compat but
  // the road layout uses the shared constants from World.js
  const lm = landmarkPositions ?? {};

  // Allow override from parent, but fall back to module constants
  const cx = lm.homebase?.x   ?? LM_HOMEBASE[0];
  const cz = lm.homebase?.z   ?? LM_HOMEBASE[2];
  const hx = lm.haw?.x        ?? LM_HAW[0];
  const hz = lm.haw?.z        ?? LM_HAW[2];
  const dx = lm.designa?.x    ?? LM_DESIGNA[0];
  const dz = lm.designa?.z    ?? LM_DESIGNA[2];
  const kx = lm.kebab?.x      ?? LM_KEBAB[0];
  const kz = lm.kebab?.z      ?? LM_KEBAB[2];
  const sx = lm.highschool?.x ?? LM_HIGHSCHOOL[0];
  const sz = lm.highschool?.z ?? LM_HIGHSCHOOL[2];

  // FIX #2: deps array uses scalar primitives only — no arrays
  const roads = useMemo(() => {
    const C = [cx, 0, cz];
    const H = [hx, 0, hz];
    const D = [dx, 0, dz];
    const K = [kx, 0, kz];
    const S = [sx, 0, sz];
    const raw = [
      [C, H, PLAZA_R.homebase, PLAZA_R.haw],
      [C, D, PLAZA_R.homebase, PLAZA_R.designa],
      [C, K, PLAZA_R.homebase, PLAZA_R.kebab],
      [C, S, PLAZA_R.homebase, PLAZA_R.highschool],
      [H, D, PLAZA_R.haw,      PLAZA_R.designa],
      [D, K, PLAZA_R.designa,  PLAZA_R.kebab],
      [K, S, PLAZA_R.kebab,    PLAZA_R.highschool],
      [S, H, PLAZA_R.highschool, PLAZA_R.haw],
    ];
    return raw.map(([from, to, fr, tr]) => trimmedRoad(from, to, fr, tr)).filter(Boolean);
  // All primitive deps — no stale arrays
  }, [cx, cz, hx, hz, dx, dz, kx, kz, sx, sz]);

  return (
    <group>
      <RigidBody type="fixed" colliders={false} friction={0.88} restitution={0}>
        <CuboidCollider args={[HALF, THICK / 2, HALF]} position={[0, -THICK / 2, 0]} />
      </RigidBody>

      {/* Subsurface dirt — the chunk of soil under the grass. Visible from
          the water as a dark cliff edge so the island feels like it's sitting
          in the ocean rather than floating as a flat decal. */}
      <mesh position={[0, -THICK / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[ISLAND, THICK, ISLAND]} />
        <meshStandardMaterial color="#3d2a1e" roughness={0.95} metalness={0.0} />
      </mesh>
      {/* Sandy "rock face" rim just under the grass top — picks up the warm
          sun light and sells the cliff as part of the beach. */}
      <mesh position={[0, -0.18, 0]} receiveShadow>
        <boxGeometry args={[ISLAND + 0.02, 0.36, ISLAND + 0.02]} />
        <meshStandardMaterial color="#a08560" roughness={0.92} metalness={0.0} />
      </mesh>

      <mesh position={[0, TURF_Y, 0]} receiveShadow renderOrder={0}>
        <boxGeometry args={[ISLAND - 0.2, 0.08, ISLAND - 0.2]} />
        <meshStandardMaterial color="#4ea84a" roughness={0.88} metalness={0.0} />
      </mesh>

      {/* Continuous coastal beach ring around the perimeter — replaces the
          spotty corner circles that previously sat in random places. */}
      <BeachRing />

      <PlazaTile position={[cx, 0, cz]} radius={8.5} />
      <PlazaTile position={[hx, 0, hz]} radius={7.0} />
      <PlazaTile position={[dx, 0, dz]} radius={7.0} />
      <PlazaTile position={[kx, 0, kz]} radius={7.0} />
      <PlazaTile position={[sx, 0, sz]} radius={7.0} />

      {roads.map((r, i) => <Road key={i} {...r} />)}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} renderOrder={1}>
        <ringGeometry args={[HALF - 2.0, HALF - 1.2, 128]} />
        <meshBasicMaterial color="#a3e635" transparent opacity={0.08} depthWrite={false} />
      </mesh>

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
