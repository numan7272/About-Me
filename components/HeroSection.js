"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Float, Sparkles, Html } from "@react-three/drei";
import * as THREE from "three";

function OrbitalRing({ radius, speed, tiltX, tiltZ, color, opacity = 0.4 }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = clock.getElapsedTime() * speed;
  });
  return (
    <mesh ref={ref} rotation={[tiltX, 0, tiltZ]}>
      <torusGeometry args={[radius, 0.013, 10, 128]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} toneMapped={false} />
    </mesh>
  );
}

function CoreSphere() {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.rotation.y = t * 0.6;
    ref.current.rotation.x = Math.sin(t * 0.4) * 0.2;
  });
  return (
    <group ref={ref}>
      {/* Solid glowing core */}
      <mesh>
        <icosahedronGeometry args={[0.3, 2]} />
        <meshStandardMaterial
          color="#22d3ee"
          emissive="#22d3ee"
          emissiveIntensity={3}
          toneMapped={false}
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>
      {/* Wireframe shell */}
      <mesh>
        <icosahedronGeometry args={[0.42, 1]} />
        <meshBasicMaterial color="#22d3ee" wireframe transparent opacity={0.25} toneMapped={false} />
      </mesh>
    </group>
  );
}

export default function HeroSection({ position = [0, 1.8, 0] }) {
  return (
    <group position={position}>
      <Float speed={1.2} rotationIntensity={0.06} floatIntensity={0.35}>
        <CoreSphere />

        {/* Orbital rings */}
        <OrbitalRing radius={1.05} speed={0.55}  tiltX={Math.PI * 0.3}  tiltZ={0}           color="#22d3ee" opacity={0.5} />
        <OrbitalRing radius={1.45} speed={-0.38} tiltX={Math.PI * 0.62} tiltZ={0.2}         color="#818cf8" opacity={0.38} />
        <OrbitalRing radius={1.82} speed={0.24}  tiltX={0.1}            tiltZ={Math.PI * 0.4} color="#34d399" opacity={0.28} />

        {/* Sparkles */}
        <Sparkles count={90} scale={4.2} size={0.7} speed={0.35} color="#22d3ee" />

        {/* Dynamic light emitting from the hero */}
        <pointLight color="#22d3ee" intensity={3.5} distance={9} decay={2} />
        <pointLight color="#818cf8" intensity={1.5} distance={7} decay={2} />
      </Float>

      {/* Name + tagline — rendered as HTML anchored below the orb */}
      <Html
        position={[0, -0.85, 0]}
        center
        distanceFactor={9}
        zIndexRange={[50, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div
          style={{
            textAlign: "center",
            userSelect: "none",
            fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
          }}
        >
          <div
            style={{
              fontSize: "36px",
              fontWeight: "800",
              color: "#e0f9ff",
              letterSpacing: "0.18em",
              textShadow:
                "0 0 24px rgba(34,211,238,0.9), 0 0 60px rgba(34,211,238,0.5), 0 0 120px rgba(34,211,238,0.2)",
              whiteSpace: "nowrap",
              lineHeight: 1,
            }}
          >
            NUMAN YESIL
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "#94a3b8",
              letterSpacing: "0.35em",
              marginTop: "8px",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              textShadow: "0 0 12px rgba(148,163,184,0.4)",
            }}
          >
            Software Engineer · QA · Builder
          </div>
          {/* Decorative divider */}
          <div
            style={{
              margin: "10px auto 0",
              width: "80px",
              height: "1px",
              background:
                "linear-gradient(90deg, transparent, rgba(34,211,238,0.8), transparent)",
            }}
          />
        </div>
      </Html>
    </group>
  );
}
