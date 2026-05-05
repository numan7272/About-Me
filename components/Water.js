"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Bruno-Simon-style water plane.
 *
 * Completely flat — no vertex displacement, no sine-wave bobbing. The
 * surface look comes from animated procedural "current lines": thin white
 * stripes drawn in a fragment shader using polar coordinates around the
 * island, with a denser foam belt right at the shore where the lines crowd.
 * It reads like waves traced on the surface rather than a 3D sea.
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
  varying vec3 vWorldPos;

  // Sharp band centred on the given offset of width w — used to convert a
  // smooth signal into a thin bright stripe.
  float band(float v, float centre, float w) {
    return 1.0 - smoothstep(0.0, w, abs(v - centre));
  }

  void main() {
    // Distance from island origin and angle around the centre. Used as
    // input to two sets of stripes — radial rings and angular spokes.
    vec2  p     = vWorldPos.xz;
    float r     = length(p);
    float angle = atan(p.y, p.x);

    // Base water colour — a cool light teal that picks up the bloom but
    // doesn't drown in it. Slightly darker far from the island.
    float depth   = smoothstep(60.0, 200.0, r);
    vec3  shallow = vec3(0.43, 0.72, 0.92);
    vec3  deep    = vec3(0.17, 0.40, 0.65);
    vec3  base    = mix(shallow, deep, depth);

    // ── Concentric current rings sweeping outward ──────────────────────
    // Three rings at different speeds & densities; the modulo creates a
    // repeating pattern of bands every ~10 m. fract() means each ring is
    // 0..1 across one band cycle; band() picks out the centre line.
    float ring1 = band(fract(r * 0.12 - uTime * 0.06), 0.5, 0.06);
    float ring2 = band(fract(r * 0.06 + uTime * 0.04), 0.5, 0.05);
    float ring3 = band(fract(r * 0.20 - uTime * 0.10), 0.5, 0.04);

    // ── Diagonal cross-current — gives the surface direction so it
    // doesn't read as a perfect target. Two crossing wave fronts. ─────
    float cross1 = band(fract(p.x * 0.06 + p.y * 0.03 - uTime * 0.18), 0.5, 0.05);
    float cross2 = band(fract(p.x * 0.04 - p.y * 0.07 + uTime * 0.13), 0.5, 0.05);

    // ── Foam belt at the shore — extra bright, broken-up dashes ───────
    // The band along radius ~outer-island-radius gets a denser stripe
    // pattern that reads as breaking surf.
    float shore     = (1.0 - smoothstep(60.0, 78.0, r)) * smoothstep(56.0, 62.0, r);
    float foamPhase = sin(angle * 28.0 + uTime * 0.8) * 0.5 + 0.5;
    float foam      = shore * smoothstep(0.55, 0.95, foamPhase) * 1.6;

    // Combine rings + cross currents into a single brightness term, then
    // boost where the shore foam is.
    float lines = max(max(ring1, ring2), max(ring3, max(cross1, cross2))) * 0.55;
    lines       = max(lines, foam);

    // White current lines blended over the base. Non-additive so the
    // water doesn't blow out the bloom budget.
    vec3 col = mix(base, vec3(0.96, 0.99, 1.0), clamp(lines, 0.0, 1.0));

    // Fade off the very far horizon so the plane doesn't show its edges
    float farFade = 1.0 - smoothstep(180.0, 260.0, r);
    float alpha   = mix(0.0, 0.94, smoothstep(58.0, 72.0, r)) * farFade;

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

  matRef.current = material;

  useFrame((_, dt) => {
    if (matRef.current) matRef.current.uniforms.uTime.value += dt;
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
