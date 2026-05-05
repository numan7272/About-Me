"use client";

import { useRef, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

// Chase-cam offset above/behind the bike (world-space isometric).
const CAM_OFFSET = new THREE.Vector3(14, 18, 14);
const CAM_LERP   = 0.07;   // camera body catch-up speed (lower = dreamier)
const TGT_LERP   = 0.10;   // orbit target tracking speed

export default function FollowCamera({ targetRef, followModeRef, orbitRef }) {
  const { camera } = useThree();

  const desiredCamPos = useRef(new THREE.Vector3()).current;
  const desiredTarget = useRef(new THREE.Vector3()).current;

  useFrame(() => {
    // Guard: skip if either ref isn't ready yet
    if (!targetRef?.current || !orbitRef?.current) return;
    if (!followModeRef.current) return; // user is in free-look mode

    const pos = targetRef.current.translation();

    desiredCamPos.set(
      pos.x + CAM_OFFSET.x,
      pos.y + CAM_OFFSET.y,
      pos.z + CAM_OFFSET.z,
    );
    desiredTarget.set(pos.x, pos.y + 0.8, pos.z);

    camera.position.lerp(desiredCamPos, CAM_LERP);
    orbitRef.current.target.lerp(desiredTarget, TGT_LERP);
    // Keep OrbitControls internal state in sync so user drag doesn't snap
    orbitRef.current.update();
  });

  // Disable follow mode only on a deliberate gesture (mousedown / touchstart),
  // NOT on onChange (which also fires during damping decay).
  const handleStart = useCallback(() => {
    if (followModeRef) followModeRef.current = false;
  }, [followModeRef]);

  return (
    <OrbitControls
      ref={orbitRef}
      makeDefault
      enableDamping
      dampingFactor={0.06}
      minDistance={5}
      maxDistance={100}
      minPolarAngle={Math.PI / 10}
      maxPolarAngle={Math.PI / 2.1}
      onStart={handleStart}
    />
  );
}
