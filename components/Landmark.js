"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, Float } from "@react-three/drei";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";

/* -------------------- Model loaders (one per landmark type) ------------------- */

function GltfLandmark({ url, scale = 1 }) {
  const { scene } = useGLTF(url);

  useEffect(() => {
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.material) {
          // Awwwards polish — low roughness + crisp env reflections
          o.material.roughness = 0.12;
          o.material.metalness = 0.85;
          o.material.envMapIntensity = 1.5;
        }
      }
    });
  }, [scene]);

  return <primitive object={scene} scale={scale} />;
}

useGLTF.preload("/haw-logo-transformed.glb");
useGLTF.preload("/designa-logo-transformed.glb");

/* ----------------------------- Kebab placeholder ----------------------------- */

function KebabShop({ color = "#fb923c", glow = "#ef4444" }) {
  return (
    <group>
      {/* Cylindrical kebab spit on a warm pedestal */}
      <mesh castShadow receiveShadow position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.95, 1.05, 0.9, 24]} />
        <meshStandardMaterial
          color="#3b2718"
          roughness={0.7}
          metalness={0.25}
        />
      </mesh>
      <mesh castShadow position={[0, 1.45, 0]}>
        <cylinderGeometry args={[0.55, 0.7, 1.1, 24]} />
        <meshStandardMaterial
          color={color}
          roughness={0.45}
          metalness={0.15}
          emissive={glow}
          emissiveIntensity={0.18}
        />
      </mesh>
      <mesh castShadow position={[0, 2.05, 0]}>
        <cylinderGeometry args={[0.18, 0.4, 0.4, 24]} />
        <meshStandardMaterial
          color="#fde68a"
          roughness={0.4}
          metalness={0.2}
          emissive="#fbbf24"
          emissiveIntensity={0.45}
        />
      </mesh>
      {/* spit rod */}
      <mesh castShadow position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 1.7, 12]} />
        <meshStandardMaterial color="#a3a3a3" metalness={0.85} roughness={0.25} />
      </mesh>
      {/* warm window glow */}
      <mesh position={[0, 0.6, 1.06]}>
        <planeGeometry args={[1.2, 0.5]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

/* --------------------------------- Landmark ---------------------------------- */

export default function Landmark({
  id,
  model,
  variant,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  colliderHalfExtents = [1.5, 1.5, 1.5],
  sensorHalfExtents = [3, 2.4, 3],
  color = "#22d3ee",
  glow = "#06b6d4",
  label,
  onEnter,
  onExit,
}) {
  const ringRef = useRef();
  const beaconRef = useRef();

  // Subtle ground ring + beacon throb to make landmarks readable from afar
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (ringRef.current) {
      ringRef.current.material.opacity = 0.25 + Math.sin(t * 1.6) * 0.12;
    }
    if (beaconRef.current) {
      const s = 1 + Math.sin(t * 2.2) * 0.05;
      beaconRef.current.scale.set(s, 1, s);
    }
  });

  return (
    <group position={position} rotation={rotation}>
      {/* Ground glow ring — shows the sensor radius */}
      <mesh
        ref={ringRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
      >
        <ringGeometry
          args={[
            Math.max(sensorHalfExtents[0], sensorHalfExtents[2]) - 0.25,
            Math.max(sensorHalfExtents[0], sensorHalfExtents[2]),
            64,
          ]}
        />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Soft vertical beacon */}
      <mesh ref={beaconRef} position={[0, 4, 0]}>
        <cylinderGeometry args={[0.06, 0.45, 8, 16, 1, true]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.18}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Solid body — bike collides with it */}
      <RigidBody
        type="fixed"
        colliders={false}
        friction={0.4}
        restitution={0.1}
      >
        <CuboidCollider
          args={colliderHalfExtents}
          position={[0, colliderHalfExtents[1], 0]}
        />

        {/* Sensor collider — fires when bike enters/exits */}
        <CuboidCollider
          args={sensorHalfExtents}
          position={[0, sensorHalfExtents[1], 0]}
          sensor
          onIntersectionEnter={({ other }) => {
            if (other.rigidBodyObject?.name === "player") onEnter?.(id);
          }}
          onIntersectionExit={({ other }) => {
            if (other.rigidBodyObject?.name === "player") onExit?.(id);
          }}
        />

        {/* Visual model — gentle float for life */}
        <Float
          speed={1.4}
          rotationIntensity={0.1}
          floatIntensity={0.45}
          floatingRange={[0, 0.18]}
        >
          <group position={[0, colliderHalfExtents[1] + 0.5, 0]}>
            {variant === "kebab" ? (
              <KebabShop color={color} glow={glow} />
            ) : (
              <GltfLandmark url={model} />
            )}
          </group>
        </Float>
      </RigidBody>

      {/* Optional 3D label baseplate (subtle) */}
      {label && (
        <mesh position={[0, 0.04, sensorHalfExtents[2] + 0.3]}>
          <boxGeometry args={[2.4, 0.08, 0.6]} />
          <meshStandardMaterial
            color="#0f172a"
            metalness={0.4}
            roughness={0.6}
            emissive={glow}
            emissiveIntensity={0.18}
          />
        </mesh>
      )}
    </group>
  );
}
