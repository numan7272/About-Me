"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, Sparkles } from "@react-three/drei";
import * as THREE from "three";

import StationCard from "./StationCard";

/* -------------------------------------------------------------------------- */
/*  Futuristic shape primitives                                                */
/* -------------------------------------------------------------------------- */

function AcademicShape({ color, hovered }) {
  const coreRef = useRef();
  const wireRef = useRef();
  const ringRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (coreRef.current) {
      coreRef.current.rotation.y = t * 0.7;
      coreRef.current.rotation.x = Math.sin(t * 0.5) * 0.3;
    }
    if (wireRef.current) wireRef.current.rotation.y = -t * 0.4;
    if (ringRef.current) ringRef.current.rotation.z = t * 0.55;
  });

  const ei = hovered ? 3.5 : 1.8;
  return (
    <group>
      {/* Base pad */}
      <mesh receiveShadow position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.82, 0.92, 0.08, 48]} />
        <meshStandardMaterial color="#0c2030" metalness={0.8} roughness={0.3} emissive={color} emissiveIntensity={0.12} />
      </mesh>
      {/* Glowing ring on pad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]}>
        <ringGeometry args={[0.72, 0.78, 64]} />
        <meshBasicMaterial color={color} transparent opacity={hovered ? 0.85 : 0.45} toneMapped={false} />
      </mesh>
      {/* Holographic pillar */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.09, 1.0, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={ei} toneMapped={false} transparent opacity={0.6} />
      </mesh>
      {/* Core icosahedron */}
      <group ref={coreRef} position={[0, 1.25, 0]}>
        <mesh castShadow>
          <icosahedronGeometry args={[0.38, 1]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={ei} metalness={0.7} roughness={0.15} toneMapped={false} />
        </mesh>
      </group>
      {/* Wireframe shell */}
      <group ref={wireRef} position={[0, 1.25, 0]}>
        <mesh>
          <icosahedronGeometry args={[0.56, 1]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={hovered ? 0.45 : 0.22} toneMapped={false} />
        </mesh>
      </group>
      {/* Orbital ring */}
      <mesh ref={ringRef} position={[0, 1.25, 0]}>
        <torusGeometry args={[0.72, 0.012, 8, 80]} />
        <meshBasicMaterial color={color} transparent opacity={hovered ? 0.8 : 0.45} toneMapped={false} />
      </mesh>
      {/* Point light */}
      <pointLight position={[0, 1.3, 0]} color={color} intensity={hovered ? 2.5 : 1.0} distance={4} decay={2} />
    </group>
  );
}

function WarmShape({ color, hovered }) {
  const knotRef = useRef();
  const beamRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (knotRef.current) {
      knotRef.current.rotation.y = t * 0.5;
      knotRef.current.rotation.z = Math.sin(t * 0.3) * 0.15;
    }
    if (beamRef.current) {
      beamRef.current.material.opacity = 0.3 + Math.sin(t * 2.2) * 0.15;
    }
  });

  const ei = hovered ? 3.5 : 1.8;
  return (
    <group>
      {/* Base pad */}
      <mesh receiveShadow position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.82, 0.92, 0.08, 48]} />
        <meshStandardMaterial color="#1a0c06" metalness={0.8} roughness={0.3} emissive={color} emissiveIntensity={0.12} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]}>
        <ringGeometry args={[0.72, 0.78, 64]} />
        <meshBasicMaterial color={color} transparent opacity={hovered ? 0.85 : 0.45} toneMapped={false} />
      </mesh>
      {/* Holographic pillar */}
      <mesh ref={beamRef} position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.06, 0.09, 1.12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={ei} toneMapped={false} transparent opacity={0.45} />
      </mesh>
      {/* Torus knot core */}
      <group ref={knotRef} position={[0, 1.3, 0]}>
        <mesh castShadow>
          <torusKnotGeometry args={[0.3, 0.1, 80, 12, 2, 3]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={ei} metalness={0.6} roughness={0.2} toneMapped={false} />
        </mesh>
        <mesh>
          <torusKnotGeometry args={[0.45, 0.015, 80, 8, 2, 3]} />
          <meshBasicMaterial color={color} transparent opacity={hovered ? 0.5 : 0.25} wireframe toneMapped={false} />
        </mesh>
      </group>
      <pointLight position={[0, 1.35, 0]} color={color} intensity={hovered ? 2.5 : 1.0} distance={4} decay={2} />
    </group>
  );
}

