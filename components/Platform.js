"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Grid, MeshReflectorMaterial } from "@react-three/drei";

/**
 * Cyberpunk infinite grid floor with subtle reflection.
 */
export default function Platform() {
  const rimRef = useRef();

  useFrame(({ clock }) => {
    if (rimRef.current) {
      rimRef.current.material.opacity =
        0.18 + Math.sin(clock.getElapsedTime() * 1.4) * 0.06;
    }
  });

  return (
    <group>
      {/* Dark reflective base plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <MeshReflectorMaterial
          blur={[400, 80]}
          resolution={512}
          mixBlur={0.9}
          mixStrength={30}
          roughness={1}
          depthScale={1.1}
          minDepthThreshold={0.45}
          maxDepthThreshold={1.35}
          color="#060810"
          metalness={0.6}
        />
      </mesh>

      {/* Cyan grid overlay */}
      <Grid
        position={[0, 0.001, 0]}
        args={[60, 60]}
        cellSize={1}
        cellThickness={0.4}
        cellColor="#0c2a38"
        sectionSize={5}
        sectionThickness={0.8}
        sectionColor="#0e4056"
        fadeDistance={28}
        fadeStrength={1.4}
        followCamera={false}
        infiniteGrid={false}
      />

      {/* Subtle central glow disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <circleGeometry args={[7, 64]} />
        <meshBasicMaterial
          color="#22d3ee"
          transparent
          opacity={0.025}
          toneMapped={false}
        />
      </mesh>

      {/* Animated pulsing outer ring */}
      <mesh ref={rimRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
        <ringGeometry args={[6.8, 7.0, 96]} />
        <meshBasicMaterial
          color="#22d3ee"
          transparent
          opacity={0.18}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
