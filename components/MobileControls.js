"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { touchInput, resetTouchInput } from "@/lib/inputStore";
import { bikeState } from "@/lib/bikeStore";

/**
 * Bruno-Simon-style 3D joystick — a glowing dial on the ground next to the
 * bike. The base ring lies flat on the floor, a metallic knob hovers in the
 * centre and tilts toward the player's finger. It rides along with the bike
 * (offset to the camera-right) so the user's thumb stays in roughly the same
 * screen spot while driving.
 *
 * Reads bike position from `bikeState` (no playerRef threading) and writes
 * joystick output into `touchInput`, just like the previous 2D HUD did.
 */

const RING_OUTER  = 1.55;
const RING_INNER  = 1.18;
const KNOB_R      = 0.42;
const MAX_OFFSET  = (RING_OUTER - KNOB_R) * 0.78;
const DEADZONE    = 0.08;
const HOVER_Y     = 0.18;
const SCREEN_X    = 2.6;  // camera-right offset from the bike

export default function MobileControls() {
  const { camera, gl } = useThree();
  const groupRef   = useRef();
  const knobRef    = useRef();
  const captureRef = useRef();

  const activeRef  = useRef(false);
  const pointerId  = useRef(null);
  const knob2D     = useRef({ x: 0, y: 0 });

  const [enabled, setEnabled] = useState(false);

  // Detect touch viewport once on mount (avoids SSR mismatch)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isTouch =
      window.matchMedia("(hover: none)").matches ||
      window.matchMedia("(max-width: 767px)").matches;
    setEnabled(isTouch);
  }, []);

  // Reset input if the tab loses focus mid-drag
  useEffect(() => {
    if (!enabled) return;
    const cleanup = () => {
      activeRef.current = false;
      pointerId.current = null;
      knob2D.current    = { x: 0, y: 0 };
      resetTouchInput();
    };
    window.addEventListener("blur", cleanup);
    window.addEventListener("visibilitychange", cleanup);
    return () => {
      window.removeEventListener("blur", cleanup);
      window.removeEventListener("visibilitychange", cleanup);
      resetTouchInput();
    };
  }, [enabled]);

  // Reusable scratch vectors
  const camFwd  = useMemo(() => new THREE.Vector3(), []);
  const camRight = useMemo(() => new THREE.Vector3(), []);
  const tmpLocal = useMemo(() => new THREE.Vector3(), []);

  // ── Per-frame: position group, animate knob ──────────────────────────────
  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;

    // Camera-right (XZ plane) so the dial always sits to the user's right
    camera.getWorldDirection(camFwd);
    camFwd.y = 0;
    if (camFwd.lengthSq() < 1e-6) camFwd.set(0, 0, -1);
    camFwd.normalize();
    camRight.set(-camFwd.z, 0, camFwd.x);

    g.position.set(
      bikeState.x + camRight.x * SCREEN_X,
      0.06,
      bikeState.z + camRight.z * SCREEN_X,
    );
    // Yaw the dial so its local +Y (after the -π/2 X tilt) points along
    // camera-forward — i.e. pushing the knob away from the user always means
    // "drive forward in screen space". Derivation: with XYZ Euler order, the
    // X-tilt maps local +Y → world -Z, so rotation.z = atan2(-camFwd.x,
    // -camFwd.z) lines local +Y up with the world camera-forward direction.
    g.rotation.set(-Math.PI / 2, 0, 0);
    g.rotation.z = Math.atan2(-camFwd.x, -camFwd.z);

    // Knob: lerp toward the active finger position (or zero on release)
    const knob = knobRef.current;
    if (knob) {
      const targetX = activeRef.current ? knob2D.current.x : 0;
      const targetY = activeRef.current ? knob2D.current.y : 0;
      const t = Math.min(1, 18 * delta);
      knob.position.x = THREE.MathUtils.lerp(knob.position.x, targetX, t);
      knob.position.y = THREE.MathUtils.lerp(knob.position.y, targetY, t);
      // Subtle hover bob when idle
      const idle = !activeRef.current ? Math.sin(performance.now() * 0.003) * 0.03 : 0;
      knob.position.z = HOVER_Y + idle;
    }
  });

  if (!enabled) return null;

  // ── Pointer handlers (raycast hits the capture disc; `e.point` is world) ─
  const updateFromEvent = (e) => {
    const g = groupRef.current;
    if (!g) return;
    // Convert world hit point into the dial's local frame. After the rotations
    // above, local +X is "right" in screen space and local +Y is "forward".
    tmpLocal.copy(e.point);
    g.worldToLocal(tmpLocal);

    let dx = tmpLocal.x;
    let dy = tmpLocal.y;
    const dist = Math.hypot(dx, dy);
    if (dist > MAX_OFFSET) {
      dx = (dx / dist) * MAX_OFFSET;
      dy = (dy / dist) * MAX_OFFSET;
    }
    knob2D.current.x = dx;
    knob2D.current.y = dy;

    const nx  = dx / MAX_OFFSET;
    const ny  = dy / MAX_OFFSET;
    const mag = Math.hypot(nx, ny);
    touchInput.joystickX = mag < DEADZONE ? 0 : nx;
    touchInput.joystickY = mag < DEADZONE ? 0 : ny;
  };

  const onPointerDown = (e) => {
    e.stopPropagation();
    activeRef.current = true;
    pointerId.current = e.pointerId;
    touchInput.joystickActive = true;
    gl.domElement.setPointerCapture?.(e.pointerId);
    updateFromEvent(e);
  };

  const onPointerMove = (e) => {
    if (!activeRef.current || e.pointerId !== pointerId.current) return;
    e.stopPropagation();
    updateFromEvent(e);
  };

  const onPointerUp = (e) => {
    if (e.pointerId !== pointerId.current) return;
    e.stopPropagation();
    gl.domElement.releasePointerCapture?.(e.pointerId);
    activeRef.current         = false;
    pointerId.current         = null;
    touchInput.joystickActive = false;
    touchInput.joystickX      = 0;
    touchInput.joystickY      = 0;
    knob2D.current            = { x: 0, y: 0 };
  };

  return (
    <group ref={groupRef}>
      {/* Soft glow base disc (slightly below the ring) */}
      <mesh position={[0, 0, -0.005]} renderOrder={1}>
        <circleGeometry args={[RING_OUTER * 1.05, 48]} />
        <meshBasicMaterial
          color="#0c1426"
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </mesh>

      {/* Outer ring */}
      <mesh position={[0, 0, 0.001]} renderOrder={2}>
        <ringGeometry args={[RING_INNER, RING_OUTER, 64]} />
        <meshStandardMaterial
          color="#1f2a44"
          metalness={0.6}
          roughness={0.35}
          emissive="#3b82f6"
          emissiveIntensity={0.18}
        />
      </mesh>

      {/* Bright outline on the outside of the ring */}
      <mesh position={[0, 0, 0.002]} renderOrder={3}>
        <ringGeometry args={[RING_OUTER - 0.04, RING_OUTER, 64]} />
        <meshBasicMaterial
          color="#7dd3fc"
          transparent
          opacity={0.8}
          toneMapped={false}
        />
      </mesh>

      {/* Forward arrow tick marks at N/E/S/W. The "forward" (camera-away)
          direction is local +Y, so the angle π/2 dot is the bright gold one. */}
      {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((ang, i) => {
        const isForward = i === 1;
        return (
          <mesh
            key={i}
            position={[
              Math.cos(ang) * (RING_INNER - 0.13),
              Math.sin(ang) * (RING_INNER - 0.13),
              0.003,
            ]}
            renderOrder={3}
          >
            <circleGeometry args={[isForward ? 0.085 : 0.07, 16]} />
            <meshBasicMaterial
              color={isForward ? "#fde68a" : "#7dd3fc"}
              transparent
              opacity={isForward ? 0.95 : 0.5}
              toneMapped={false}
            />
          </mesh>
        );
      })}

      {/* Invisible capture disc — catches all pointer events for the dial */}
      <mesh
        ref={captureRef}
        position={[0, 0, 0.05]}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={(e) => {
          if (activeRef.current && e.pointerId === pointerId.current) onPointerUp(e);
        }}
      >
        <circleGeometry args={[RING_OUTER * 1.15, 32]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Knob — metallic sphere that hovers above the ring */}
      <mesh ref={knobRef} position={[0, 0, HOVER_Y]} castShadow>
        <sphereGeometry args={[KNOB_R, 24, 24]} />
        <meshStandardMaterial
          color="#e2e8f0"
          metalness={0.85}
          roughness={0.22}
          emissive="#7dd3fc"
          emissiveIntensity={0.35}
        />
      </mesh>

      {/* Tiny halo under the knob */}
      <mesh position={[0, 0, 0.012]} renderOrder={2}>
        <circleGeometry args={[KNOB_R * 1.4, 32]} />
        <meshBasicMaterial
          color="#7dd3fc"
          transparent
          opacity={0.18}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
