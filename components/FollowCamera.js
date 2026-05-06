"use client";

import { useRef, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import { shakeState } from "@/lib/cameraShake";

// Chase-cam offset above/behind the bike (world-space isometric).
// Tightened from (14, 18, 14) so the bike fills more of the frame on
// load; orbit zoom still works freely after the player drags.
const CAM_OFFSET = new THREE.Vector3(11, 14, 11);
const CAM_LERP   = 0.07;   // camera body catch-up speed (lower = dreamier)
const TGT_LERP   = 0.10;   // orbit target tracking speed

// Shake feel
const SHAKE_FREQ_X = 38;
const SHAKE_FREQ_Y = 47;
const SHAKE_FREQ_Z = 31;
const SHAKE_DECAY  = 4.5;   // higher = settles faster

export default function FollowCamera({ targetRef, followModeRef, orbitRef }) {
  const { camera } = useThree();

  const desiredCamPos = useRef(new THREE.Vector3()).current;
  const desiredTarget = useRef(new THREE.Vector3()).current;
  const shakeOffset   = useRef(new THREE.Vector3()).current;

  useFrame((state, delta) => {
    if (!orbitRef?.current) return;

    // ── 1) follow logic ─────────────────────────────────────────────────
    if (targetRef?.current && followModeRef.current) {
      const pos = targetRef.current.translation();

      desiredCamPos.set(
        pos.x + CAM_OFFSET.x,
        pos.y + CAM_OFFSET.y,
        pos.z + CAM_OFFSET.z,
      );
      desiredTarget.set(pos.x, pos.y + 0.8, pos.z);

      // First, undo last frame's shake offset so we lerp from the *clean*
      // camera-follow state — otherwise lerp would slowly absorb shake
      // jitter into our settle target.
      camera.position.sub(shakeOffset);

      camera.position.lerp(desiredCamPos, CAM_LERP);
      orbitRef.current.target.lerp(desiredTarget, TGT_LERP);
      orbitRef.current.update();
    } else {
      // Free-look: still strip the previous shake offset before re-applying
      camera.position.sub(shakeOffset);
    }

    // ── 2) camera shake (always applies, including free-look) ───────────
    if (shakeState.intensity > 0.0005) {
      const s = shakeState.intensity;
      const t = state.clock.elapsedTime;
      shakeOffset.set(
        Math.sin(t * SHAKE_FREQ_X) * s * 0.45,
        Math.sin(t * SHAKE_FREQ_Y) * s * 0.30,
        Math.sin(t * SHAKE_FREQ_Z) * s * 0.45,
      );
      camera.position.add(shakeOffset);
      shakeState.intensity *= Math.exp(-SHAKE_DECAY * delta);
    } else {
      shakeOffset.set(0, 0, 0);
      shakeState.intensity = 0;
    }
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
