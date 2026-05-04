"use client";

import { useRef, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

// ─────────────────────────────────────────────────────────────────────────────
// Bruno Simon-style hybrid follow camera.
//
// Follow mode ON  (followModeRef.current === true):
//   • camera.position lerps to a fixed isometric offset above/behind the bike
//   • OrbitControls.target lerps to the bike’s world position
//   Both use the same damping factor so they feel locked-together.
//
// Follow mode OFF (user has panned/rotated manually):
//   • OrbitControls takes over completely — free look, free zoom.
//   • Pressing any WASD / Arrow key re-enables follow mode automatically
//     (handled in Player.js to keep this component dependency-free).
//
// The “Zentrieren” HTML button has been removed — driving re-centers.
// ─────────────────────────────────────────────────────────────────────────────

// Isometric offset from the bike in world space.
// Tune X/Z for angle, Y for height.  Larger values = more zoomed out.
const CAM_OFFSET = new THREE.Vector3(14, 18, 14);

// Lerp strength per frame  (1 − pow trick = frame-rate independent)
const CAM_LERP   = 0.07;   // camera position follow speed
const TGT_LERP   = 0.1;    // orbit target tracking speed (slightly snappier)

export default function FollowCamera({ targetRef, followModeRef, orbitRef }) {
  const { camera } = useThree();

  // Scratch vectors — allocated once, reused every frame
  const desiredCamPos = useRef(new THREE.Vector3()).current;
  const desiredTarget = useRef(new THREE.Vector3()).current;

  useFrame(() => {
    if (!targetRef.current) return;
    if (!orbitRef.current)  return;

    const pos = targetRef.current.translation();

    if (followModeRef.current) {
      // ── Follow mode: glide camera back to isometric chase position ──
      desiredCamPos.set(
        pos.x + CAM_OFFSET.x,
        pos.y + CAM_OFFSET.y,
        pos.z + CAM_OFFSET.z,
      );
      desiredTarget.set(pos.x, pos.y + 0.8, pos.z);

      // Frame-rate independent lerp via 1 − (1 − k)^dt would be ideal;
      // for 60 fps the simple constant is smooth enough.
      camera.position.lerp(desiredCamPos, CAM_LERP);
      orbitRef.current.target.lerp(desiredTarget, TGT_LERP);

      // Keep OrbitControls in sync so it doesn’t snap on the next user drag
      orbitRef.current.update();
    }
    // When follow mode is OFF, OrbitControls handles everything naturally.
  });

  // Any manual interaction (mouse/touch drag) disables follow mode.
  const handleStart = useCallback(() => {
    followModeRef.current = false;
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
      onStart={handleStart}          // fires on mousedown / touchstart
    />
  );
}
