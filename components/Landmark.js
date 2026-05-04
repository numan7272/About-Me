"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, Float } from "@react-three/drei";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";

/**
 * Procedural landmark used when no GLB model is supplied.
 * Renders a glowing pillar/beacon with optional shape variation.
 */
function ProceduralLandmark({ color = "#22d3ee", shape = "box" }) {
  const meshRef = useRef();
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.material.emissiveIntensity =
        0.4 + Math.sin(state.clock.getElapsedTime() * 2) * 0.15;
    }
  });
  return (
    <group>
      {shape === "sphere" ? (
        <mesh ref={meshRef} position={[0, 2, 0]} castShadow>
          <sphereGeometry args={[1.2, 32, 32]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.4}
            roughness={0.2}
            metalness={0.8}
          />
        </mesh>
      ) : shape === "diamond" ? (
        <mesh ref={meshRef} position={[0, 2.5, 0]} castShadow rotation={[0, 0, 0]}>
          <octahedronGeometry args={[1.4, 0]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.4}
            roughness={0.1}
            metalness={0.9}
          />
        </mesh>
      ) : (
        <mesh ref={meshRef} position={[0, 2, 0]} castShadow>
          <boxGeometry args={[1.5, 3.0, 1.5]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.4}
            roughness={0.3}
            metalness={0.7}
          />
        </mesh>
      )}
    </group>
  );
}

/**
 * GLB model loader with PBR polish.
 */
function GltfLandmark({ url, scale = 1, glossy = true }) {
  const { scene } = useGLTF(url);

  useEffect(() => {
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.material) {
          if (glossy) {
            o.material.roughness = 0.12;
            o.material.metalness = 0.85;
            o.material.envMapIntensity = 1.5;
          } else {
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

export default function Landmark({
  id,
  model,
  proceduralShape,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  colliderHalfExtents = [1.5, 1.5, 1.5],
  sensorHalfExtents = [4, 2.8, 4],
  color = "#22d3ee",
  glow = "#06b6d4",
  label,
  glossy = true,
  floating = true,
  modelScale = 8,
  modelYOffset = 0,
  onEnter,
  onExit,
}) {
  const ringRef = useRef();
  const beaconRef = useRef();

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (ringRef.current) {
      ringRef.current.material.opacity = 0.22 + Math.sin(t * 1.6) * 0.1;
    }
    if (beaconRef.current) {
      const s = 1 + Math.sin(t * 2.2) * 0.05;
      beaconRef.current.scale.set(s, 1, s);
    }
  });

  return (
    <group position={position} rotation={rotation}>
      {/* Ground glow ring */}
      <mesh
        ref={ringRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
      >
        <ringGeometry
          args={[
            Math.max(sensorHalfExtents[0], sensorHalfExtents[2]) - 0.3,
            Math.max(sensorHalfExtents[0], sensorHalfExtents[2]),
            64,
          ]}
        />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.28}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Vertical beacon */}
      <mesh ref={beaconRef} position={[0, 5, 0]}>
        <cylinderGeometry args={[0.06, 0.5, 10, 16, 1, true]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.15}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Physics body */}
      <RigidBody type="fixed" colliders={false} friction={0.4} restitution={0.1}>
        <CuboidCollider
          args={colliderHalfExtents}
          position={[0, colliderHalfExtents[1], 0]}
        />

        {/* Sensor collider — triggers UI */}
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

        {/* Visual model or procedural beacon */}
        {model ? (
          floating ? (
            <Float
              speed={1.4}
              rotationIntensity={0.1}
              floatIntensity={0.45}
              floatingRange={[0, 0.18]}
            >
              <group position={[0, colliderHalfExtents[1] + 0.5 + modelYOffset, 0]}>
                <GltfLandmark url={model} scale={modelScale} glossy={glossy} />
              </group>
            </Float>
          ) : (
            <group position={[0, modelYOffset, 0]}>
              <GltfLandmark url={model} scale={modelScale} glossy={glossy} />
            </group>
          )
        ) : (
          <Float speed={1.2} rotationIntensity={0.2} floatIntensity={0.6}>
            <group position={[0, modelYOffset, 0]}>
              <ProceduralLandmark color={color} shape={proceduralShape ?? "box"} />
            </group>
          </Float>
        )}
      </RigidBody>

      {label && (
        <mesh position={[0, 0.04, sensorHalfExtents[2] + 0.3]}>
          <boxGeometry args={[2.8, 0.08, 0.7]} />
          <meshStandardMaterial
            color="#0f172a"
            metalness={0.4}
            roughness={0.6}
            emissive={glow}
            emissiveIntensity={0.2}
          />
        </mesh>
      )}
    </group>
  );
}
