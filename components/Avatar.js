"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";

/**
 * Loads the Vanmoof S3 GLB model and adds a glowing headlight effect.
 */
function Bike() {
  const { scene } = useGLTF("/dark.glb");

  return (
    <group rotation={[0, Math.PI * 0.18, 0]}>
      {/* The actual 3D GLB model */}
      <primitive
        object={scene}
        scale={[0.48, 0.48, 0.48]}
        castShadow
        receiveShadow
      />
      {/* Headlight glow */}
      <pointLight
        position={[0.6, 0.36, 0]}
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

useGLTF.preload("/dark.glb");
