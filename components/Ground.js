"use client";

import { useMemo } from "react";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";

import {
  makeOuterShape,
  makeBeachShape,
  makeWetSandShape,
  getOuterWorldPoly,
  ISLAND_VERTS,
} from "@/lib/islandShape";

const THICK   = 1.6;
const WALL_H  = 5;

// Island-fit floor collider — a cylinder large enough to cover any point
// inside the irregular silhouette so the bike never falls into the void.
const FLOOR_R = 78;

// Visual layer Y-offsets — each layer sits clearly above the previous
const TURF_Y   = 0.005;
const BEACH_Y  = 0.012;   // beach sits just above turf, below plazas
const PLAZA_Y  = 0.020;
const ROAD_Y   = 0.035;
const CURB_Y   = 0.044;
const DASH_Y   = 0.052;

const ROAD_W   = 5.5;
const CURB_W   = 0.42;
const DASH_W   = 0.20;
const DASH_LEN = 1.8;
const DASH_GAP = 1.4;

// Plaza radius per landmark — roads are trimmed to stop at this edge
const PLAZA_R = {
  homebase:   8.5,
  haw:        7.0,
  designa:    7.0,
  kebab:      7.0,
  highschool: 7.0,
};

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
// Cool slate cobblestone — clearly distinct from the warm sand of the beach.
function PlazaTile({ position, radius = 7 }) {
  return (
    <group>
      <mesh position={[position[0], PLAZA_Y, position[2]]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow renderOrder={1}>
        <circleGeometry args={[radius, 56]} />
        <meshStandardMaterial
          color="#8b8a87" roughness={0.85} metalness={0.05}
          polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}
        />
      </mesh>
      <mesh position={[position[0], PLAZA_Y + 0.003, position[2]]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <ringGeometry args={[radius * 0.62, radius * 0.66, 64]} />
        <meshStandardMaterial
          color="#6b6a67" roughness={0.92}
          polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2}
        />
      </mesh>
      <mesh position={[position[0], PLAZA_Y + 0.005, position[2]]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <circleGeometry args={[radius * 0.28, 32]} />
        <meshStandardMaterial
          color="#a3a29e" roughness={0.6} metalness={0.18}
          polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3}
        />
      </mesh>
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

// ─── Island silhouette: visual ground built from the shared shape util ────────
function IslandShell() {
  const grassShape   = useMemo(makeOuterShape,   []);
  const beachShape   = useMemo(makeBeachShape,   []);
  const wetSandShape = useMemo(() => makeWetSandShape(1.8), []);

  return (
    <group>
      {/* Subsurface cliff — the chunk of soil under the grass.
          ExtrudeGeometry grows the shape along +Z by `depth`. After the
          mesh's -π/2 X rotation that becomes +Y in world space, so we
          translate the mesh down by THICK to put the *top* face at y=0
          and the bottom at y=-THICK. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -THICK, 0]}
        receiveShadow
        castShadow
      >
        <extrudeGeometry
          args={[grassShape, { depth: THICK, bevelEnabled: false, curveSegments: 1 }]}
        />
        <meshStandardMaterial color="#4a3122" roughness={0.95} metalness={0.0} />
      </mesh>

      {/* Grass top — flat shape at y=TURF_Y, sits just above the cliff top */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, TURF_Y, 0]}
        receiveShadow
        renderOrder={0}
      >
        <shapeGeometry args={[grassShape]} />
        <meshStandardMaterial
          color="#4ea84a" roughness={0.88} metalness={0.0}
          polygonOffset polygonOffsetFactor={-0.5} polygonOffsetUnits={-0.5}
        />
      </mesh>

      {/* Beach ring (dry sand) — the area between the grass-line and the
          coastline, varying in width per angle so bays have wider strands
          than headlands. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, BEACH_Y, 0]}
        receiveShadow
        renderOrder={1}
      >
        <shapeGeometry args={[beachShape]} />
        <meshStandardMaterial
          color="#e7c98b" roughness={0.95}
          polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}
        />
      </mesh>

      {/* Wet-sand band along the water line */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, BEACH_Y + 0.003, 0]}
        receiveShadow
        renderOrder={2}
      >
        <shapeGeometry args={[wetSandShape]} />
        <meshStandardMaterial
          color="#c9a35d" roughness={0.95} transparent opacity={0.85}
          polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2}
        />
      </mesh>
    </group>
  );
}

// ─── Coastline walls: keep the bike from driving off the visible island ──────
// Builds N thin CuboidColliders, one per polygon edge, all parented to a
// single fixed RigidBody so Rapier doesn't see them as N separate bodies.
function CoastlineWalls() {
  const segments = useMemo(() => {
    const pts = getOuterWorldPoly();
    return pts.map((p, i) => {
      const next = pts[(i + 1) % pts.length];
      const dx = next[0] - p[0];
      const dz = next[1] - p[1];
      const len = Math.hypot(dx, dz);
      // Place the wall slightly outboard of the visible coastline so the
      // beach is fully drivable — the wall sits ~1 m out into the water.
      const nx = dx / len, nz = dz / len;     // along the segment
      const ox = -nz, oz = nx;                // outward normal (rightward)
      const midX = (p[0] + next[0]) / 2 + ox * 1.0;
      const midZ = (p[1] + next[1]) / 2 + oz * 1.0;
      const angle = Math.atan2(dx, dz);       // Y rotation around vertical
      return {
        midX, midZ, angle,
        halfLen: len / 2 + 0.4,               // overlap neighbours so no gaps
      };
    });
  }, []);

  return (
    <RigidBody type="fixed" colliders={false} friction={0.5} restitution={0}>
      {segments.map((s, i) => (
        <CuboidCollider
          key={i}
          args={[0.4, WALL_H / 2, s.halfLen]}
          position={[s.midX, WALL_H / 2, s.midZ]}
          rotation={[0, s.angle, 0]}
        />
      ))}
    </RigidBody>
  );
}

// ─── Ground (main export) ─────────────────────────────────────────────────────
export default function Ground({ landmarkPositions }) {
  const lm = landmarkPositions ?? {};

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
  }, [cx, cz, hx, hz, dx, dz, kx, kz, sx, sz]);

  return (
    <group>
      {/* Floor collider — a flat cylinder that comfortably contains the
          irregular polygon. The bike sits on this; the coastline walls
          stop it before it can drive past the visible silhouette. */}
      <RigidBody type="fixed" colliders={false} friction={0.88} restitution={0}>
        <CuboidCollider args={[FLOOR_R, THICK / 2, FLOOR_R]} position={[0, -THICK / 2, 0]} />
      </RigidBody>

      <IslandShell />

      <PlazaTile position={[cx, 0, cz]} radius={8.5} />
      <PlazaTile position={[hx, 0, hz]} radius={7.0} />
      <PlazaTile position={[dx, 0, dz]} radius={7.0} />
      <PlazaTile position={[kx, 0, kz]} radius={7.0} />
      <PlazaTile position={[sx, 0, sz]} radius={7.0} />

      {roads.map((r, i) => <Road key={i} {...r} />)}

      <CoastlineWalls />
    </group>
  );
}
