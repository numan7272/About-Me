"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Float, Html } from "@react-three/drei";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";

// ─────────────────────────────────────────────────────────────────────────────
// House — Homebase HQ
// ─────────────────────────────────────────────────────────────────────────────
function House({ color = "#f472b6", glowColor = "#ec4899" }) {
  const winRef = useRef();
  useFrame((s) => {
    if (!winRef.current) return;
    const ei = 0.55 + Math.sin(s.clock.getElapsedTime() * 1.3) * 0.15;
    winRef.current.children.forEach((c) => {
      if (c.material) c.material.emissiveIntensity = ei;
    });
  });
  return (
    <group>
      {/* Body */}
      <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 3.0, 2.8]} />
        <meshStandardMaterial color="#fde8f0" roughness={0.7} metalness={0.0} />
      </mesh>
      {/* Roof */}
      <mesh position={[0, 3.5, 0]} castShadow>
        <coneGeometry args={[2.4, 1.8, 4, 1]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.1} />
      </mesh>
      {/* Door */}
      <mesh position={[0, 0.75, 1.41]} castShadow>
        <boxGeometry args={[0.7, 1.5, 0.08]} />
        <meshStandardMaterial color="#92400e" roughness={0.8} metalness={0.1} />
      </mesh>
      {/* Windows */}
      <group ref={winRef}>
        {[[-0.95, 1.8, 1.41],[0.95, 1.8, 1.41]].map(([x,y,z], i) => (
          <mesh key={i} position={[x,y,z]}>
            <boxGeometry args={[0.7, 0.65, 0.08]} />
            <meshStandardMaterial color="#fef3c7" emissive="#fbbf24" emissiveIntensity={0.55} roughness={0.3} metalness={0.1} />
          </mesh>
        ))}
      </group>
      {/* Chimney */}
      <mesh position={[0.9, 4.0, -0.4]} castShadow>
        <boxGeometry args={[0.4, 1.0, 0.4]} />
        <meshStandardMaterial color="#b45309" roughness={0.9} metalness={0.0} />
      </mesh>
      {/* Glow ring */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.02,0]}>
        <ringGeometry args={[1.8,2.2,32]} />
        <meshBasicMaterial color={glowColor} transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SchoolBuilding — Thor Heyerdahl Gymnasium
