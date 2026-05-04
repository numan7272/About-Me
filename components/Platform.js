"use client";

import { RoundedBox } from "@react-three/drei";

/**
 * Floating, chamfered island that anchors the scene.
 * Slightly inset top deck on a darker base for depth.
 */
export default function Platform() {
  return (
    <group>
      {/* Base — darker chamfered slab */}
      <RoundedBox
        args={[10, 0.8, 10]}
        radius={0.18}
        smoothness={6}
        position={[0, -0.8, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color="#1f2937"
          metalness={0.25}
          roughness={0.85}
        />
      </RoundedBox>

      {/* Top deck — main walkable surface */}
      <RoundedBox
        args={[9.4, 0.4, 9.4]}
        radius={0.14}
        smoothness={6}
        position={[0, -0.2, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color="#27313f"
          metalness={0.15}
          roughness={0.75}
        />
      </RoundedBox>

      {/* Inner detail tile — subtle accent panel */}
      <RoundedBox
        args={[7.2, 0.04, 7.2]}
        radius={0.06}
        smoothness={4}
        position={[0, 0.005, 0]}
        receiveShadow
      >
        <meshStandardMaterial
          color="#334155"
          metalness={0.2}
          roughness={0.6}
          emissive="#0ea5e9"
          emissiveIntensity={0.04}
        />
      </RoundedBox>

      {/* Glow rim — subtle line of light around the deck */}
      <mesh position={[0, 0.005, 0]}>
        <ringGeometry args={[3.5, 3.55, 64]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.22} />
      </mesh>
    </group>
  );
}
