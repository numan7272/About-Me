"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * A wide, animated water plane sitting just below the island.
 * Vertex shader displaces y with three crossing sine waves; fragment
 * shader blends a deep blue → surface blue gradient and lights the
 * crests with a sparkle hotspot that the bloom picks up nicely.
 */
const WATER_VERT = /* glsl */ `
  uniform float uTime;
  varying float vWave;
  varying vec3  vWorldPos;

  void main() {
    vec3 pos = position;

    // Plane geometry vertices live in local XY (z=0). After the parent's
    // -π/2 X rotation, local +Z maps to world +Y, so we displace pos.z to
    // raise wave crests upward in world space.
    float w1 = sin(pos.x * 0.13 + uTime * 0.65) * 0.22;
    float w2 = sin(pos.y * 0.11 + uTime * 0.85) * 0.18;
    float w3 = sin((pos.x + pos.y) * 0.06 + uTime * 0.40) * 0.34;

    pos.z += w1 + w2 + w3;
    vWave = (w1 + w2 + w3) * 0.5 + 0.5;

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const WATER_FRAG = /* glsl */ `
  uniform float uTime;
  varying float vWave;
  varying vec3  vWorldPos;

  void main() {
    // Distance from origin (island centre) — fades the inner shore for parity
    // with the floating-island silhouette.
    float r = length(vWorldPos.xz);
    float shore = smoothstep(72.0, 84.0, r);

    vec3 deep   = vec3(0.04, 0.10, 0.22);
    vec3 surf   = vec3(0.20, 0.55, 0.78);
    vec3 col    = mix(deep, surf, smoothstep(0.18, 0.92, vWave));

    // Wave-crest highlight — additive sparkle that survives tone-mapping
    float spark = smoothstep(0.86, 1.00, vWave);
    col += vec3(0.45, 0.62, 0.85) * spark;

    // Subtle horizontal foam belt where waves meet the shore radius
    float foam = smoothstep(70.0, 73.0, r) * (1.0 - smoothstep(76.0, 80.0, r));
    col += vec3(0.85, 0.95, 1.0) * foam * 0.4;

    float alpha = mix(0.0, 0.95, shore);
    gl_FragColor = vec4(col, alpha);
  }
`;

export default function Water() {
  const matRef = useRef(null);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader:   WATER_VERT,
        fragmentShader: WATER_FRAG,
        uniforms: {
          uTime: { value: 0 },
        },
        transparent: true,
        depthWrite:  false,
        side: THREE.DoubleSide,
      }),
    [],
  );

  // Hold a ref so useFrame can advance the time uniform
  matRef.current = material;

  useFrame((_, dt) => {
    if (matRef.current) matRef.current.uniforms.uTime.value += dt;
  });

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -1.6, 0]}
      receiveShadow={false}
      renderOrder={-1}
    >
      <planeGeometry args={[600, 600, 96, 96]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
