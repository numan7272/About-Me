"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";

/* -------------------------------------------------------------------------- */
/*  Stream shader — slimmer, faster ripples than the surrounding ocean        */
/* -------------------------------------------------------------------------- */

const STREAM_VERT = /* glsl */ `
  uniform float uTime;
  varying float vWave;
  varying vec2  vUv;
  void main() {
    vUv = uv;
    vec3 pos = position;
    float w1 = sin(pos.x * 0.55 + uTime * 1.2) * 0.06;
    float w2 = sin(pos.y * 0.45 + uTime * 1.6) * 0.04;
    pos.z += w1 + w2;
    vWave = (w1 + w2) * 0.5 + 0.5;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(pos, 1.0);
  }
`;
const STREAM_FRAG = /* glsl */ `
  varying float vWave;
  varying vec2  vUv;
  void main() {
    vec3 deep = vec3(0.06, 0.22, 0.36);
    vec3 surf = vec3(0.32, 0.66, 0.86);
    vec3 col = mix(deep, surf, vWave);
    float spark = smoothstep(0.78, 0.96, vWave);
    col += vec3(0.55, 0.75, 1.0) * spark * 0.55;
    // edge fade so the river doesn't show its sharp corners against grass
    float edge = min(vUv.x, 1.0 - vUv.x);
    float fade = smoothstep(0.0, 0.15, edge);
    gl_FragColor = vec4(col, 0.95 * fade);
  }
`;

/* -------------------------------------------------------------------------- */
/*  River — single straight stream running north→south at world x = 25        */
/* -------------------------------------------------------------------------- */

export default function River() {
  return (
    <group>
      <RiverPlane position={[25, -0.05, 0]} length={130} width={6} rotationY={0} />
      <Bridge
        position={[25, 0, -13.1]}
        rotationY={Math.atan2(42, -22)}
        length={9}
        width={5.5}
      />
    </group>
  );
}

/* ------------------------------ River geometry ---------------------------- */

function RiverPlane({ position, length, width, rotationY = 0 }) {
  const matRef = useRef();
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader:   STREAM_VERT,
        fragmentShader: STREAM_FRAG,
        uniforms: { uTime: { value: 0 } },
        transparent: true,
        depthWrite: false,
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
      position={position}
      rotation={[-Math.PI / 2, 0, rotationY]}
      receiveShadow={false}
      renderOrder={0}
    >
      <planeGeometry args={[width, length, 12, 48]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/* -------------------------------------------------------------------------- */
/*  Wooden bridge — sits on top of the road where it crosses the river        */
/* -------------------------------------------------------------------------- */

/**
 * Wooden rail bridge — no deck. The road passes through underneath the rails;
 * the rails are solid so the bike can't accidentally swerve off into the river.
 * Visually frames the river crossing.
 */
function Bridge({ position, rotationY = 0, length = 9, width = 5.5 }) {
  const railHalfX = 0.06;
  const railHalfY = 0.55;
  const railHalfZ = length / 2;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <RigidBody type="fixed" colliders={false} friction={0.7}>
        {/* Side rail colliders */}
        <CuboidCollider
          args={[railHalfX, railHalfY, railHalfZ]}
          position={[ width / 2 - railHalfX, railHalfY, 0]}
        />
        <CuboidCollider
          args={[railHalfX, railHalfY, railHalfZ]}
          position={[-width / 2 + railHalfX, railHalfY, 0]}
        />
      </RigidBody>

      {/* Side rails (visuals) */}
      <mesh castShadow position={[ width / 2 - railHalfX, railHalfY, 0]}>
        <boxGeometry args={[railHalfX * 2, railHalfY * 2, length]} />
        <meshStandardMaterial color="#a3744a" roughness={0.85} />
      </mesh>
      <mesh castShadow position={[-width / 2 + railHalfX, railHalfY, 0]}>
        <boxGeometry args={[railHalfX * 2, railHalfY * 2, length]} />
        <meshStandardMaterial color="#a3744a" roughness={0.85} />
      </mesh>

      {/* Corner posts (visuals) — slightly taller than rails */}
      {[
        [ width / 2 - 0.09, -length / 2 + 0.12],
        [-width / 2 + 0.09, -length / 2 + 0.12],
        [ width / 2 - 0.09,  length / 2 - 0.12],
        [-width / 2 + 0.09,  length / 2 - 0.12],
      ].map(([x, z], i) => (
        <mesh key={`po-${i}`} castShadow position={[x, 0.62, z]}>
          <boxGeometry args={[0.2, 1.25, 0.2]} />
          <meshStandardMaterial color="#6b3f1c" roughness={0.85} />
        </mesh>
      ))}

      {/* Decorative cross beams between corner posts at the rail tops */}
      <mesh castShadow position={[0, 1.18, -length / 2 + 0.12]}>
        <boxGeometry args={[width - 0.2, 0.1, 0.1]} />
        <meshStandardMaterial color="#6b3f1c" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 1.18, length / 2 - 0.12]}>
        <boxGeometry args={[width - 0.2, 0.1, 0.1]} />
        <meshStandardMaterial color="#6b3f1c" roughness={0.9} />
      </mesh>
    </group>
  );
}