function TechShape({ color, hovered }) {
  const octRef = useRef();
  const outerRef = useRef();
  const ledRefs = useMemo(() => Array.from({ length: 6 }, () => ({ current: null })), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (octRef.current) octRef.current.rotation.y = t * 0.55;
    if (outerRef.current) outerRef.current.rotation.y = -t * 0.3;
    ledRefs.forEach((r, i) => {
      if (r.current) {
        r.current.material.emissiveIntensity =
          hovered ? 2.5 + Math.sin(t * 4 + i * 1.1) * 1.0 : 1.2 + Math.sin(t * 2 + i) * 0.6;
      }
    });
  });

  const ei = hovered ? 3.5 : 1.8;
  return (
    <group>
      {/* Base pad */}
      <mesh receiveShadow position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.82, 0.92, 0.08, 48]} />
        <meshStandardMaterial color="#041210" metalness={0.8} roughness={0.3} emissive={color} emissiveIntensity={0.12} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]}>
        <ringGeometry args={[0.72, 0.78, 64]} />
        <meshBasicMaterial color={color} transparent opacity={hovered ? 0.85 : 0.45} toneMapped={false} />
      </mesh>
      {/* Pillar */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.09, 1.0, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={ei} toneMapped={false} transparent opacity={0.55} />
      </mesh>
      {/* Octahedron core */}
      <group ref={octRef} position={[0, 1.25, 0]}>
        <mesh castShadow>
          <octahedronGeometry args={[0.38, 0]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={ei} metalness={0.85} roughness={0.1} toneMapped={false} />
        </mesh>
        {/* LED ring slices */}
        {[-0.18, 0, 0.18].map((y, i) => (
          <mesh
            key={i}
            ref={ledRefs[i]}
            position={[0, y, 0]}
          >
            <torusGeometry args={[0.32 - i * 0.04, 0.018, 8, 48]} />
            <meshStandardMaterial
              color="#a7f3d0"
              emissive="#10b981"
              emissiveIntensity={1.5}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
      {/* Outer wireframe sphere */}
      <group ref={outerRef} position={[0, 1.25, 0]}>
        <mesh>
          <icosahedronGeometry args={[0.6, 1]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={hovered ? 0.35 : 0.15} toneMapped={false} />
        </mesh>
      </group>
      <pointLight position={[0, 1.3, 0]} color={color} intensity={hovered ? 2.5 : 1.0} distance={4} decay={2} />
    </group>
  );
}

function StationShape({ shape, color, hovered }) {
  switch (shape) {
    case "academic": return <AcademicShape color={color} hovered={hovered} />;
    case "warm":     return <WarmShape color={color} hovered={hovered} />;
    case "tech":     return <TechShape color={color} hovered={hovered} />;
    default:         return null;
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

  useEffect(() => {
    return () => {
      if (typeof document !== "undefined") document.body.style.cursor = "default";
    };
  }, []);

  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    const t = clock.getElapsedTime();
    const phase = station.position[0] * 0.6 + station.position[2] * 0.4;
    g.position.y = Math.sin(t * 1.3 + phase) * 0.1 + (active ? 0.18 : 0);
    const targetScale = hovered ? 1.14 : active ? 1.08 : dimmed ? 0.88 : 1.0;
    targetScaleVec.current.set(targetScale, targetScale, targetScale);
    scaleRef.current.lerp(targetScaleVec.current, 0.1);
    g.scale.copy(scaleRef.current);
  });

  const handleOver = (e) => {
    e.stopPropagation();
    setHovered(true);
    if (typeof document !== "undefined") document.body.style.cursor = "pointer";
  };
  const handleOut = (e) => {
    e.stopPropagation();
    setHovered(false);
    if (typeof document !== "undefined") document.body.style.cursor = "default";
  };
  const handleClick = (e) => {
    e.stopPropagation();
    onActivate();
  };

  return (
    <group position={station.position}>
      {/* The interactive group (floating animation applied here) */}
      <group
        ref={groupRef}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
        onClick={handleClick}
      >
        <StationShape shape={station.shape} color={station.color} hovered={hovered || active} />

        {/* Sparkles when hovered/active */}
        {(hovered || active) && (
          <Sparkles
            count={20}
            scale={2}
            size={0.5}
            speed={0.6}
            color={station.color}
            position={[0, 0.8, 0]}
          />
        )}

        {/* Soft volumetric glow billboard */}
        <mesh position={[0, 0.9, 0]} renderOrder={2}>
          <sphereGeometry args={[1.4, 20, 20]} />
          <meshBasicMaterial
            color={station.color}
            transparent
            opacity={hovered || active ? 0.055 : 0.022}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* Station label (always visible, non-interactive) */}
      <Html
        position={[0, -0.15, 0]}
        center
        distanceFactor={12}
        zIndexRange={[40, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div
          style={{
            userSelect: "none",
            textAlign: "center",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            opacity: dimmed ? 0.35 : 1,
            transition: "opacity 0.3s",
          }}
        >
          <div
            style={{
              fontSize: "10px",
              fontWeight: "700",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: station.color,
              textShadow: `0 0 12px ${station.color}aa`,
              whiteSpace: "nowrap",
            }}
          >
            {station.subtitle}
          </div>
        </div>
      </Html>

      {/* HTML overlay card */}
      <Html
        position={[0, 2.8, 0]}
        center
        zIndexRange={[100, 0]}
        style={{ pointerEvents: active ? "auto" : "none" }}
      >
        <StationCard station={station} active={active} onClose={onClose} />
      </Html>
    </group>
  );
}