// ─────────────────────────────────────────────────────────────────────────────
function SchoolBuilding({ color = "#a78bfa", glowColor = "#7c3aed" }) {
  const winsRef = useRef();
  useFrame((s) => {
    if (!winsRef.current) return;
    winsRef.current.children.forEach((w, i) => {
      if (w.material) w.material.emissiveIntensity = 0.3 + Math.sin(s.clock.getElapsedTime() * 0.8 + i * 0.4) * 0.08;
    });
  });
  const winPositions = [
    [-2.1,3.2,2.01],[-0.7,3.2,2.01],[0.7,3.2,2.01],[2.1,3.2,2.01],
    [-2.1,1.8,2.01],[-0.7,1.8,2.01],[0.7,1.8,2.01],[2.1,1.8,2.01],
  ];
  return (
    <group>
      {/* Main block */}
      <mesh position={[0,2.5,0]} castShadow receiveShadow>
        <boxGeometry args={[6.0,5.0,4.0]} />
        <meshStandardMaterial color="#e0e7ff" roughness={0.6} metalness={0.1} />
      </mesh>
      {/* Roof parapet */}
      <mesh position={[0,5.15,0]} castShadow>
        <boxGeometry args={[6.3,0.3,4.3]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.2} />
      </mesh>
      {/* Side wing */}
      <mesh position={[4.2,1.8,0]} castShadow receiveShadow>
        <boxGeometry args={[2.4,3.6,3.5]} />
        <meshStandardMaterial color="#c7d2fe" roughness={0.65} metalness={0.08} />
      </mesh>
      {/* Entrance canopy */}
      <mesh position={[0,1.2,2.6]} castShadow>
        <boxGeometry args={[2.0,0.18,1.0]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Canopy supports */}
      {[[-0.85],[0.85]].map(([x],i) => (
        <mesh key={i} position={[x,0.6,2.95]} castShadow>
          <cylinderGeometry args={[0.06,0.06,1.2,6]} />
          <meshStandardMaterial color="#6d28d9" roughness={0.5} metalness={0.5} />
        </mesh>
      ))}
      {/* Windows */}
      <group ref={winsRef}>
        {winPositions.map(([x,y,z],i) => (
          <mesh key={i} position={[x,y,z]}>
            <boxGeometry args={[0.9,0.75,0.08]} />
            <meshStandardMaterial color="#e0f2fe" emissive="#7dd3fc" emissiveIntensity={0.3} roughness={0.1} metalness={0.2} />
          </mesh>
        ))}
      </group>
      {/* Flag pole */}
      <mesh position={[-3.5,6.5,0]} castShadow>
        <cylinderGeometry args={[0.05,0.05,4.0,6]} />
        <meshStandardMaterial color="#9ca3af" roughness={0.4} metalness={0.8} />
      </mesh>
      {/* Flag */}
      <mesh position={[-2.65,8.0,0]}>
        <boxGeometry args={[1.7,0.9,0.04]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} roughness={0.8} metalness={0.0} side={THREE.DoubleSide} />
      </mesh>
      {/* Glow ring */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.02,0]}>
        <ringGeometry args={[3.2,3.6,48]} />
        <meshBasicMaterial color={glowColor} transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic glowing beacon (sphere / diamond / box fallback)
// ─────────────────────────────────────────────────────────────────────────────
function ProceduralLandmark({ color = "#22d3ee", shape = "box" }) {
  const meshRef = useRef();
  useFrame((s) => {
    if (meshRef.current) meshRef.current.material.emissiveIntensity = 0.4 + Math.sin(s.clock.getElapsedTime() * 2) * 0.15;
  });
  return (
    <group>
      {shape === "sphere" ? (
        <mesh ref={meshRef} position={[0,2,0]} castShadow>
          <sphereGeometry args={[1.2,32,32]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} roughness={0.2} metalness={0.8} />
        </mesh>
      ) : shape === "diamond" ? (
        <mesh ref={meshRef} position={[0,2.5,0]} castShadow>
          <octahedronGeometry args={[1.4,0]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} roughness={0.1} metalness={0.9} />
        </mesh>
      ) : (
        <mesh ref={meshRef} position={[0,2,0]} castShadow>
          <boxGeometry args={[1.5,3.0,1.5]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} roughness={0.3} metalness={0.7} />
        </mesh>
      )}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GLB model loader
// ─────────────────────────────────────────────────────────────────────────────
function GltfLandmark({ url, scale = 1, glossy = true }) {
  const { scene } = useGLTF(url);
  useEffect(() => {
    scene.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      if (o.material) {
        if (glossy) { o.material.roughness = 0.12; o.material.metalness = 0.85; o.material.envMapIntensity = 1.5; }
        else o.material.envMapIntensity = 1.0;
      }
    });
  }, [scene, glossy]);
  return <primitive object={scene} scale={scale} />;
}

useGLTF.preload("/haw-logo-transformed.glb");
useGLTF.preload("/designa-logo-transformed.glb");
useGLTF.preload("/yekdoener-transformed.glb");

// ─────────────────────────────────────────────────────────────────────────────
// Click zone — invisible mesh that catches pointer events
// ─────────────────────────────────────────────────────────────────────────────
function ClickZone({ halfExtents, height, onClick }) {
  return (
    <mesh
      position={[0, height / 2, 0]}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={()  => (document.body.style.cursor = "auto")}
    >
      <boxGeometry args={[halfExtents[0]*2, height, halfExtents[2]*2]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Landmark
// proceduralShape: "house" | "school" | "sphere" | "diamond" | "box"
// ─────────────────────────────────────────────────────────────────────────────
export default function Landmark({
  id,
  model,
  proceduralShape,
  position   = [0,0,0],
  rotation   = [0,0,0],
  colliderHalfExtents = [1.5,1.5,1.5],
  sensorHalfExtents   = [4,2.8,4],
  color     = "#22d3ee",
  glow      = "#06b6d4",
  label,
  glossy    = true,
  floating  = true,
  modelScale   = 8,
  modelYOffset = 0,
  onEnter,
  onExit,
  onClickOpen,   // NEW: called with id when user clicks the landmark
}) {
  const ringRef   = useRef();
  const beaconRef = useRef();

  useFrame((s) => {
    const t = s.clock.getElapsedTime();
    if (ringRef.current)   ringRef.current.material.opacity = 0.22 + Math.sin(t*1.6)*0.1;
    if (beaconRef.current) { const sc=1+Math.sin(t*2.2)*0.05; beaconRef.current.scale.set(sc,1,sc); }
  });

  const renderVisual = () => {
    if (model) {
      const inner = <GltfLandmark url={model} scale={modelScale} glossy={glossy} />;
      return floating ? (
        <Float speed={1.4} rotationIntensity={0.1} floatIntensity={0.45} floatingRange={[0,0.18]}>
          <group position={[0, colliderHalfExtents[1]+0.5+modelYOffset, 0]}>{inner}</group>
        </Float>
      ) : (
        <group position={[0, modelYOffset, 0]}>{inner}</group>
      );
    }
    if (proceduralShape === "house")  return <group position={[0,modelYOffset,0]}><House  color={color} glowColor={glow} /></group>;
    if (proceduralShape === "school") return <group position={[0,modelYOffset,0]}><SchoolBuilding color={color} glowColor={glow} /></group>;
    return (
      <Float speed={1.2} rotationIntensity={0.2} floatIntensity={0.6}>
        <group position={[0,modelYOffset,0]}>
          <ProceduralLandmark color={color} shape={proceduralShape ?? "box"} />
        </group>
      </Float>
    );
  };

  return (
    <group position={position} rotation={rotation}>
      {/* Ground glow ring */}
      <mesh ref={ringRef} rotation={[-Math.PI/2,0,0]} position={[0,0.02,0]}>
        <ringGeometry args={[
          Math.max(sensorHalfExtents[0],sensorHalfExtents[2])-0.3,
          Math.max(sensorHalfExtents[0],sensorHalfExtents[2]),
          64,
        ]} />
        <meshBasicMaterial color={color} transparent opacity={0.28} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Vertical beacon */}
      <mesh ref={beaconRef} position={[0,5,0]}>
        <cylinderGeometry args={[0.06,0.5,10,16,1,true]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      {/* Physics + sensor */}
      <RigidBody type="fixed" colliders={false} friction={0.4} restitution={0.1}>
        <CuboidCollider args={colliderHalfExtents} position={[0,colliderHalfExtents[1],0]} />
        <CuboidCollider
          args={sensorHalfExtents}
          position={[0,sensorHalfExtents[1],0]}
          sensor
          onIntersectionEnter={({other}) => { if (other.rigidBodyObject?.name==="player") onEnter?.(id); }}
          onIntersectionExit={({other})  => { if (other.rigidBodyObject?.name==="player") onExit?.(id);  }}
        />

        {/* Visual */}
        {renderVisual()}

        {/* Invisible click catcher — whole landmark is clickable */}
        <ClickZone
          halfExtents={colliderHalfExtents}
          height={colliderHalfExtents[1]*3}
          onClick={() => onClickOpen?.(id)}
        />
      </RigidBody>

      {label && (
        <mesh position={[0,0.04,sensorHalfExtents[2]+0.3]}>
          <boxGeometry args={[2.8,0.08,0.7]} />
          <meshStandardMaterial color="#0f172a" metalness={0.4} roughness={0.6} emissive={glow} emissiveIntensity={0.2} />
        </mesh>
      )}
    </group>
  );
}
