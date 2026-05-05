"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, Float } from "@react-three/drei";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";

// ─────────────────────────────────────────────────────────────────────────────
// HOUSE — used for Homebase
// ─────────────────────────────────────────────────────────────────────────────
function House({ color = "#f472b6", glowColor = "#ec4899" }) {
  const winRef = useRef();
  useFrame((s) => {
    if (!winRef.current) return;
    const ei = 0.55 + Math.sin(s.clock.getElapsedTime() * 1.3) * 0.15;
    winRef.current.children.forEach((c) => {
      if (c.isMesh && c.material) c.material.emissiveIntensity = ei;
    });
  });
  return (
    <group>
      <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 3.0, 2.8]} />
        <meshStandardMaterial color="#fde8f0" roughness={0.7} metalness={0.0} />
      </mesh>
      <mesh position={[0, 3.5, 0]} castShadow>
        <coneGeometry args={[2.4, 1.8, 4, 1]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.75, 1.41]} castShadow>
        <boxGeometry args={[0.7, 1.5, 0.08]} />
        <meshStandardMaterial color="#92400e" roughness={0.8} metalness={0.1} />
      </mesh>
      <group ref={winRef}>
        {[[-0.95, 1.8, 1.41],[0.95, 1.8, 1.41]].map(([x, y, z], i) => (
          <mesh key={i} position={[x, y, z]}>
            <boxGeometry args={[0.7, 0.65, 0.08]} />
            <meshStandardMaterial
              color="#fef3c7" emissive="#fbbf24" emissiveIntensity={0.55}
              roughness={0.3} metalness={0.1}
            />
          </mesh>
        ))}
      </group>
      <mesh position={[0.9, 4.0, -0.4]} castShadow>
        <boxGeometry args={[0.4, 1.0, 0.4]} />
        <meshStandardMaterial color="#b45309" roughness={0.9} metalness={0.0} />
      </mesh>
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[1.8, 2.2, 32]} />
        <meshBasicMaterial color={glowColor} transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHOOL BUILDING
// ─────────────────────────────────────────────────────────────────────────────
function SchoolBuilding({ color = "#a78bfa", glowColor = "#7c3aed" }) {
  const winsRef = useRef();
  useFrame((s) => {
    if (!winsRef.current) return;
    const elapsed = s.clock.getElapsedTime();
    winsRef.current.children.forEach((w, i) => {
      if (w.isMesh && w.material) {
        w.material.emissiveIntensity = 0.3 + Math.sin(elapsed * 0.8 + i * 0.4) * 0.08;
      }
    });
  });

  const winPositions = [
    [-2.1, 3.2, 2.01], [-0.7, 3.2, 2.01], [0.7, 3.2, 2.01], [2.1, 3.2, 2.01],
    [-2.1, 1.8, 2.01], [-0.7, 1.8, 2.01], [0.7, 1.8, 2.01], [2.1, 1.8, 2.01],
  ];

  return (
    <group>
      <mesh position={[0, 2.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[6.0, 5.0, 4.0]} />
        <meshStandardMaterial color="#e0e7ff" roughness={0.6} metalness={0.1} />
      </mesh>
      <mesh position={[0, 5.15, 0]} castShadow>
        <boxGeometry args={[6.3, 0.3, 4.3]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.2} />
      </mesh>
      <mesh position={[4.2, 1.8, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 3.6, 3.5]} />
        <meshStandardMaterial color="#c7d2fe" roughness={0.65} metalness={0.08} />
      </mesh>
      <mesh position={[0, 1.2, 2.6]} castShadow>
        <boxGeometry args={[2.0, 0.18, 1.0]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.3} />
      </mesh>
      {[[-0.85], [0.85]].map(([x], i) => (
        <mesh key={i} position={[x, 0.6, 2.95]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 1.2, 6]} />
          <meshStandardMaterial color="#6d28d9" roughness={0.5} metalness={0.5} />
        </mesh>
      ))}
      <group ref={winsRef}>
        {winPositions.map(([x, y, z], i) => (
          <mesh key={i} position={[x, y, z]}>
            <boxGeometry args={[0.9, 0.75, 0.08]} />
            <meshStandardMaterial
              color="#e0f2fe" emissive="#7dd3fc" emissiveIntensity={0.3}
              roughness={0.1} metalness={0.2}
            />
          </mesh>
        ))}
      </group>
      {/* Flagpole — sits on the actual roof. Building footprint is
          x ∈ [-3,3], z ∈ [-2,2]; roof top is at y = 5.3, so a 4-unit pole
          centred at y = 7.3 has its base resting on the roof. */}
      <mesh position={[2.0, 7.3, -1.5]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 4.0, 6]} />
        <meshStandardMaterial color="#9ca3af" roughness={0.4} metalness={0.8} />
      </mesh>
      <mesh position={[2.85, 8.4, -1.5]}>
        <boxGeometry args={[1.7, 0.9, 0.04]} />
        <meshStandardMaterial
          color={color} emissive={color} emissiveIntensity={0.2}
          roughness={0.8} metalness={0.0} side={THREE.DoubleSide}
        />
      </mesh>
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[3.2, 3.6, 48]} />
        <meshBasicMaterial color={glowColor} transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERIC BEACON
