"use client";

import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";

// ─────────────────────────────────────────────────────────────────────────────
// Seeded pseudo-random helper — deterministic so the layout never re-shuffles.
// ─────────────────────────────────────────────────────────────────────────────
function seededRng(seed) {
  let s = seed | 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) | 0;
    return ((s >>> 0) / 0xffffffff);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// WIND-SWAY GRASS  (InstancedMesh + custom ShaderMaterial)
//
// Each grass blade is a tall skinny cone (3 triangles).  The vertex shader
// reads a per-instance matrix to compute "tip height" and applies a sine wave
// displacement only to the top vertices — roots stay planted.
// ─────────────────────────────────────────────────────────────────────────────
const GRASS_VERT = /* glsl */`
  #include <common>
  #include <fog_pars_vertex>

  attribute float instanceSway;   // per-instance sway phase offset

  uniform float uTime;
  uniform float uWindStrength;    // 0 → 1

  void main() {
    #include <begin_vertex>

    // Normalised height of this vertex inside the local cone (0 = root, 1 = tip)
    float tipFactor = smoothstep(0.0, 1.0, (position.y + 0.001) / 0.55);

    // Combine two sine waves with different frequencies — natural-feeling sway
    float wave  = sin(uTime * 1.6 + instanceSway) * 0.55
                + sin(uTime * 2.9 + instanceSway * 1.7) * 0.25;

    transformed.x += wave * tipFactor * uWindStrength;
    transformed.z += wave * tipFactor * uWindStrength * 0.4;

    #include <project_vertex>
    #include <fog_vertex>
  }
`;

const GRASS_FRAG = /* glsl */`
  #include <common>
  #include <fog_pars_fragment>

  void main() {
    // Simple gradient from dark base to bright tip using screen-space dFdy
    float brightness = 0.55 + dFdx(gl_FragCoord.y) * 0.0 + 0.45 * gl_FragCoord.y / 600.0;
    gl_FragColor = vec4(mix(vec3(0.15, 0.45, 0.18), vec3(0.38, 0.78, 0.28), 0.6), 1.0);
    #include <fog_fragment>
  }
`;

const ISLAND_HALF  = 62;           // keep inside 130-unit ground
const EXCLUSION_R  = 7;            // clear ring around each landmark
const GRASS_COUNT  = 3200;

// Main landmark positions duplicated here to exclude grass from plazas
const LANDMARK_XZ = [
  [-38, -35],
  [ 42, -22],
  [  8,  40],
  [-36,  32],
  [  0,   0],
];

function isTooCloseToLandmark(x, z) {
  return LANDMARK_XZ.some(
    ([lx, lz]) => Math.hypot(x - lx, z - lz) < EXCLUSION_R,
  );
}

function GrassField() {
  const meshRef   = useRef();
  const matRef    = useRef();
  const timeRef   = useRef(0);

  // Build instance transforms once
  const { positions, swayPhases } = useMemo(() => {
    const rng = seededRng(0xdeadbeef);
    const positions  = [];
    const swayPhases = new Float32Array(GRASS_COUNT);
    let placed = 0;
    let attempts = 0;

    while (placed < GRASS_COUNT && attempts < GRASS_COUNT * 6) {
      attempts++;
      const x = (rng() - 0.5) * (ISLAND_HALF * 2 - 4);
      const z = (rng() - 0.5) * (ISLAND_HALF * 2 - 4);
      // Skip near landmark plazas and near map edges
      if (isTooCloseToLandmark(x, z)) continue;
      const scale  = 0.9 + rng() * 0.9;
      const rotY   = rng() * Math.PI * 2;
      positions.push({ x, z, scale, rotY });
      swayPhases[placed] = rng() * Math.PI * 2;
      placed++;
    }
    return { positions, swayPhases };
  }, []);

  // Write InstancedMesh matrices
  useEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    positions.forEach(({ x, z, scale, rotY }, i) => {
      dummy.position.set(x, 0, z);
      dummy.rotation.set(0, rotY, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;

    // Per-instance sway phase — read in the vertex shader as `instanceSway`.
    const geom = meshRef.current.geometry;
    geom.setAttribute(
      "instanceSway",
      new THREE.InstancedBufferAttribute(swayPhases, 1),
    );
  }, [positions, swayPhases]);

  // Advance time uniform every frame
  useFrame((_, delta) => {
    timeRef.current += delta;
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = timeRef.current;
    }
  });

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader:   GRASS_VERT,
        fragmentShader: GRASS_FRAG,
        uniforms: {
          uTime:         { value: 0 },
          uWindStrength: { value: 0.045 },
        },
        fog: true,
        side: THREE.DoubleSide,
      }),
    [],
  );

  // Keep ref in sync for useFrame updates
  useEffect(() => { matRef.current = material; }, [material]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, GRASS_COUNT]}
      frustumCulled={false}
      receiveShadow
    >
      {/* 3-sided cone = 3 low-poly triangles per blade */}
      <coneGeometry args={[0.1, 0.55, 3]} />
      <primitive object={material} attach="material" />
    </instancedMesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOW-POLY TREE
