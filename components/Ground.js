"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";

const ISLAND_SIZE = 100;
const ISLAND_THICKNESS = 1.4;
const WALL_HEIGHT = 4;

// Landmark positions mirrored from World.js for path connectivity
const LANDMARKS_POS = [
  [-22, 0, -20],  // haw
  [26, 0, -14],   // designa
  [4, 0, 26],     // kebab
  [-20, 0, 22],   // highschool
  [0, 0, 0],      // homebase (center)
];

/**
 * GrassField — InstancedMesh of small green triangles scattered across the map.
 */
function GrassField({ count = 600 }) {
  const meshRef = useRef();

  const [positions, rotations] = useMemo(() => {
    const pos = [];
    const rots = [];
    const half = (ISLAND_SIZE / 2) - 3;
    // Simple exclusion: avoid center 6×6 and road strips
    for (let i = 0; i < count; i++) {
      let x, z;
      do {
        x = (Math.random() - 0.5) * half * 2;
        z = (Math.random() - 0.5) * half * 2;
      } while (Math.abs(x) < 3.5 || Math.abs(z) < 3.5);
      pos.push([x, 0.01, z]);
      rots.push(Math.random() * Math.PI * 2);
    }
    return [pos, rots];
  }, [count]);

  useMemo(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    positions.forEach(([x, y, z], i) => {
      const s = 0.15 + Math.random() * 0.2;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, rotations[i], 0);
      dummy.scale.set(s, s + Math.random() * 0.3, s);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]} receiveShadow>
      <coneGeometry args={[0.12, 0.55, 3]} />
      <meshStandardMaterial
        color="#4ade80"
        roughness={0.9}
        metalness={0}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
}

/**
 * Path strip connecting two points on the ground plane.
 */
function PathStrip({ from, to, width = 3.5 }) {
  const mid = useMemo(() => [
    (from[0] + to[0]) / 2,
    0.008,
    (from[2] + to[2]) / 2,
  ], [from, to]);

  const length = useMemo(
    () => Math.hypot(to[0] - from[0], to[2] - from[2]),
    [from, to],
  );

  const angle = useMemo(
    () => Math.atan2(to[0] - from[0], to[2] - from[2]),
    [from, to],
  );

  return (
    <mesh position={mid} rotation={[-Math.PI / 2, 0, -angle]} receiveShadow>
      <planeGeometry args={[width, length]} />
      <meshStandardMaterial
        color="#334155"
        roughness={0.92}
        metalness={0.06}
      />
    </mesh>
  );
}

/**
 * SmallBuilding — a low-poly pastel house with pyramid roof.
 */
function SmallBuilding({ position, color = "#fcd5ce", roofColor = "#e8a598", scale = 1 }) {
  return (
    <group position={position} scale={scale}>
      {/* Body */}
      <mesh position={[0, 1.0, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 2.0, 2.4]} />
        <meshStandardMaterial color={color} roughness={0.8} metalness={0.02} />
      </mesh>
      {/* Pyramid roof */}
      <mesh position={[0, 2.4, 0]} castShadow>
        <coneGeometry args={[1.9, 1.4, 4]} />
        <meshStandardMaterial color={roofColor} roughness={0.75} metalness={0.02} />
      </mesh>
      {/* Door */}
      <mesh position={[0, 0.5, 1.21]}>
        <boxGeometry args={[0.6, 1.0, 0.05]} />
        <meshStandardMaterial color="#7c3aed" roughness={0.6} />
      </mesh>
    </group>
  );
}

const BUILDINGS = [
  { pos: [-30, 0, 5],  color: "#fde8d8", roofColor: "#f4a77e", scale: 0.9 },
  { pos: [30, 0, 10],  color: "#d8f3dc", roofColor: "#80b589", scale: 1.1 },
  { pos: [10, 0, -30], color: "#caf0f8", roofColor: "#5eb8d4", scale: 0.85 },
  { pos: [-30, 0, -25],color: "#ffd6e7", roofColor: "#e88aaa", scale: 1.0 },
  { pos: [35, 0, -25], color: "#e8dff5", roofColor: "#9c7dbf", scale: 1.2 },
  { pos: [-35, 0, 30], color: "#fffde7", roofColor: "#d4ac42", scale: 0.8 },
  { pos: [20, 0, 35],  color: "#fce4ec", roofColor: "#e06080", scale: 1.05 },
  { pos: [-10, 0, -35],color: "#e3f2fd", roofColor: "#5a9fd4", scale: 0.95 },
];

export default function Ground() {
  const half = ISLAND_SIZE / 2;

  // Connect center to each landmark, plus ring the outer ones
  const paths = useMemo(() => [
    [LANDMARKS_POS[4], LANDMARKS_POS[0]],
    [LANDMARKS_POS[4], LANDMARKS_POS[1]],
    [LANDMARKS_POS[4], LANDMARKS_POS[2]],
    [LANDMARKS_POS[4], LANDMARKS_POS[3]],
    [LANDMARKS_POS[0], LANDMARKS_POS[3]],
    [LANDMARKS_POS[1], LANDMARKS_POS[2]],
  ], []);

  return (
    <group>
      {/* Main ground — physics-backed */}
      <RigidBody type="fixed" colliders={false} friction={0.85} restitution={0}>
        <CuboidCollider
          args={[half, ISLAND_THICKNESS / 2, half]}
          position={[0, -ISLAND_THICKNESS / 2, 0]}
        />
        {/* Base ground plane — rich green */}
        <mesh
          position={[0, -ISLAND_THICKNESS / 2, 0]}
          receiveShadow
        >
          <boxGeometry args={[ISLAND_SIZE, ISLAND_THICKNESS, ISLAND_SIZE]} />
          <meshStandardMaterial
            color="#3a5a40"
            roughness={0.88}
            metalness={0.05}
          />
        </mesh>

        {/* Top turf layer — bright grass */}
        <mesh position={[0, 0.01, 0]} receiveShadow>
          <boxGeometry args={[ISLAND_SIZE - 0.4, 0.06, ISLAND_SIZE - 0.4]} />
          <meshStandardMaterial
            color="#52b788"
            roughness={0.85}
            metalness={0.02}
          />
        </mesh>
      </RigidBody>

      {/* Visual paths connecting landmarks */}
      {paths.map(([from, to], i) => (
        <PathStrip key={i} from={from} to={to} width={3.5} />
      ))}

      {/* Grass blades */}
      <GrassField count={700} />

      {/* Decorative low-poly buildings */}
      {BUILDINGS.map((b, i) => (
        <SmallBuilding
          key={i}
          position={b.pos}
          color={b.color}
          roofColor={b.roofColor}
          scale={b.scale}
        />
      ))}

      {/* Subtle outer edge ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <ringGeometry args={[half - 1.5, half - 1.2, 96]} />
        <meshBasicMaterial color="#a3e635" transparent opacity={0.15} />
      </mesh>

      {/* Invisible boundary walls */}
      {[
        { pos: [0, WALL_HEIGHT / 2, half],  args: [half, WALL_HEIGHT / 2, 0.4] },
        { pos: [0, WALL_HEIGHT / 2, -half], args: [half, WALL_HEIGHT / 2, 0.4] },
        { pos: [half, WALL_HEIGHT / 2, 0],  args: [0.4, WALL_HEIGHT / 2, half] },
        { pos: [-half, WALL_HEIGHT / 2, 0], args: [0.4, WALL_HEIGHT / 2, half] },
      ].map((w, i) => (
        <RigidBody key={i} type="fixed" colliders={false}>
          <CuboidCollider args={w.args} position={w.pos} />
        </RigidBody>
      ))}
    </group>
  );
}
