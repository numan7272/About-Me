"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useKeyboardControls } from "@react-three/drei";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";

import { touchInput } from "@/lib/inputStore";

const BIKE_URL = "/vanmoof-transformed.glb";

const MAX_SPEED   = 7.5;
const ACCEL       = 6;
const TURN_SPEED  = 2.6;
// How fast the wheel visually rotates per unit of speed (tune to taste)
const WHEEL_RPM   = 2.2;

// ─────────────────────────────────────────────────────────────────────────────
// VanMoof model
//
// The GLB is authored facing the +X axis (sideways relative to Three.js’s
// default forward −Z).  We correct this with a −π/2 Y-rotation on the
// wrapper group so the bike VISUALLY faces the same direction it DRIVES.
// ─────────────────────────────────────────────────────────────────────────────
function VanMoofModel({ scale = 1, wheelGroupRef, crankRef }) {
  const { scene } = useGLTF(BIKE_URL);

  useEffect(() => {
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow    = true;
        o.receiveShadow = true;
        if (o.material) {
          o.material.roughness       = Math.min(o.material.roughness  ?? 0.5,  0.45);
          o.material.metalness       = Math.max(o.material.metalness  ?? 0.2,  0.35);
          o.material.envMapIntensity = 1.1;
        }
      }
    });
  }, [scene]);

  // Collect wheel / crank meshes by name so we can rotate them in useFrame.
  // VanMoof GLBs commonly name them “wheel_f”, “wheel_r”, “crank” etc.
  // We gather ALL meshes whose name contains those keywords; if the model
  // uses different names the refs will simply stay empty and nothing breaks.
  useEffect(() => {
    if (!wheelGroupRef || !crankRef) return;
    const wheelNodes = [];
    scene.traverse((o) => {
      const n = o.name?.toLowerCase() ?? "";
      if (o.isMesh && (n.includes("wheel") || n.includes("tyre") || n.includes("tire"))) {
        wheelNodes.push(o);
      }
      if (o.isMesh && (n.includes("crank") || n.includes("pedal") || n.includes("chain"))) {
        crankRef.current = o;
      }
    });
    wheelGroupRef.current = wheelNodes;
  }, [scene, wheelGroupRef, crankRef]);

  return (
    /*
      Rotation fix: the GLB bike faces +X by default but the physics body
      drives along +Z (local forward).  A -90° Y rotation aligns the visual
      so the bike’s nose always points in its driving direction.

      If the model faces −X instead, change to +Math.PI / 2.
    */
    <group rotation={[0, -Math.PI / 2, 0]}>
      <primitive object={scene} scale={scale} />
    </group>
  );
}

useGLTF.preload(BIKE_URL);

// ─────────────────────────────────────────────────────────────────────────────
// Player — physics body + visual model + wheel spin animation
// ─────────────────────────────────────────────────────────────────────────────
export default function Player({ playerRef, followModeRef }) {
  const [, getKeys] = useKeyboardControls();

  // Wheel / crank mesh refs — populated by VanMoofModel after GLB loads
  const wheelGroupRef = useRef([]);
  const crankRef      = useRef(null);
  const wheelAngle    = useRef(0);

  // Reusable scratch vectors — no GC pressure in the hot path
  const tmpForward = useMemo(() => new THREE.Vector3(), []);
  const tmpQuat    = useMemo(() => new THREE.Quaternion(), []);

  useFrame((_, delta) => {
    const body = playerRef.current;
    if (!body) return;

    const k           = getKeys();
    const forwardDown = k.forward  || touchInput.forward;
    const backwardDown= k.backward || touchInput.backward;
    const leftDown    = k.left     || touchInput.left;
    const rightDown   = k.right    || touchInput.right;
    const brakeDown   = k.brake    || touchInput.brake;

    // ── Bruno Simon: auto re-engage follow mode when any drive key is pressed ──
    if (
      followModeRef &&
      (forwardDown || backwardDown || leftDown || rightDown)
    ) {
      followModeRef.current = true;
    }

    const fwdIn  = (forwardDown  ? 1 : 0) - (backwardDown ? 1 : 0);
    const turnIn = (leftDown     ? 1 : 0) - (rightDown    ? 1 : 0);

    // ── Local-space movement ─────────────────────────────────────────────
    // Rotate the local +Z forward vector into world space using the rigid
    // body’s current quaternion — W always drives where the bike faces.
    const r = body.rotation();
    tmpQuat.set(r.x, r.y, r.z, r.w);
    tmpForward.set(0, 0, 1).applyQuaternion(tmpQuat);

    const targetSpeed = fwdIn * MAX_SPEED * (brakeDown ? 0 : 1);
    const targetVx    = tmpForward.x * targetSpeed;
    const targetVz    = tmpForward.z * targetSpeed;

    const cur       = body.linvel();
    const lerpT     = Math.min(1, ACCEL * delta);
    const brakeT    = brakeDown ? Math.min(1, 10 * delta) : lerpT;

    body.setLinvel(
      {
        x: brakeDown
          ? THREE.MathUtils.lerp(cur.x, 0, brakeT)
          : THREE.MathUtils.lerp(cur.x, targetVx, lerpT),
        y: cur.y,
        z: brakeDown
          ? THREE.MathUtils.lerp(cur.z, 0, brakeT)
          : THREE.MathUtils.lerp(cur.z, targetVz, lerpT),
      },
      true,
    );

    // Turn only when input is present — no idle spin
    const groundSpeed = Math.hypot(cur.x, cur.z);
    const speedFactor = turnIn !== 0
      ? THREE.MathUtils.clamp(groundSpeed / MAX_SPEED, 0.55, 1)
      : 0;
    body.setAngvel(
      { x: 0, y: turnIn !== 0 ? turnIn * TURN_SPEED * speedFactor : 0, z: 0 },
      true,
    );

    // ── Wheel spin animation ─────────────────────────────────────────────
    // Angular velocity in radians/sec proportional to linear speed.
    // Negative because rolling forward rotates the wheel counter-clockwise
    // about the wheel’s local X axis (right-hand rule).
    const angularSpeedRad = -(groundSpeed / 0.35) * WHEEL_RPM * delta;
    wheelAngle.current += angularSpeedRad;

    // Apply to every collected wheel mesh (usually 2: front + rear)
    if (wheelGroupRef.current.length > 0) {
      for (const wheel of wheelGroupRef.current) {
        wheel.rotation.x = wheelAngle.current;
      }
    }
    // Crank spins at roughly half wheel speed (like a real drivetrain)
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
      <CuboidCollider args={[0.32, 0.45, 0.85]} position={[0, 0.45, 0]} />
      <VanMoofModel
        scale={1}
        wheelGroupRef={wheelGroupRef}
        crankRef={crankRef}
      />
    </RigidBody>
  );
}