// ─────────────────────────────────────────────────────────────────────────────
function ProceduralLandmark({ color = "#22d3ee", shape = "box" }) {
  const meshRef = useRef();
  useFrame((s) => {
    if (!meshRef.current) return;
    meshRef.current.material.emissiveIntensity =
      0.4 + Math.sin(s.clock.getElapsedTime() * 2) * 0.15;
  });
  return (
    <group>
      {shape === "sphere" ? (
        <mesh ref={meshRef} position={[0, 2, 0]} castShadow>
          <sphereGeometry args={[1.2, 32, 32]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} roughness={0.2} metalness={0.8} />
        </mesh>
      ) : shape === "diamond" ? (
        <mesh ref={meshRef} position={[0, 2.5, 0]} castShadow>
          <octahedronGeometry args={[1.4, 0]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} roughness={0.1} metalness={0.9} />
        </mesh>
      ) : (
        <mesh ref={meshRef} position={[0, 2, 0]} castShadow>
          <boxGeometry args={[1.5, 3.0, 1.5]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} roughness={0.3} metalness={0.7} />
        </mesh>
      )}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GLB loader
// ─────────────────────────────────────────────────────────────────────────────
function GltfLandmark({ url, scale = 1, glossy = true }) {
  const { scene } = useGLTF(url);
  useEffect(() => {
    scene.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow    = true;
      o.receiveShadow = true;
      if (o.material) {
        if (glossy) {
          o.material.roughness       = 0.12;
          o.material.metalness       = 0.85;
          o.material.envMapIntensity = 1.5;
        } else {
          o.material.envMapIntensity = 1.0;
        }
      }
    });
  }, [scene, glossy]);
  return <primitive object={scene} scale={scale} />;
}

useGLTF.preload("/haw-logo-transformed.glb");
useGLTF.preload("/designa-logo-transformed.glb");
// FIX #3: correct filename casing — must match exact filename in /public
useGLTF.preload("/yekdoener-transformed.glb");

// ─────────────────────────────────────────────────────────────────────────────
// CLICK ZONE
// FIX #4: use opacity={0} instead of visible={false} so raycaster still hits it
// ─────────────────────────────────────────────────────────────────────────────
function ClickZone({ halfExtents, clickHeight, onClick }) {
  return (
    <mesh
      position={[0, clickHeight / 2, 0]}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={()  => (document.body.style.cursor = "auto")}
    >
      <boxGeometry args={[halfExtents[0] * 2, clickHeight, halfExtents[2] * 2]} />
      {/* FIX #4: transparent + opacity 0 instead of visible={false} */}
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LANDMARK (main export)
// ─────────────────────────────────────────────────────────────────────────────
export default function Landmark({
  id,
  model,
  proceduralShape,
  position          = [0, 0, 0],
  rotation          = [0, 0, 0],
  colliderHalfExtents = [1.5, 1.5, 1.5],
  sensorHalfExtents   = [4, 2.8, 4],
  color      = "#22d3ee",
  glow       = "#06b6d4",
  label,
  glossy     = true,
  floating   = true,
  modelScale    = 8,
  modelYOffset  = 0,
  /**
   * If true, render colliders + sensor + click zone but skip the visual mesh.
   * Use it when the visual is rendered elsewhere (e.g. HAW logo lives in
   * Ground.js as a flat decal, not here).
   */
  hideVisual = false,
  onEnter,
  onExit,
  onClickOpen,
}) {
  const ringRef   = useRef();
  const beaconRef = useRef();

  useFrame((s) => {
    const t = s.clock.getElapsedTime();
    if (ringRef.current)   ringRef.current.material.opacity   = 0.22 + Math.sin(t * 1.6) * 0.1;
    if (beaconRef.current) {
      const sc = 1 + Math.sin(t * 2.2) * 0.05;
      beaconRef.current.scale.set(sc, 1, sc);
    }
  });

  const clickHeight = colliderHalfExtents[1] * 4;

  const renderVisual = () => {
    if (hideVisual) return null;
    if (model) {
      const inner = <GltfLandmark url={model} scale={modelScale} glossy={glossy} />;
      return floating ? (
        <Float speed={1.4} rotationIntensity={0.1} floatIntensity={0.45} floatingRange={[0, 0.18]}>
          <group position={[0, colliderHalfExtents[1] + 0.5 + modelYOffset, 0]}>{inner}</group>
        </Float>
      ) : (
        <group position={[0, modelYOffset, 0]}>{inner}</group>
      );
    }
    if (proceduralShape === "house")  return <group position={[0, modelYOffset, 0]}><House  color={color} glowColor={glow} /></group>;
    if (proceduralShape === "school") return <group position={[0, modelYOffset, 0]}><SchoolBuilding color={color} glowColor={glow} /></group>;
    return (
      <Float speed={1.2} rotationIntensity={0.2} floatIntensity={0.6}>
        <group position={[0, modelYOffset, 0]}>
          <ProceduralLandmark color={color} shape={proceduralShape ?? "box"} />
        </group>
      </Float>
    );
  };

  return (
    <group position={position} rotation={rotation}>
      <mesh ref={ringRef} rotation={[-Math.PI/2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[
          Math.max(sensorHalfExtents[0], sensorHalfExtents[2]) - 0.3,
          Math.max(sensorHalfExtents[0], sensorHalfExtents[2]),
          64,
        ]} />
        <meshBasicMaterial color={color} transparent opacity={0.28} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      <mesh ref={beaconRef} position={[0, 5, 0]}>
        <cylinderGeometry args={[0.06, 0.5, 10, 16, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      <RigidBody type="fixed" colliders={false} friction={0.4} restitution={0.1}>
        <CuboidCollider args={colliderHalfExtents} position={[0, colliderHalfExtents[1], 0]} />
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

        {renderVisual()}

        <ClickZone
          halfExtents={colliderHalfExtents}
          clickHeight={clickHeight}
          onClick={() => onClickOpen?.(id)}
        />
      </RigidBody>
    </group>
  );
}
