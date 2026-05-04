"use client";

import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { RoundedBox } from "@react-three/drei";

const ISLAND_SIZE = 50;
const ISLAND_THICKNESS = 1.4;
const WALL_HEIGHT = 4;

/**
 * Stylized floating-island ground plus invisible boundary walls so the
 * player cannot drive off the edge. All bodies are fixed.
 */
export default function Ground() {
  const half = ISLAND_SIZE / 2;

  return (
    <group>
      {/* Main ground — physics-backed */}
      <RigidBody type="fixed" colliders={false} friction={0.85} restitution={0}>
        <CuboidCollider
          args={[half, ISLAND_THICKNESS / 2, half]}
          position={[0, -ISLAND_THICKNESS / 2, 0]}
        />
        <RoundedBox
          args={[ISLAND_SIZE, ISLAND_THICKNESS, ISLAND_SIZE]}
          radius={0.35}
          smoothness={6}
          position={[0, -ISLAND_THICKNESS / 2, 0]}
          receiveShadow
          castShadow
        >
          <meshStandardMaterial
            color="#1c2230"
            roughness={0.78}
            metalness={0.18}
          />
        </RoundedBox>

        {/* Inset deck plate for visual depth */}
        <RoundedBox
          args={[ISLAND_SIZE - 1.5, 0.06, ISLAND_SIZE - 1.5]}
          radius={0.12}
          smoothness={4}
          position={[0, 0.005, 0]}
          receiveShadow
        >
          <meshStandardMaterial
            color="#28304a"
            roughness={0.62}
            metalness={0.24}
            emissive="#0ea5e9"
            emissiveIntensity={0.04}
          />
        </RoundedBox>
      </RigidBody>

      {/* Subtle accent ring */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.012, 0]}
        receiveShadow
      >
        <ringGeometry args={[half - 1.2, half - 1.05, 96]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.18} />
      </mesh>

      {/* Painted "roads" — purely decorative, no collider */}
      <RoadStrip position={[0, 0.012, 0]} length={ISLAND_SIZE - 4} />
      <RoadStrip
        position={[0, 0.012, 0]}
        length={ISLAND_SIZE - 4}
        rotation={[-Math.PI / 2, 0, Math.PI / 2]}
      />

      {/* Invisible boundary walls so the bike cannot fall off */}
      {[
        { pos: [0, WALL_HEIGHT / 2, half], args: [half, WALL_HEIGHT / 2, 0.4] },
        { pos: [0, WALL_HEIGHT / 2, -half], args: [half, WALL_HEIGHT / 2, 0.4] },
        { pos: [half, WALL_HEIGHT / 2, 0], args: [0.4, WALL_HEIGHT / 2, half] },
        { pos: [-half, WALL_HEIGHT / 2, 0], args: [0.4, WALL_HEIGHT / 2, half] },
      ].map((w, i) => (
        <RigidBody key={i} type="fixed" colliders={false}>
          <CuboidCollider args={w.args} position={w.pos} />
        </RigidBody>
      ))}
    </group>
  );
}

function RoadStrip({ position, rotation = [-Math.PI / 2, 0, 0], length = 40 }) {
  return (
    <mesh position={position} rotation={rotation} receiveShadow>
      <planeGeometry args={[length, 2.6]} />
      <meshStandardMaterial
        color="#0f1422"
        roughness={0.95}
        metalness={0.05}
      />
    </mesh>
  );
}
