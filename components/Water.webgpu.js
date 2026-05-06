"use client";

/**
 * WebGPU / TSL port of components/Water.js.
 *
 * Three.js's WebGPU backend ships with a node-based shading language
 * (TSL — Three Shading Language) that replaces hand-written GLSL
 * strings. Instead of a string template and a uniforms map, you build
 * the shader by composing exported node functions: `texture()`,
 * `uv()`, `time()`, `mix()`, `smoothstep()`, etc.
 *
 * This file is a one-to-one port of the WebGL Water.js fragment
 * shader.  Geometry + scene structure stay identical — only the
 * material implementation changes.  Until the rest of the migration is
 * done (R3F v9 swap, WebGPURenderer wiring) this file isn't imported
 * anywhere; it's the reference for the TSL syntax we'll repeat for
 * Grass, WindStreaks, etc.
 *
 * The node tree below mirrors the GLSL almost line-for-line so a
 * future maintainer can diff the two and see they're equivalent.
 */

import { useMemo } from "react";
import * as THREE from "three/webgpu";
import {
  Fn,
  uniform,
  vec2,
  vec3,
  vec4,
  float,
  positionWorld,
  time,
  length as tslLength,
  atan2,
  sin,
  abs,
  mix,
  smoothstep,
  clamp,
  MeshBasicNodeMaterial,
} from "three/tsl";

// Mirrors lib/islandShape.js outerR — keeps the foam belt aligned
// with the same coastline the WebGL build uses.
const outerRTSL = Fn(([angle]) =>
  float(60.0)
    .add(sin(angle.mul(3.0).add(0.7)).mul(5.5))
    .add(sin(angle.mul(5.0).add(2.1)).mul(3.2))
    .add(sin(angle.mul(7.0).add(4.3)).mul(1.8))
    .add(sin(angle.mul(11.0).add(1.1)).mul(1.0)),
);

// Two-octave value-noise stand-in: cheaper than sampling a noise tex.
const noise2TSL = Fn(([p, t]) =>
  sin(p.x.mul(0.18).add(t.mul(0.6)))
    .mul(sin(p.y.mul(0.13).sub(t.mul(0.4))))
    .add(sin(p.x.add(p.y).mul(0.24).add(t.mul(0.8))).mul(0.5)),
);

export function buildWaterMaterial({
  shallow = "#5fb1d8",
  deep    = "#16365e",
  foam    = "#f3faff",
} = {}) {
  // Per-material uniforms wrapping THREE.Color objects.
  const uShallow   = uniform(new THREE.Color(shallow));
  const uDeep      = uniform(new THREE.Color(deep));
  const uFoamColor = uniform(new THREE.Color(foam));
  // uDayWeight is set once per frame from the shared registry by World.
  const uDayWeight = uniform(1.0);

  const colorNode = Fn(() => {
    const p     = positionWorld.xz;
    const r     = tslLength(p);
    const ang   = atan2(p.y.negate(), p.x);
    const coast = outerRTSL(ang);

    const depth = smoothstep(coast, coast.add(100.0), r);
    const base  = mix(uShallow, uDeep, depth);

    // Two-octave noise ribbons drifting on time
    const n  = noise2TSL(p, time);
    const n2 = noise2TSL(
      p.mul(0.6).add(vec2(time.mul(0.3), time.mul(-0.4))),
      time.mul(0.7),
    );
    const ribbons = smoothstep(0.4, 0.95, abs(n.add(n2.mul(0.5))));

    const sparkle = smoothstep(0.85, 1.0, abs(n)).mul(0.7);

    // Foam belt at the irregular shoreline
    const toShore   = abs(r.sub(coast));
    const foamBand  = float(1.0).sub(smoothstep(0.0, 3.5, toShore));
    const foamPulse = sin(ang.mul(32.0).add(time.mul(0.9))).mul(0.5).add(0.5);
    const foamOut   = foamBand.mul(smoothstep(0.45, 0.95, foamPulse)).mul(1.2);

    const white = ribbons.mul(0.45).add(sparkle).max(foamOut);
    let col     = mix(base, uFoamColor, clamp(white, 0.0, 1.0));

    // Night cool-down: tinted toward the deep colour after sunset
    col = mix(col.mul(vec3(0.32, 0.38, 0.55)), col, uDayWeight);
    return vec4(col, 1.0);
  })();

  const opacityNode = Fn(() => {
    const p     = positionWorld.xz;
    const r     = tslLength(p);
    const ang   = atan2(p.y.negate(), p.x);
    const coast = outerRTSL(ang);
    const farFade = float(1.0).sub(smoothstep(180.0, 260.0, r));
    return smoothstep(coast.sub(1.0), coast.add(6.0), r).mul(0.94).mul(farFade);
  })();

  const mat = new MeshBasicNodeMaterial();
  mat.colorNode   = colorNode;
  mat.opacityNode = opacityNode;
  mat.transparent = true;
  mat.depthWrite  = false;
  mat.side        = THREE.DoubleSide;

  // Expose the day-weight uniform so the renderer's per-frame tick can
  // sync it with sharedUniforms (which still drives the WebGL build).
  mat.userData.uDayWeight = uDayWeight;
  return mat;
}

/**
 * Drop-in replacement for components/Water.js when running on
 * WebGPURenderer. Geometry is identical; only the material changes.
 */
export default function WaterWebGPU() {
  const material = useMemo(() => buildWaterMaterial(), []);

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
