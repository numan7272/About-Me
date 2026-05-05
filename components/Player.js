"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useKeyboardControls } from "@react-three/drei";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";
import { touchInput } from "@/lib/inputStore";

const BIKE_URL   = "/vanmoof-transformed.glb";
const MAX_SPEED  = 7.5;
const ACCEL      = 6;
const TURN_SPEED = 2.6;
const WHEEL_RPM  = 2.2;

// WHY rotation.z FOR WHEELS:
// The wrapper <group rotation={[0, -Math.PI/2, 0]}> rotates the whole model
// -90° around Y. This remaps the wheel's axle: what was local X is now
// world Z. So rolling forward = rotation on local Z (not X).
function VanMoofModel({ scale = 1, wheelGroupRef, crankRef }) {
  const { scene } = useGLTF(BIKE_URL);

  useEffect(() => {
    scene.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow    = true;
      o.receiveShadow = true;
      if (o.material) {
        o.material.roughness       = Math.min(o.material.roughness  ?? 0.5, 0.45);
        o.material.metalness       = Math.max(o.material.metalness  ?? 0.2, 0.35);
        o.material.envMapIntensity = 1.1;
      }
    });
  }, [scene]);

  useEffect(() => {
    if (!wheelGroupRef || !crankRef) return;
    const wheels = [];
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const n = o.name?.toLowerCase() ?? "";
      if (n.includes("wheel") || n.includes("tyre") || n.includes("tire")) wheels.push(o);
      if (!crankRef.current && (n.includes("crank") || n.includes("pedal") || n.includes("chain"))) {
        crankRef.current = o;
      }
    });
    wheelGroupRef.current = wheels;
  }, [scene, wheelGroupRef, crankRef]);

  return (
    // -π/2 Y-rotation: corrects +X-facing model to face +Z (Three.js forward).
    // Side effect: wheel roll axis shifts from .x → .z  (see note above)
    <group rotation={[0, -Math.PI / 2, 0]}>
      <primitive object={scene} scale={scale} />
    </group>
  );
}

useGLTF.preload(BIKE_URL);

export default function Player({ playerRef, followModeRef }) {
  const [, getKeys] = useKeyboardControls();
  const wheelGroupRef = useRef([]);
  const crankRef      = useRef(null);
  const wheelAngle    = useRef(0);
  const tmpForward    = useMemo(() => new THREE.Vector3(), []);
  const tmpQuat       = useMemo(() => new THREE.Quaternion(), []);

  useFrame((_, delta) => {
    const body = playerRef.current;
    if (!body) return;

    const k            = getKeys();
    const forwardDown  = k.forward  || touchInput.forward;
    const backwardDown = k.backward || touchInput.backward;
    const leftDown     = k.left     || touchInput.left;
    const rightDown    = k.right    || touchInput.right;
    const brakeDown    = k.brake    || touchInput.brake;

    if (followModeRef?.current !== undefined) {
      if (forwardDown || backwardDown || leftDown || rightDown) followModeRef.current = true;
    }

    const fwdIn  = (forwardDown  ? 1 : 0) - (backwardDown ? 1 : 0);
    const turnIn = (leftDown     ? 1 : 0) - (rightDown    ? 1 : 0);

    const rot = body.rotation();
    tmpQuat.set(rot.x, rot.y, rot.z, rot.w);
    tmpForward.set(0, 0, 1).applyQuaternion(tmpQuat);

    const targetSpeed = fwdIn * MAX_SPEED * (brakeDown ? 0 : 1);
    const cur   = body.linvel();
    const lerpT = Math.min(1, ACCEL * delta);
    const brakeT = brakeDown ? Math.min(1, 10 * delta) : lerpT;

    body.setLinvel({
      x: brakeDown ? THREE.MathUtils.lerp(cur.x, 0, brakeT) : THREE.MathUtils.lerp(cur.x, tmpForward.x * targetSpeed, lerpT),
      y: cur.y,
      z: brakeDown ? THREE.MathUtils.lerp(cur.z, 0, brakeT) : THREE.MathUtils.lerp(cur.z, tmpForward.z * targetSpeed, lerpT),
    }, true);

    const groundSpeed = Math.hypot(cur.x, cur.z);
    const speedFactor = turnIn !== 0 ? THREE.MathUtils.clamp(groundSpeed / MAX_SPEED, 0.55, 1) : 0;
    body.setAngvel({ x: 0, y: turnIn !== 0 ? turnIn * TURN_SPEED * speedFactor : 0, z: 0 }, true);

    // ── Wheel spin ──────────────────────────────────────────────────────────
    // After the -π/2 Y wrap the roll axis is LOCAL Z, not X.
    const deltaAngle = -(groundSpeed / 0.35) * WHEEL_RPM * delta;
    wheelAngle.current += deltaAngle;

    for (const wheel of wheelGroupRef.current) {
      wheel.rotation.z = wheelAngle.current;  // ← Z, not X
    }
    if (crankRef.current) crankRef.current.rotation.z = wheelAngle.current * 0.45;
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
      <VanMoofModel scale={1} wheelGroupRef={wheelGroupRef} crankRef={crankRef} />
    </RigidBody>
  );
}
