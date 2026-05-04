"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useKeyboardControls } from "@react-three/drei";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";

import { touchInput } from "@/lib/inputStore";

const BIKE_URL = "/vanmoof-transformed.glb";

const MAX_SPEED  = 7.5;
const ACCEL      = 6;
const TURN_SPEED = 2.6;
// Tunable: radians of wheel rotation per metre of travel
const WHEEL_RPM  = 2.2;

// ─────────────────────────────────────────────────────────────────────────────
// VanMoofModel
//
// The GLB is authored facing +X (sideways vs Three.js default −Z forward).
// A −π/2 Y-rotation on the wrapper <group> fixes the visual alignment so the
// bike nose always points in the direction it's actually driving.
// The physics RigidBody / CuboidCollider are completely unaffected — they
// always stay in world-space.
// ─────────────────────────────────────────────────────────────────────────────
function VanMoofModel({ scale = 1, wheelGroupRef, crankRef }) {
  const { scene } = useGLTF(BIKE_URL);

  // One-time material setup: cast/receiveShadow + PBR tweaks
  useEffect(() => {
    scene.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow    = true;
      o.receiveShadow = true;
      if (o.material) {
        o.material.roughness       = Math.min(o.material.roughness  ?? 0.5,  0.45);
        o.material.metalness       = Math.max(o.material.metalness  ?? 0.2,  0.35);
        o.material.envMapIntensity = 1.1;
      }
    });
  }, [scene]);

  // Collect wheel & crank mesh refs after the GLB is loaded.
  // Names are matched by substring so the code is robust against minor
  // variations in the model's node naming convention.
  // If no names match the refs stay empty and nothing breaks.
  useEffect(() => {
    if (!wheelGroupRef || !crankRef) return;
    const wheels = [];
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const n = o.name?.toLowerCase() ?? "";
      if (n.includes("wheel") || n.includes("tyre") || n.includes("tire")) {
        wheels.push(o);
      }
      if (
        !crankRef.current &&
        (n.includes("crank") || n.includes("pedal") || n.includes("chain"))
      ) {
        crankRef.current = o;
      }
    });
    wheelGroupRef.current = wheels;
  }, [scene, wheelGroupRef, crankRef]);

  return (
    // −π/2 corrects the +X-facing model to +Z (Three.js local forward).
    // Change to +Math.PI / 2 if the bike faces −X instead.
    <group rotation={[0, -Math.PI / 2, 0]}>
      <primitive object={scene} scale={scale} />
    </group>
  );
}

useGLTF.preload(BIKE_URL);

// ─────────────────────────────────────────────────────────────────────────────
// Player
// ─────────────────────────────────────────────────────────────────────────────
export default function Player({ playerRef, followModeRef }) {
  const [, getKeys] = useKeyboardControls();

  // Mesh refs — populated asynchronously when the GLB loads
  const wheelGroupRef = useRef([]);
  const crankRef      = useRef(null);
  const wheelAngle    = useRef(0);      // accumulated rotation (radians)

  // Pre-allocated scratch objects — never reallocated inside useFrame
  const tmpForward = useMemo(() => new THREE.Vector3(), []);
  const tmpQuat    = useMemo(() => new THREE.Quaternion(), []);

  useFrame((_, delta) => {
    const body = playerRef.current;
    if (!body) return;

    // ── Input ───────────────────────────────────────────────────────────
    const k            = getKeys();
    const forwardDown  = k.forward  || touchInput.forward;
    const backwardDown = k.backward || touchInput.backward;
    const leftDown     = k.left     || touchInput.left;
    const rightDown    = k.right    || touchInput.right;
    const brakeDown    = k.brake    || touchInput.brake;

    // ── Bruno Simon: auto re-engage follow mode on any drive key ────────
    // Pressing WASD / arrows snaps the camera back to the bike without
    // any UI button.  followModeRef is a plain mutable ref so this
    // assignment never triggers a React re-render.
    if (followModeRef?.current !== undefined) {
      if (forwardDown || backwardDown || leftDown || rightDown) {
        followModeRef.current = true;
      }
    }

    const fwdIn  = (forwardDown  ? 1 : 0) - (backwardDown ? 1 : 0);
    const turnIn = (leftDown     ? 1 : 0) - (rightDown    ? 1 : 0);

    // ── Local-space movement ─────────────────────────────────────────────
    // Get the rigid body's current world-space quaternion, apply it to the
    // local forward vector (+Z) to get the world-space driving direction.
    // This ensures W always moves in the direction the bike is facing.
    const rot = body.rotation();
    tmpQuat.set(rot.x, rot.y, rot.z, rot.w);
    tmpForward.set(0, 0, 1).applyQuaternion(tmpQuat);

    const targetSpeed = fwdIn * MAX_SPEED * (brakeDown ? 0 : 1);
    const targetVx    = tmpForward.x * targetSpeed;
    const targetVz    = tmpForward.z * targetSpeed;

    const cur    = body.linvel();
    const lerpT  = Math.min(1, ACCEL * delta);
    const brakeT = brakeDown ? Math.min(1, 10 * delta) : lerpT;

    body.setLinvel(
      {
        x: brakeDown
          ? THREE.MathUtils.lerp(cur.x, 0, brakeT)
          : THREE.MathUtils.lerp(cur.x, targetVx, lerpT),
        y: cur.y,   // preserve gravity / slopes
        z: brakeDown
          ? THREE.MathUtils.lerp(cur.z, 0, brakeT)
          : THREE.MathUtils.lerp(cur.z, targetVz, lerpT),
      },
      true,
    );

    // Turning — speed-scaled so slow manoeuvring is more precise
    const groundSpeed = Math.hypot(cur.x, cur.z);
    const speedFactor = turnIn !== 0
      ? THREE.MathUtils.clamp(groundSpeed / MAX_SPEED, 0.55, 1)
      : 0;
    body.setAngvel(
      { x: 0, y: turnIn !== 0 ? turnIn * TURN_SPEED * speedFactor : 0, z: 0 },
      true,
    );

    // ── Wheel spin animation ─────────────────────────────────────────────
    // Δangle = (linear_speed / wheel_radius) * scale_factor * Δtime
    // Negative because forward motion is counter-clockwise about local X.
    const deltaAngle = -(groundSpeed / 0.35) * WHEEL_RPM * delta;
    wheelAngle.current += deltaAngle;

    if (wheelGroupRef.current.length > 0) {
      for (const wheel of wheelGroupRef.current) {
        wheel.rotation.x = wheelAngle.current;
      }
    }
    // Crank turns at ~45 % of wheel speed (realistic single-speed ratio)
    if (crankRef.current) {
      crankRef.current.rotation.x = wheelAngle.current * 0.45;
    }
  });

  return (
    <RigidBody
      ref={playerRef}
      name="player"
      type="dynamic"
      colliders={false}
      enabledRotations={[false, true, false]}
      linearDamping={0.6}
      angularDamping={4}
      ccd
      mass={1.2}
      position={[0, 1.2, 6]}
    >
      {/* Collider dimensions: [half-width, half-height, half-depth] */}
      <CuboidCollider args={[0.32, 0.45, 0.85]} position={[0, 0.45, 0]} />
      <VanMoofModel
        scale={1}
        wheelGroupRef={wheelGroupRef}
        crankRef={crankRef}
      />
    </RigidBody>
  );
}
