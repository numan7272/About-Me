"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

import StationCard from "./StationCard";

/* -------------------------------------------------------------------------- */
/*  Shape primitives — distinct silhouettes per station theme                  */
/* -------------------------------------------------------------------------- */

function AcademicShape({ color, hovered }) {
  const emissive = hovered ? 0.55 : 0.22;
  return (
    <group>
      {/* main block */}
      <mesh castShadow receiveShadow position={[0, 0.55, 0]}>
        <boxGeometry args={[1.05, 1.1, 1.05]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissive}
          metalness={0.35}
          roughness={0.4}
        />
      </mesh>
      {/* pyramidal cap */}
      <mesh castShadow position={[0, 1.32, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.82, 0.5, 4]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissive + 0.1}
          metalness={0.4}
          roughness={0.35}
        />
      </mesh>
      {/* column accents */}
      {[
        [-0.42, 0.55, 0.55],
        [0.42, 0.55, 0.55],
      ].map((p, i) => (
        <mesh key={i} castShadow position={p}>
          <cylinderGeometry args={[0.06, 0.06, 1.1, 12]} />
          <meshStandardMaterial
            color="#e0f2fe"
            emissive="#67e8f9"
            emissiveIntensity={0.25}
          />
        </mesh>
      ))}
      {/* book spine accent */}
      <mesh castShadow position={[0, 0.1, 0.55]}>
        <boxGeometry args={[0.7, 0.18, 0.12]} />
        <meshStandardMaterial color="#0c4a6e" metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}

function WarmShape({ color, hovered }) {
  const emissive = hovered ? 0.5 : 0.2;
  return (
    <group>
      {/* shopfront block */}
      <mesh castShadow receiveShadow position={[0, 0.5, 0]}>
        <boxGeometry args={[1.3, 1.0, 1.3]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissive}
          metalness={0.1}
          roughness={0.55}
        />
      </mesh>
      {/* awning */}
      <mesh castShadow position={[0, 1.06, 0]}>
        <boxGeometry args={[1.5, 0.1, 1.5]} />
        <meshStandardMaterial
          color="#7c2d12"
          emissive="#c2410c"
          emissiveIntensity={hovered ? 0.45 : 0.18}
          roughness={0.7}
        />
      </mesh>
      {/* warm window glow */}
      <mesh position={[0, 0.45, 0.66]}>
        <planeGeometry args={[0.85, 0.45]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0.85} />
      </mesh>
      {/* spit / column */}
      <mesh castShadow position={[0, 1.45, -0.45]}>
        <cylinderGeometry args={[0.09, 0.09, 0.55, 16]} />
        <meshStandardMaterial color="#3f3f46" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
}

function TechShape({ color, hovered }) {
  const emissive = hovered ? 0.45 : 0.18;
  const stripes = useMemo(() => [0.5, 0.18, -0.16, -0.5], []);
  return (
    <group>
      {/* server tower */}
      <mesh castShadow receiveShadow position={[0, 0.85, 0]}>
        <boxGeometry args={[0.85, 1.7, 0.65]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissive}
          metalness={0.7}
          roughness={0.25}
        />
      </mesh>
      {/* status LED bars */}
      {stripes.map((y, i) => (
        <mesh key={i} position={[0, 0.85 + y, 0.331]}>
          <boxGeometry args={[0.6, 0.06, 0.02]} />
          <meshStandardMaterial
            color="#a7f3d0"
            emissive="#10b981"
            emissiveIntensity={hovered ? 2.4 : 1.4}
            toneMapped={false}
          />
        </mesh>
      ))}
      {/* antenna mast */}
      <mesh castShadow position={[0, 1.85, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.4, 8]} />
        <meshStandardMaterial color="#a3a3a3" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* antenna beacon */}
      <mesh position={[0, 2.1, 0]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial
          color="#ef4444"
          emissive="#ef4444"
          emissiveIntensity={2}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function StationShape({ shape, color, hovered }) {
  switch (shape) {
    case "academic":
      return <AcademicShape color={color} hovered={hovered} />;
    case "warm":
      return <WarmShape color={color} hovered={hovered} />;
    case "tech":
      return <TechShape color={color} hovered={hovered} />;
    default:
      return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  Waypoint                                                                   */
/* -------------------------------------------------------------------------- */

export default function Waypoint({ station, active, dimmed, onActivate, onClose }) {
  const groupRef = useRef();
  const scaleRef = useRef(new THREE.Vector3(1, 1, 1));
  const targetScaleVec = useRef(new THREE.Vector3(1, 1, 1));
  const [hovered, setHovered] = useState(false);

  // Reset cursor on unmount in case the user navigates away mid-hover
  useEffect(() => {
    return () => {
      if (typeof document !== "undefined") {
        document.body.style.cursor = "default";
      }
    };
  }, []);

  // Floating + hover scale animation
  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;

    const t = state.clock.getElapsedTime();
    const phase = station.position[0] * 0.7 + station.position[2] * 0.3;
    g.position.y = Math.sin(t * 1.4 + phase) * 0.09 + (active ? 0.15 : 0);

    const targetScale = hovered ? 1.12 : active ? 1.06 : dimmed ? 0.92 : 1.0;
    targetScaleVec.current.set(targetScale, targetScale, targetScale);
    scaleRef.current.lerp(targetScaleVec.current, 0.12);
    g.scale.copy(scaleRef.current);

    // Slow, ambient rotation
    g.rotation.y += 0.0025;
  });

  const handleOver = (e) => {
    e.stopPropagation();
    setHovered(true);
    if (typeof document !== "undefined") {
      document.body.style.cursor = "pointer";
    }
  };
  const handleOut = (e) => {
    e.stopPropagation();
    setHovered(false);
    if (typeof document !== "undefined") {
      document.body.style.cursor = "default";
    }
  };
  const handleClick = (e) => {
    e.stopPropagation();
    onActivate();
  };

  return (
    <group position={station.position}>
      {/* Glowing base ring under each waypoint */}
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.78, 0.92, 48]} />
        <meshBasicMaterial
          color={station.color}
          transparent
          opacity={hovered || active ? 0.75 : 0.35}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* The interactive group (animated) */}
      <group
        ref={groupRef}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
        onClick={handleClick}
      >
        <StationShape
          shape={station.shape}
          color={station.color}
          hovered={hovered || active}
        />

        {/* Soft volumetric glow billboard */}
        <mesh position={[0, 0.9, 0]} renderOrder={2}>
          <sphereGeometry args={[1.25, 24, 24]} />
          <meshBasicMaterial
            color={station.color}
            transparent
            opacity={hovered || active ? 0.07 : 0.03}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* HTML overlay card — appears anchored above the waypoint */}
      <Html
        position={[0, 2.6, 0]}
        center
        zIndexRange={[100, 0]}
        style={{ pointerEvents: active ? "auto" : "none" }}
        wrapperClass="station-html-wrapper"
      >
        <StationCard station={station} active={active} onClose={onClose} />
      </Html>
    </group>
  );
}
