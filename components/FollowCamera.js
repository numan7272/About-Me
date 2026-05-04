"use client";

import { useRef, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Hybrid camera:
 *  - Wraps @react-three/drei <OrbitControls> so the user can freely zoom/pan.
 *  - Tracks a "followMode" flag. When followMode=true the OrbitControls target
 *    is lerped to the bike's position every frame — giving a smooth follow feel
 *    while still allowing full zoom.
 *  - Any manual pan/rotate disables followMode.
 *  - The "Zentrieren" button (rendered as an HTML overlay) re-enables it.
 */
export default function FollowCamera({ targetRef, followModeRef, orbitRef }) {
  const { camera } = useThree();
  const targetLerp = useRef(new THREE.Vector3());

  useFrame(() => {
    if (!targetRef.current) return;
    if (!followModeRef.current) return;
    if (!orbitRef.current) return;

    const pos = targetRef.current.translation();
    targetLerp.current.set(pos.x, pos.y + 0.5, pos.z);

    // Smoothly slide the orbit target toward the player
    orbitRef.current.target.lerp(targetLerp.current, 0.08);
    orbitRef.current.update();
  });

  const handleChange = useCallback(() => {
    // User moved the camera manually — disengage follow mode
    followModeRef.current = false;
  }, [followModeRef]);

  return (
    <OrbitControls
      ref={orbitRef}
      makeDefault
      enableDamping
      dampingFactor={0.07}
      minDistance={6}
      maxDistance={80}
      minPolarAngle={Math.PI / 8}
      maxPolarAngle={Math.PI / 2.2}
      target={[0, 0.5, 0]}
      onChange={handleChange}
    />
  );
}
