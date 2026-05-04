"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Smoothly follows a RigidBody from a fixed isometric offset.
 * Uses frame-rate independent lerp via Math.pow.
 */
export default function FollowCamera({ targetRef, offset = [12, 14, 12] }) {
  const desired = useRef(new THREE.Vector3()).current;
  const lookAt = useRef(new THREE.Vector3()).current;
  const offsetVec = useRef(
    new THREE.Vector3(offset[0], offset[1], offset[2]),
  ).current;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // (Offset is captured once intentionally — recompute would jitter the cam.)

  useFrame((state, delta) => {
    if (!targetRef.current) return;
    const pos = targetRef.current.translation();

    desired.set(
      pos.x + offsetVec.x,
      pos.y + offsetVec.y,
      pos.z + offsetVec.z,
    );
    lookAt.set(pos.x, pos.y + 0.6, pos.z);

    // Frame-rate independent smoothing — heavier = slower follow.
    const camAlpha = 1 - Math.pow(0.001, delta);
    state.camera.position.lerp(desired, camAlpha * 0.85);

    // Smoother look target (lerp current target tracker)
    state.camera.lookAt(lookAt);
  });

  return null;
}
