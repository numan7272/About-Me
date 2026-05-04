"use client";

import { useMemo } from "react";
import { RigidBody, CuboidCollider } from "@react-three/rapier";

/**
 * Static, performance-cheap props that make the island feel inhabited:
 * stylized low-poly trees, lampposts and a few rocks. Each gets a fixed
 * collider so the bike can bump into them — but they're sparse enough
 * that the player isn't fenced in.
 */

const TREES = [
  [-18, 0, 4],
  [-16, 0, 16],
  [-22, 0, -2],
  [-7, 0, 18],
  [-9, 0, -18],
  [9, 0, 18],
  [18, 0, 4],
  [22, 0, 14],
  [20, 0, -16],
  [6, 0, -20],
  [-2, 0, -16],
  [13, 0, 16],
];

const LAMPS = [
  [-6, 0, 6],
  [6, 0, 6],
  [-6, 0, -6],
  [6, 0, -6],
  [0, 0, 16],
  [-16, 0, 0],
  [16, 0, 0],
];

const ROCKS = [
  [-23, 0, 8],
  [23, 0, -8],
  [-3, 0, 22],
  [3, 0, -22],
];

function Tree({ position }) {
  return (
    <RigidBody type="fixed" colliders={false} position={position}>
      <CuboidCollider args={[0.18, 0.5, 0.18]} position={[0, 0.5, 0]} />
      <group>
        <mesh castShadow position={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.1, 0.13, 0.9, 8]} />
          <meshStandardMaterial color="#5a361c" roughness={0.95} />
        </mesh>
        <mesh castShadow position={[0, 1.4, 0]}>
          <coneGeometry args={[0.55, 1.5, 8]} />
          <meshStandardMaterial color="#0f5132" roughness={0.85} />
        </mesh>
        <mesh castShadow position={[0, 2.0, 0]}>
          <coneGeometry args={[0.38, 1.0, 8]} />
          <meshStandardMaterial color="#16a34a" roughness={0.85} />
        </mesh>
      </group>
    </RigidBody>
  );
}

function Lamp({ position }) {
  return (
    <RigidBody type="fixed" colliders={false} position={position}>
      <CuboidCollider args={[0.08, 1.4, 0.08]} position={[0, 1.4, 0]} />
      <mesh castShadow position={[0, 1.3, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 2.6, 8]} />
        <meshStandardMaterial color="#1f2937" metalness={0.6} roughness={0.45} />
      </mesh>
      <mesh castShadow position={[0.18, 2.55, 0]}>
        <boxGeometry args={[0.45, 0.08, 0.18]} />
        <meshStandardMaterial color="#27272a" metalness={0.6} roughness={0.45} />
      </mesh>
      <mesh position={[0.4, 2.45, 0]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial
          color="#fde68a"
          emissive="#fbbf24"
          emissiveIntensity={2.4}
          toneMapped={false}
        />
      </mesh>
      <pointLight
        position={[0.4, 2.45, 0]}
        intensity={0.35}
        distance={6}
        color="#fbbf24"
        castShadow={false}
      />
    </RigidBody>
  );
}

function Rock({ position, seed = 0 }) {
  const variant = useMemo(() => {
    return {
      sx: 1 + ((seed * 1.7) % 0.6),
      sy: 0.6 + ((seed * 0.6) % 0.4),
      sz: 1 + ((seed * 1.1) % 0.5),
      ry: ((seed * 31) % 360) * (Math.PI / 180),
    };
  }, [seed]);

  return (
    <RigidBody type="fixed" colliders={false} position={position}>
      <CuboidCollider
        args={[0.45 * variant.sx, 0.35, 0.45 * variant.sz]}
        position={[0, 0.35, 0]}
      />
      <mesh
        castShadow
        receiveShadow
        position={[0, 0.32, 0]}
        rotation={[0, variant.ry, 0]}
      >
        <dodecahedronGeometry args={[0.55]} />
        <meshStandardMaterial
          color="#3a4253"
          roughness={0.95}
          metalness={0.05}
        />
      </mesh>
    </RigidBody>
  );
}

export default function Decorations() {
  return (
    <group>
      {TREES.map((p, i) => (
        <Tree key={`t-${i}`} position={p} />
      ))}
      {LAMPS.map((p, i) => (
        <Lamp key={`l-${i}`} position={p} />
      ))}
      {ROCKS.map((p, i) => (
        <Rock key={`r-${i}`} position={p} seed={i + 1} />
      ))}
    </group>
  );
}
