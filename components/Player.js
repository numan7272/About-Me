"use client";

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useKeyboardControls } from "@react-three/drei";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";

import { touchInput } from "@/lib/inputStore";

const BIKE_URL = "/vanmoof-transformed.glb";

const MAX_SPEED = 7.5;
const ACCEL = 6;
const TURN_SPEED = 2.6;

function VanMoofModel({ scale = 1 }) {
  const { scene } = useGLTF(BIKE_URL);

  useEffect(() => {
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.material) {
          o.material.roughness = Math.min(o.material.roughness ?? 0.5, 0.45);
          o.material.metalness = Math.max(o.material.metalness ?? 0.2, 0.35);
          o.material.envMapIntensity = 1.1;
        }
      }
    });
  }, [scene]);

  return <primitive object={scene} scale={scale} />;
}

useGLTF.preload(BIKE_URL);

export default function Player({ playerRef }) {
  const [, getKeys] = useKeyboardControls();

  // Reusable scratch values — no GC churn in the hot path
  const tmpForward = useMemo(() => new THREE.Vector3(), []);
  const tmpQuat = useMemo(() => new THREE.Quaternion(), []);

  useFrame((_, delta) => {
    const body = playerRef.current;
    if (!body) return;

    const k = getKeys();
    const forwardDown = k.forward || touchInput.forward;
    const backwardDown = k.backward || touchInput.backward;
    const leftDown = k.left || touchInput.left;
    const rightDown = k.right || touchInput.right;
    const brakeDown = k.brake || touchInput.brake;

    const fwdIn = (forwardDown ? 1 : 0) - (backwardDown ? 1 : 0);
    const turnIn = (leftDown ? 1 : 0) - (rightDown ? 1 : 0);

    // ── LOCAL-SPACE movement fix ──────────────────────────────────────────────
    // Get the rigid body's current quaternion and rotate the local forward
    // vector (+Z in Three.js) into world space. This ensures W always moves
    // in the direction the bike is currently facing, not global Z.
    const r = body.rotation();
    tmpQuat.set(r.x, r.y, r.z, r.w);
    tmpForward.set(0, 0, 1).applyQuaternion(tmpQuat);

    const targetSpeed = fwdIn * MAX_SPEED * (brakeDown ? 0 : 1);
    const targetVx = tmpForward.x * targetSpeed;
    const targetVz = tmpForward.z * targetSpeed;

    const cur = body.linvel();
    const lerp = Math.min(1, ACCEL * delta);
    const brakeFactor = brakeDown ? Math.min(1, 10 * delta) : lerp;

    body.setLinvel(
      {
        x: brakeDown
          ? THREE.MathUtils.lerp(cur.x, 0, brakeFactor)
          : THREE.MathUtils.lerp(cur.x, targetVx, lerp),
        y: cur.y,
        z: brakeDown
          ? THREE.MathUtils.lerp(cur.z, 0, brakeFactor)
          : THREE.MathUtils.lerp(cur.z, targetVz, lerp),
      },
      true,
    );

    // Only turn if there is actual input — no idle drift
    const speedFactor =
      turnIn !== 0
        ? THREE.MathUtils.clamp(
            Math.hypot(cur.x, cur.z) / MAX_SPEED,
            0.55,
            1,
          )
        : 0;
    body.setAngvel(
      { x: 0, y: turnIn !== 0 ? turnIn * TURN_SPEED * speedFactor : 0, z: 0 },
      true,
    );
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
      <VanMoofModel scale={1} />
    </RigidBody>
  );
}