// ─────────────────────────────────────────────────────────────────────────────
function Tree({ position, scale = 1 }) {
  return (
    <RigidBody type="fixed" colliders={false} position={position}>
      <CuboidCollider args={[0.2 * scale, 0.7 * scale, 0.2 * scale]} position={[0, 0.7 * scale, 0]} />
      <group scale={scale}>
        {/* Trunk */}
        <mesh castShadow position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.12, 0.16, 1.1, 7]} />
          <meshStandardMaterial color="#6b4226" roughness={0.96} metalness={0.0} />
        </mesh>
        {/* Bottom wide canopy */}
        <mesh castShadow position={[0, 1.65, 0]}>
          <coneGeometry args={[0.75, 1.6, 7]} />
          <meshStandardMaterial color="#1a6b35" roughness={0.88} metalness={0.0} />
        </mesh>
        {/* Middle canopy */}
        <mesh castShadow position={[0, 2.5, 0]}>
          <coneGeometry args={[0.52, 1.2, 7]} />
          <meshStandardMaterial color="#228c42" roughness={0.85} metalness={0.0} />
        </mesh>
        {/* Top tip */}
        <mesh castShadow position={[0, 3.1, 0]}>
          <coneGeometry args={[0.3, 0.85, 6]} />
          <meshStandardMaterial color="#2db84f" roughness={0.82} metalness={0.0} />
        </mesh>
      </group>
    </RigidBody>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOW-POLY HOUSE  (box body + pyramid roof)
// ─────────────────────────────────────────────────────────────────────────────
const HOUSE_PALETTE = [
  { wall: "#fde8d0", roof: "#e07b5a" },
  { wall: "#d4ecd4", roof: "#5a9e6a" },
  { wall: "#d0e4f5", roof: "#5572b8" },
  { wall: "#f7e0c8", roof: "#b87840" },
  { wall: "#e8d8f5", roof: "#8860c0" },
  { wall: "#fdf5c8", roof: "#c8a030" },
];

