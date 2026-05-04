"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";

/**
 * Stylized Vanmoof S3 with glowing headlight and tooltip.
 */
function Bike() {
  return (
    <group rotation={[0, Math.PI * 0.18, 0]}>
      {/* Wheels */}
      <mesh castShadow position={[-0.36, 0.18, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.18, 0.035, 12, 28]} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.4} roughness={0.6} />
      </mesh>
      <mesh castShadow position={[0.36, 0.18, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.18, 0.035, 12, 28]} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.4} roughness={0.6} />
      </mesh>

      {/* Hubs */}
      <mesh position={[-0.36, 0.18, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 0.04, 12]} />
        <meshStandardMaterial color="#d4d4d8" metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh position={[0.36, 0.18, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 0.04, 12]} />
        <meshStandardMaterial color="#d4d4d8" metalness={0.85} roughness={0.25} />
      </mesh>

      {/* Top tube */}
      <mesh castShadow position={[0, 0.36, 0]}>
        <boxGeometry args={[0.78, 0.075, 0.07]} />
        <meshStandardMaterial
          color="#3b82f6"
          metalness={0.55}
          roughness={0.35}
          emissive="#1d4ed8"
          emissiveIntensity={0.4}
        />
      </mesh>

      {/* Down tube */}
      <mesh castShadow position={[0, 0.27, 0]} rotation={[0, 0, -0.18]}>
        <boxGeometry args={[0.7, 0.05, 0.06]} />
        <meshStandardMaterial color="#1d4ed8" metalness={0.5} roughness={0.4} emissive="#1d4ed8" emissiveIntensity={0.2} />
      </mesh>

      {/* Saddle */}
      <mesh castShadow position={[-0.32, 0.46, 0]}>
        <boxGeometry args={[0.18, 0.04, 0.07]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.85} />
      </mesh>
      <mesh castShadow position={[-0.32, 0.4, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.16, 8]} />
        <meshStandardMaterial color="#27272a" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Handlebars */}
      <mesh castShadow position={[0.34, 0.45, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.22, 10]} />
        <meshStandardMaterial color="#18181b" metalness={0.6} roughness={0.45} />
      </mesh>
      <mesh castShadow position={[0.34, 0.34, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.22, 10]} />
        <meshStandardMaterial color="#27272a" metalness={0.6} roughness={0.45} />
      </mesh>

      {/* Front headlight — glowing */}
      <mesh position={[0.46, 0.36, 0]}>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshStandardMaterial
          color="#fde68a"
          emissive="#fbbf24"
          emissiveIntensity={3.5}
          toneMapped={false}
        />
      </mesh>
      {/* Headlight point light */}
      <pointLight
        position={[0.58, 0.36, 0]}
        color="#fbbf24"
        intensity={1.8}
        distance={2.5}
        decay={2}
      />
    </group>
  );
}

export default function Avatar({ position = [0, 0, 0] }) {
  const groupRef = useRef();

  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    const t = clock.getElapsedTime();
    g.position.y = Math.sin(t * 1.8) * 0.04;
    g.rotation.y = Math.sin(t * 0.6) * 0.05;
  });

  return (
    <group position={position}>
      <group ref={groupRef}>
        <Bike />
      </group>

      <Html
        position={[0, 1.05, 0]}
        center
        zIndexRange={[60, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div className="relative -translate-x-1/2 whitespace-nowrap">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-[6px] rounded-full opacity-70 blur-md"
            style={{
              background:
                "radial-gradient(50% 50% at 50% 50%, rgba(59,130,246,0.4), transparent 70%)",
            }}
          />
          <div className="relative rounded-full border border-white/10 bg-zinc-900/70 px-3 py-1.5 text-[11px] font-medium tracking-wide text-zinc-100 backdrop-blur-md shadow-lg">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 -translate-y-px rounded-full bg-amber-400 align-middle shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
            Riding a Vanmoof S3{" "}
            <span className="text-zinc-400">(Error 44 / Single-Speed Mode)</span>
          </div>
        </div>
      </Html>
    </group>
  );
}


