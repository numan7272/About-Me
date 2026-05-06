"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Bruno-Simon-style flat water surface.
 *
 * Multi-octave noise produces drifting current ribbons; an extra
 * fragment-shader pass paints a foam belt that hugs the irregular
 * island silhouette (radius taken from islandShape's outerR formula)
 * so foam pulses where the coast actually is, not on a perfect circle.
 *
 * Per-frame uniforms drive subtle colour tinting from the day cycle —
 * water reads cool at night, golden at sunset, bright teal at noon.
 */

const WATER_VERT = /* glsl */ `
  varying vec3 vWorldPos;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const WATER_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3  uShallow;
  uniform vec3  uDeep;
  uniform vec3  uFoamColor;
  uniform float uDayWeight;
  varying vec3  vWorldPos;

  // Cheap procedural noise — sin layers in world space drifting along a
  // fixed current direction. Two octaves combined give a watery,
  // non-repeating ribbon pattern.
  float noise2(vec2 p, float t) {
    return sin(p.x * 0.18 + t * 0.6) * sin(p.y * 0.13 - t * 0.4)
         + 0.5 * sin((p.x + p.y) * 0.24 + t * 0.8);
  }

  // Mirrors lib/islandShape.js outerR so foam pulses the coastline shape.
  float outerR(float a) {
    return 60.0
         + sin(a * 3.0  + 0.7) * 5.5
         + sin(a * 5.0  + 2.1) * 3.2
         + sin(a * 7.0  + 4.3) * 1.8
         + sin(a * 11.0 + 1.1) * 1.0;
  }

  void main() {
    vec2  p     = vWorldPos.xz;
    float r     = length(p);
    float ang   = atan(-p.y, p.x);
    float coast = outerR(ang);

    // Depth-based base colour
    float depth = smoothstep(coast, coast + 100.0, r);
    vec3  base  = mix(uShallow, uDeep, depth);

    // Drifting current ribbons
    float n  = noise2(p, uTime);
    float n2 = noise2(p * 0.6 + vec2(uTime * 0.3, -uTime * 0.4), uTime * 0.7);
    float ribbons = smoothstep(0.4, 0.95, abs(n + n2 * 0.5));

    // Specular-style sparkle hot spots
    float sparkle = smoothstep(0.85, 1.0, abs(n)) * 0.7;

    // Coast foam — a band right at the actual coastline (uses outerR).
    // The band follows the irregular silhouette, not a perfect circle.
    float toShore  = abs(r - coast);
    float foamBand = (1.0 - smoothstep(0.0, 3.5, toShore));
    float foamPulse = sin(ang * 32.0 + uTime * 0.9) * 0.5 + 0.5;
    float foam = foamBand * smoothstep(0.45, 0.95, foamPulse) * 1.2;

    // Compose
    float white = max(ribbons * 0.45 + sparkle, foam);
    vec3  col   = mix(base, uFoamColor, clamp(white, 0.0, 1.0));

    // Night cool-down: tinted toward the deep colour after sunset
    col = mix(col * vec3(0.32, 0.38, 0.55), col, uDayWeight);

    // Fade alpha at the very edge of the plane so the ocean blends into
    // the horizon haze and we never see the rectangle's seams.
    float farFade = 1.0 - smoothstep(180.0, 260.0, r);
    // Inside the island silhouette the water plane is invisible (the
    // ground is on top of it anyway, but this saves overdraw).
    float alpha   = mix(0.0, 0.94, smoothstep(coast - 1.0, coast + 6.0, r)) * farFade;

    gl_FragColor = vec4(col, alpha);
  }
`;

export default function Water({ dayRef }) {
  const matRef = useRef(null);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader:   WATER_VERT,
        fragmentShader: WATER_FRAG,
        uniforms: {
          uTime:      { value: 0 },
          uShallow:   { value: new THREE.Color("#5fb1d8") },
          uDeep:      { value: new THREE.Color("#16365e") },
          uFoamColor: { value: new THREE.Color("#f3faff") },
          uDayWeight: { value: 1.0 },
        },
        transparent: true,
        depthWrite:  false,
        side: THREE.DoubleSide,
      }),
    [],
  );
  matRef.current = material;

  useFrame((_, dt) => {
    matRef.current.uniforms.uTime.value += dt;
    if (dayRef?.current) {
      matRef.current.uniforms.uDayWeight.value = dayRef.current.dayWeight ?? 1;
    }
  });

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.05, 0]}
      receiveShadow={false}
      renderOrder={-1}
    >
      <planeGeometry args={[600, 600, 1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