function House({ position, rotation = 0, paletteIdx = 0, scale = 1 }) {
  const { wall, roof } = HOUSE_PALETTE[paletteIdx % HOUSE_PALETTE.length];
  return (
    <RigidBody type="fixed" colliders={false} position={position}>
      <CuboidCollider
        args={[1.2 * scale, 1.2 * scale, 1.2 * scale]}
        position={[0, 1.2 * scale, 0]}
      />
      <group scale={scale} rotation={[0, rotation, 0]}>
        {/* Walls */}
        <mesh castShadow receiveShadow position={[0, 1.1, 0]}>
          <boxGeometry args={[2.4, 2.2, 2.4]} />
          <meshStandardMaterial color={wall} roughness={0.82} metalness={0.02} />
        </mesh>
        {/* Pyramid roof */}
        <mesh castShadow position={[0, 2.65, 0]}>
          <coneGeometry args={[1.95, 1.5, 4]} />
          <meshStandardMaterial color={roof} roughness={0.76} metalness={0.02} />
        </mesh>
        {/* Door */}
        <mesh position={[0, 0.55, 1.21]}>
          <boxGeometry args={[0.6, 1.0, 0.06]} />
          <meshStandardMaterial color="#4a3520" roughness={0.7} />
        </mesh>
        {/* Window */}
        <mesh position={[0.7, 1.3, 1.21]}>
          <boxGeometry args={[0.45, 0.45, 0.06]} />
          <meshStandardMaterial color="#b8d8f8" roughness={0.1} metalness={0.05} />
        </mesh>
      </group>
    </RigidBody>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LAMP POST
// ─────────────────────────────────────────────────────────────────────────────
function Lamp({ position }) {
  return (
    <RigidBody type="fixed" colliders={false} position={position}>
      <CuboidCollider args={[0.08, 1.5, 0.08]} position={[0, 1.5, 0]} />
      {/* Pole */}
      <mesh castShadow position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.055, 0.07, 3.0, 8]} />
        <meshStandardMaterial color="#1f2937" metalness={0.65} roughness={0.42} />
      </mesh>
      {/* Arm */}
      <mesh castShadow position={[0.22, 2.9, 0]}>
        <boxGeometry args={[0.48, 0.07, 0.14]} />
        <meshStandardMaterial color="#27272a" metalness={0.6} roughness={0.45} />
      </mesh>
      {/* Bulb */}
      <mesh position={[0.44, 2.82, 0]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshStandardMaterial
          color="#fef9c3"
          emissive="#fbbf24"
          emissiveIntensity={2.8}
          toneMapped={false}
        />
      </mesh>
      <pointLight
        position={[0.44, 2.82, 0]}
        intensity={0.5}
        distance={8}
        decay={2}
        color="#fbbf24"
        castShadow={false}
      />
    </RigidBody>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROCK
// ─────────────────────────────────────────────────────────────────────────────
function Rock({ position, seed = 1 }) {
  const rng = useMemo(() => seededRng(seed), [seed]);
  const sx = 0.8 + rng() * 0.7;
  const sy = 0.5 + rng() * 0.45;
  const sz = 0.8 + rng() * 0.6;
  const ry = rng() * Math.PI;
  return (
    <mesh
      castShadow
      receiveShadow
      position={[position[0], 0.28 * sy, position[2]]}
      rotation={[0, ry, 0]}
      scale={[sx, sy, sz]}
    >
      <dodecahedronGeometry args={[0.52, 0]} />
      <meshStandardMaterial color="#6b7280" roughness={0.94} metalness={0.08} />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Road / plaza exclusion — keep trees and lamps off the streets.
// MUST stay in sync with the road list in components/Ground.js.
// ─────────────────────────────────────────────────────────────────────────────
const ROAD_SEGMENTS = [
  [[  0,   0], [-38, -35]],   // HQ ↔ HAW
  [[  0,   0], [ 42, -22]],   // HQ ↔ Designa
  [[  0,   0], [  8,  40]],   // HQ ↔ Kebab
  [[  0,   0], [-36,  32]],   // HQ ↔ Highschool
  [[-38, -35], [ 42, -22]],   // HAW ↔ Designa
  [[ 42, -22], [  8,  40]],   // Designa ↔ Kebab  ← was missing
  [[  8,  40], [-36,  32]],   // Kebab ↔ Highschool
  [[-36,  32], [-38, -35]],   // Highschool ↔ HAW
];
const ROAD_CLEARANCE = 5.5;   // metres from any road centre-line

const PLAZAS = [
  [  0,   0, 9.5],
  [-38, -35, 8.0],
  [ 42, -22, 8.0],
  [  8,  40, 8.0],
  [-36,  32, 8.0],
];

function distToSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-6) return Math.hypot(px - ax, pz - az);
  let t = ((px - ax) * dx + (pz - az) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

function isOnRoad(x, z) {
  return ROAD_SEGMENTS.some(([[ax, az], [bx, bz]]) =>
    distToSeg(x, z, ax, az, bx, bz) < ROAD_CLEARANCE,
  );
}

function isInPlaza(x, z) {
  return PLAZAS.some(([px, pz, r]) => Math.hypot(x - px, z - pz) < r);
}

// River runs north→south at world x = 25, full island length, ~3 m half-width.
// Add a small buffer so trees/lamps never spawn at the bank either.
const RIVER_X = 25;
const RIVER_HALF_WIDTH = 4.5;
const isInRiver = (x) => Math.abs(x - RIVER_X) < RIVER_HALF_WIDTH;

const isBlocked = (x, z) => isOnRoad(x, z) || isInPlaza(x, z) || isInRiver(x);

// ─────────────────────────────────────────────────────────────────────────────
// Layout data — hand-placed, path-safe, landmark-safe
// ─────────────────────────────────────────────────────────────────────────────
const TREES_RAW = [
  [-55, 0, -50], [-50, 0, 15], [-55, 0, 45],
  [ 55, 0,  50], [ 50, 0,-45], [ 55, 0,  5],
  [ -8, 0, -55], [ 18, 0,-55], [-22, 0, -52],
  [ 48, 0,  42], [-48, 0,  40], [ 28, 0,  52],
  [-50, 0, -10], [ 52, 0, -12], [ -2, 0,  55],
  [ 35, 0,  -6], [-35, 0,   8], [ 22, 0,  18],
  [-22, 0, -10], [ 10, 0, -22], [-12, 0,  15],
];

// Hand-placed lamp slots — many overlap roads/plazas. The filter at the
// bottom of this file removes any that fall on a path.
const LAMPS_RAW = [
  // Along north-south spine
  [  0, 0,  18], [  0, 0, -18],
  [  0, 0,  30], [  0, 0, -30],
  // East-west spine
  [ 18, 0,   0], [-18, 0,   0],
  [ 30, 0,   0], [-30, 0,   0],
  // Quad corners
  [ 20, 0,  20], [-20, 0, -20],
  [ 20, 0, -20], [-20, 0,  20],
  // Outer ring of lamps — well clear of every road
  [-46, 0,   0], [ 46, 0,   0],
  [  0, 0,  46], [  0, 0, -46],
  [ 32, 0,  32], [-32, 0, -32],
];

const HOUSES = [
  { pos: [-52, 0,  -5], rot: 0.4,        pi: 0, sc: 1.1  },
  { pos: [ 52, 0,  28], rot: -0.3,       pi: 1, sc: 0.9  },
  { pos: [ 52, 0, -38], rot: 0.8,        pi: 2, sc: 1.0  },
  { pos: [-52, 0,  55], rot: -0.6,       pi: 3, sc: 1.2  },
  { pos: [ 18, 0,  55], rot: 1.1,        pi: 4, sc: 0.85 },
  { pos: [-18, 0, -55], rot: -0.9,       pi: 5, sc: 1.05 },
  { pos: [ 55, 0,  -5], rot: 0.2,        pi: 0, sc: 0.95 },
  { pos: [-55, 0,  25], rot: 0.6,        pi: 2, sc: 1.15 },
  { pos: [  5, 0, -56], rot: -0.4,       pi: 3, sc: 0.9  },
  { pos: [-40, 0,  -8], rot: 0.7,        pi: 5, sc: 0.8  },
  { pos: [ 40, 0,  10], rot: -0.5,       pi: 1, sc: 1.0  },
  { pos: [-12, 0,  52], rot: 0.3,        pi: 4, sc: 1.1  },
];

const ROCKS = [
  [-45, 0,  30], [ 45, 0, -30], [-30, 0, -48],
  [  0, 0,  48], [ 48, 0,  18], [-48, 0, -18],
  [ 30, 0,  30], [-30, 0,  30], [ 15, 0, -45],
];

// Apply the road / plaza filter exactly once at module load
const TREES = TREES_RAW.filter(([x, , z]) => !isBlocked(x, z));
const LAMPS = LAMPS_RAW.filter(([x, , z]) => !isBlocked(x, z));

// ─────────────────────────────────────────────────────────────────────────────
// FIREFLIES — small instanced orbs that orbit around each lamppost
// All instances share one mesh; the per-instance matrix is rebuilt every
// frame from a phase + radius derived from the instance index.
// ─────────────────────────────────────────────────────────────────────────────
const FLIES_PER_LAMP = 6;

function Fireflies({ anchors }) {
  const ref     = useRef();
  const total   = anchors.length * FLIES_PER_LAMP;
  const dummy   = useMemo(() => new THREE.Object3D(), []);
  const tmpC    = useMemo(() => new THREE.Color(), []);
  const seedRef = useRef(null);

  // One-time per-instance random parameters (orbit radius, height, phase, hue)
  if (seedRef.current === null) {
    const rng = seededRng(0xface_b00c);
    seedRef.current = new Float32Array(total * 4);
    for (let i = 0; i < total; i++) {
      seedRef.current[i * 4 + 0] = 0.4 + rng() * 0.7;          // radius
      seedRef.current[i * 4 + 1] = 1.6 + rng() * 1.2;          // base height
      seedRef.current[i * 4 + 2] = rng() * Math.PI * 2;        // phase
      seedRef.current[i * 4 + 3] = 0.3 + rng() * 0.7;          // speed factor
    }
  }

  const geo = useMemo(() => new THREE.SphereGeometry(0.045, 8, 8), []);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0xffd97a,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        vertexColors: true,
      }),
    [],
  );

  // Init transparent grey so hidden particles never bloom black
  useEffect(() => {
    if (!ref.current) return;
    for (let i = 0; i < total; i++) {
      dummy.position.set(0, -999, 0);
      dummy.scale.setScalar(0.001);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
      ref.current.setColorAt(i, tmpC.set(0, 0, 0));
    }
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [dummy, total, tmpC]);

  useFrame((state) => {
    const inst = ref.current;
    if (!inst) return;
    const t = state.clock.getElapsedTime();
    const seed = seedRef.current;

    let i = 0;
    for (const [ax, , az] of anchors) {
      for (let k = 0; k < FLIES_PER_LAMP; k++, i++) {
        const r       = seed[i * 4 + 0];
        const baseY   = seed[i * 4 + 1];
        const phase   = seed[i * 4 + 2];
        const speed   = seed[i * 4 + 3];

        const angle = t * speed + phase;
        const wob   = Math.sin(t * 1.3 + phase) * 0.15;
        const x = ax + Math.cos(angle) * (r + wob);
        const y = baseY + Math.sin(t * 1.7 + phase) * 0.18;
        const z = az + Math.sin(angle) * (r + wob);

        // Pulse intensity for that "blink" feel
        const blink = 0.55 + Math.sin(t * 2.4 + phase * 1.7) * 0.45;

        dummy.position.set(x, y, z);
        dummy.scale.setScalar(0.7 + blink * 0.5);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);

        const c = blink * 0.95;
        inst.setColorAt(i, tmpC.set(c, c * 0.85, c * 0.4));
      }
    }

    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[geo, mat, total]}
      frustumCulled={false}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root export
// ─────────────────────────────────────────────────────────────────────────────
export default function Decorations() {
  return (
    <group>
      {/* Wind-sway grass field */}
      <GrassField />

      {/* Low-poly trees */}
      {TREES.map((p, i) => (
        <Tree key={`tr-${i}`} position={p} scale={0.85 + (i % 4) * 0.15} />
      ))}

      {/* Lamp posts */}
      {LAMPS.map((p, i) => (
        <Lamp key={`lp-${i}`} position={p} />
      ))}

      {/* Fireflies orbiting each lamp */}
      <Fireflies anchors={LAMPS} />

      {/* Pastel houses */}
      {HOUSES.map((h, i) => (
        <House
          key={`h-${i}`}
          position={h.pos}
          rotation={h.rot}
          paletteIdx={h.pi}
          scale={h.sc}
        />
      ))}

      {/* Rocks */}
      {ROCKS.map((p, i) => (
        <Rock key={`rk-${i}`} position={p} seed={i + 7} />
      ))}
    </group>
  );
}
