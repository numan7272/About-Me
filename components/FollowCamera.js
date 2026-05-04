"use client";

import { useRef, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

// ─────────────────────────────────────────────────────────────────────────────
// Bruno Simon-style hybrid follow camera
//
// FOLLOW MODE ON  (followModeRef.current === true)
//   ↳ camera.position  lerps → fixed isometric offset above the bike
//   ↳ OrbitControls.target lerps → bike world position
//   Both lerp simultaneously so the view feels rigidly locked to the bike
//   while still being visually smooth.
//
// FOLLOW MODE OFF (user dragged/rotated manually)
//   ↳ OrbitControls has full, unrestricted control (zoom, pan, orbit).
//   ↳ follow mode re-engages automatically the next time a drive key is
//     pressed (logic lives in Player.js to keep this component pure).
//
// The "Zentrieren" button has been removed — driving re-centers.
// ─────────────────────────────────────────────────────────────────────────────

// ── Tune these two constants to adjust the chase-cam feel ──────────────────
// CAM_OFFSET: world-space offset from the bike (isometric 3/4 view)
const CAM_OFFSET = new THREE.Vector3(14, 18, 14);
// Lerp alpha per frame (higher = snappier; lower = dreamier)
const CAM_LERP   = 0.07;   // camera body catch-up speed
const TGT_LERP   = 0.10;   // orbit target tracking speed (slightly faster)

export default function FollowCamera({ targetRef, followModeRef, orbitRef }) {
  const { camera } = useThree();

  // Pre-allocated scratch Vectors — allocated once, mutated every frame
  const desiredCamPos  = useRef(new THREE.Vector3()).current;
  const desiredTarget  = useRef(new THREE.Vector3()).current;

  useFrame(() => {
    if (!targetRef.current || !orbitRef.current) return;

    const pos = targetRef.current.translation(); // Rapier Vector3

    if (!followModeRef.current) {
      // OrbitControls is fully in charge — nothing to do here
      return;
    }

    // ── Desired camera position: bike position + fixed isometric offset ──
    desiredCamPos.set(
      pos.x + CAM_OFFSET.x,
      pos.y + CAM_OFFSET.y,
      pos.z + CAM_OFFSET.z,
    );

    // ── Desired look-at target: slightly above the bike saddle ──────────
    desiredTarget.set(pos.x, pos.y + 0.8, pos.z);

    // Lerp both simultaneously
    camera.position.lerp(desiredCamPos, CAM_LERP);
    orbitRef.current.target.lerp(desiredTarget, TGT_LERP);

    // MUST call update() after manually mutating .target so OrbitControls
    // internal state stays in sync — prevents a snap on the next user drag.
    orbitRef.current.update();
  });

  // Disable follow mode only on deliberate user gesture (mousedown / touchstart),
  // NOT on onChange which fires during OrbitControls' own damping animation.
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
      onStart={handleStart}
    />
  );
}
