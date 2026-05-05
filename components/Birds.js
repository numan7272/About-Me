"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * A single procedural bird:
 *   - small dark sphere body
 *   - two thin plane wings flapping around the bird's local Z (forward) axis
 *   - flies a circular path around the island, banking with `lookAt`
 */
function Bird({
  phase,
  radius,
  height,
  speed,
  flapRate = 5.2,
  size = 1,
}) {
  const groupRef     = useRef();
  const leftWingRef  = useRef();
  const rightWingRef = useRef();

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    // Wing flap — symmetric mirror around bird's forward axis (local Z)
    const flap = Math.sin(t * flapRate + phase) * 0.7;
    if (leftWingRef.current)  leftWingRef.current.rotation.z  =  flap;
    if (rightWingRef.current) rightWingRef.current.rotation.z = -flap;

    // Circular flight with mild vertical bob
    const a = t * speed + phase;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    const y = height + Math.sin(t * 0.45 + phase) * 1.2;

    if (groupRef.current) {
      groupRef.current.position.set(x, y, z);
      // Look slightly ahead along the orbit so the bird banks naturally
      const aheadX = Math.cos(a + 0.04) * radius;
      const aheadZ = Math.sin(a + 0.04) * radius;
      groupRef.current.lookAt(aheadX, y, aheadZ);
    }
  });

  return (
    <group ref={groupRef} scale={size}>
      {/* Body */}
      <mesh>
        <sphereGeometry args={[0.08, 8, 6]} />
        <meshStandardMaterial color="#1b1b22" roughness={0.85} metalness={0.0} />
      </mesh>

      {/* Wings — pivot at body, geometry offset to the side */}
      <group ref={leftWingRef}>
        <mesh position={[-0.42, 0, 0]}>
          <planeGeometry args={[0.85, 0.22]} />
          <meshBasicMaterial color="#1f1f28" side={THREE.DoubleSide} />
        </mesh>
      </group>
      <group ref={rightWingRef}>
        <mesh position={[0.42, 0, 0]}>
          <planeGeometry args={[0.85, 0.22]} />
          <meshBasicMaterial color="#1f1f28" side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* A tiny tail for silhouette */}
      <mesh position={[0, 0, 0.18]}>
        <coneGeometry args={[0.06, 0.18, 6]} />
        <meshStandardMaterial color="#1b1b22" roughness={0.85} />
      </mesh>
    </group>
  );
}

export default function Birds() {
  // Two loose flocks — five "main" birds in formation-ish, plus a lone
  // wanderer at a different altitude/speed.
  const flock = useMemo(
    () => [
      { phase: 0.00, radius: 56, height: 32, speed: 0.13, size: 1.0 },
      { phase: 0.35, radius: 58, height: 31, speed: 0.13, size: 0.95 },
      { phase: 0.55, radius: 54, height: 33, speed: 0.13, size: 0.9  },
      { phase: 0.85, radius: 60, height: 30, speed: 0.13, size: 1.05 },
      { phase: 1.15, radius: 53, height: 31, speed: 0.13, size: 0.85 },
      // Lone wanderer
      { phase: 2.80, radius: 46, height: 28, speed: 0.18, size: 1.1, flapRate: 6.0 },
    ],
    [],
  );

  return (
    <group>
      {flock.map((b, i) => (
        <Bird
          key={i}
          phase={b.phase}
          radius={b.radius}
          height={b.height}
          speed={b.speed}
          size={b.size}
          flapRate={b.flapRate}
        />
      ))}
    </group>
  );
}
