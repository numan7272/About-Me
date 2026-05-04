"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, Float } from "@react-three/drei";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";

/* -------------------- Model loader (works for any landmark) ------------------ */

function GltfLandmark({ url, scale = 1, glossy = true }) {
  const { scene } = useGLTF(url);

  useEffect(() => {
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.material) {
          if (glossy) {
            // Awwwards polish — chrome-y logos that catch the HDRI
            o.material.roughness = 0.12;
            o.material.metalness = 0.85;
            o.material.envMapIntensity = 1.5;
          } else {
            // Natural materials (e.g. the kebab shop) — don't override
            // baked roughness/metalness, just bump env response a touch.
            o.material.envMapIntensity = 1.0;
          }
        }
      }
    });
  }, [scene, glossy]);

  return <primitive object={scene} scale={scale} />;
}

useGLTF.preload("/haw-logo-transformed.glb");
useGLTF.preload("/designa-logo-transformed.glb");
useGLTF.preload("/yekdoener-transformed.glb");

/* --------------------------------- Landmark ---------------------------------- */

export default function Landmark({
  id,
  model,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  colliderHalfExtents = [1.5, 1.5, 1.5],
  sensorHalfExtents = [3, 2.4, 3],
  color = "#22d3ee",
  glow = "#06b6d4",
  label,
  /** Apply chrome-y PBR override (true) or keep the model's baked materials (false). */
  glossy = true,
  /** Floating + bobbing model (logos) vs. grounded building (kebab shop). */
  floating = true,
  /** Visual scale for the GLB. */
  modelScale = 1,
  /** Extra Y offset for the visual model relative to the body. */
  modelYOffset = 0,
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

        {/* Visual model — float for floating logos, grounded for buildings */}
        {floating ? (
          <Float
            speed={1.4}
            rotationIntensity={0.1}
            floatIntensity={0.45}
            floatingRange={[0, 0.18]}
          >
            <group
              position={[0, colliderHalfExtents[1] + 0.5 + modelYOffset, 0]}
            >
              <GltfLandmark url={model} scale={modelScale} glossy={glossy} />
            </group>
          </Float>
        ) : (
          <group position={[0, modelYOffset, 0]}>
            <GltfLandmark url={model} scale={modelScale} glossy={glossy} />
          </group>
        )}
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
