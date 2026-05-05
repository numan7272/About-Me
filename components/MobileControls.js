"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { touchInput, resetTouchInput } from "@/lib/inputStore";
import { bikeState } from "@/lib/bikeStore";

/**
 * Bruno-Simon-style 3D joystick.
 *
 * The bike sits in the centre of two concentric outline rings drawn flat on
 * the ground.  When the player taps & drags inside the dial, a bright sweep
 * arc points outward in the direction of the touch — that direction is what
 * the bike steers toward.  No floating knob, no offset — purely a directional
 * compass that orbits the bike.
 *
 * Reads bike position from `bikeState`, writes input into `touchInput`. The
 * dial's local frame is yaw-aligned to the camera each frame so that pulling
 * the touch "up" on screen always means "drive forward".
 */

const INNER_R    = 1.7;
const OUTER_R    = 2.9;
const RING_W     = 0.07;          // outline thickness (geometry-only, fixed)
const ARC_SPREAD = Math.PI / 3.8; // ~47° wedge
const CAPTURE_R  = OUTER_R + 1.2; // touch tolerance beyond the outer ring
const DEADZONE   = 0.10;

export default function MobileControls() {
  const { camera, gl } = useThree();
  const groupRef   = useRef();
  const arcRef     = useRef();
  const arcMatRef  = useRef();
  const innerMatRef = useRef();
  const outerMatRef = useRef();

  const activeRef  = useRef(false);
  const pointerId  = useRef(null);

  const [enabled, setEnabled] = useState(false);

  // Detect touch viewport once on mount
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

  // Scratch vectors / matrix
  const camFwd      = useMemo(() => new THREE.Vector3(), []);
  const camRight    = useMemo(() => new THREE.Vector3(), []);
  const tmpLocal    = useMemo(() => new THREE.Vector3(), []);
  const tmpHit      = useMemo(() => new THREE.Vector3(), []);
  const basis       = useMemo(() => new THREE.Matrix4(), []);
  const xAxis       = useMemo(() => new THREE.Vector3(), []);
  const yAxis       = useMemo(() => new THREE.Vector3(), []);
  const zAxis       = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const dragNDC     = useMemo(() => new THREE.Vector2(), []);
  const dragRay     = useMemo(() => new THREE.Raycaster(), []);
  const dragPlane   = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.04), []);

  // ── Per-frame: re-orient dial, animate arc opacity + direction ───────────
  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;

    // Camera-forward & camera-right in the XZ plane
    camera.getWorldDirection(camFwd);
    camFwd.y = 0;
    if (camFwd.lengthSq() < 1e-6) camFwd.set(0, 0, -1);
    camFwd.normalize();
    camRight.set(-camFwd.z, 0, camFwd.x);

    // Build the dial's basis: local +X = camera-right, +Y = camera-forward,
    // +Z = world-up. After this, ring geometry drawn in the local XY plane
    // lies flat on the ground with "up" on the dial = camera-forward.
    xAxis.set(camRight.x, 0, camRight.z);
    yAxis.set(camFwd.x,   0, camFwd.z);
    basis.makeBasis(xAxis, yAxis, zAxis);
    g.quaternion.setFromRotationMatrix(basis);
    g.position.set(bikeState.x, 0.04, bikeState.z);

    // Arc visual: rotate to face touch direction, fade in/out with magnitude
    const arc = arcRef.current;
    const mag = Math.hypot(touchInput.joystickX, touchInput.joystickY);
    const targetAngle = mag > DEADZONE
      ? Math.atan2(touchInput.joystickY, touchInput.joystickX)
      : (arc ? arc.rotation.z : 0);

    if (arc) {
      // Shortest-path lerp toward target angle so it never spins long way round
      let dz = targetAngle - arc.rotation.z;
      while (dz >  Math.PI) dz -= Math.PI * 2;
      while (dz < -Math.PI) dz += Math.PI * 2;
      arc.rotation.z += dz * Math.min(1, 22 * delta);
    }

    if (arcMatRef.current) {
      const targetOpacity = activeRef.current && mag > DEADZONE
        ? Math.min(1, mag) * 0.85
        : 0.0;
      arcMatRef.current.opacity = THREE.MathUtils.lerp(
        arcMatRef.current.opacity,
        targetOpacity,
        Math.min(1, 14 * delta),
      );
    }

    // Subtle pulse on the rings while idle so the dial doesn't read as static
    const t = performance.now() * 0.001;
    if (innerMatRef.current) {
      innerMatRef.current.opacity = 0.32 + Math.sin(t * 1.4) * 0.08;
    }
    if (outerMatRef.current) {
      outerMatRef.current.opacity = 0.55 + Math.sin(t * 1.4 + 0.6) * 0.10;
    }
  });

  // ── Pointer handlers ─────────────────────────────────────────────────────
  // We compute the dial-local touch position by raycasting from screen-space
  // coordinates onto a horizontal plane at the dial's height. This works
  // whether or not the cursor is currently over the capture mesh — letting
  // the user drag their finger outside the dial without losing the input.
  const writeFromClient = useCallback((clientX, clientY) => {
    const g = groupRef.current;
    if (!g) return;
    const rect = gl.domElement.getBoundingClientRect();
    dragNDC.x = ((clientX - rect.left) / rect.width)  * 2 - 1;
    dragNDC.y = -((clientY - rect.top)  / rect.height) * 2 + 1;
    dragRay.setFromCamera(dragNDC, camera);
    if (!dragRay.ray.intersectPlane(dragPlane, tmpHit)) return;

    tmpLocal.copy(tmpHit);
    g.worldToLocal(tmpLocal);

    let dx = tmpLocal.x;
    let dy = tmpLocal.y;
    const dist = Math.hypot(dx, dy);
    if (dist > CAPTURE_R) {
      dx = (dx / dist) * CAPTURE_R;
      dy = (dy / dist) * CAPTURE_R;
    }

    const nx  = THREE.MathUtils.clamp(dx / OUTER_R, -1, 1);
    const ny  = THREE.MathUtils.clamp(dy / OUTER_R, -1, 1);
    const mag = Math.hypot(nx, ny);
    touchInput.joystickX = mag < DEADZONE ? 0 : nx;
    touchInput.joystickY = mag < DEADZONE ? 0 : ny;
  }, [camera, gl, dragNDC, dragRay, dragPlane, tmpHit, tmpLocal]);

  const release = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current         = false;
    pointerId.current         = null;
    touchInput.joystickActive = false;
    touchInput.joystickX      = 0;
    touchInput.joystickY      = 0;
  }, []);

  // While dragging, listen at the window level so the gesture survives the
  // finger leaving the dial / canvas / browser chrome (e.g. pull-to-refresh).
  useEffect(() => {
    if (!enabled) return;
    const onMove = (e) => {
      if (!activeRef.current || e.pointerId !== pointerId.current) return;
      writeFromClient(e.clientX, e.clientY);
    };
    const onUp = (e) => {
      if (e.pointerId !== pointerId.current) return;
      release();
    };
    window.addEventListener("pointermove",   onMove, { passive: true });
    window.addEventListener("pointerup",     onUp,   { passive: true });
    window.addEventListener("pointercancel", onUp,   { passive: true });
    return () => {
      window.removeEventListener("pointermove",   onMove);
      window.removeEventListener("pointerup",     onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [enabled, writeFromClient, release]);

  if (!enabled) return null;

  const onPointerDown = (e) => {
    e.stopPropagation();
    activeRef.current = true;
    pointerId.current = e.pointerId;
    touchInput.joystickActive = true;
    writeFromClient(e.clientX, e.clientY);
  };

  return (
    <group ref={groupRef}>
      {/* Outer ring outline */}
      <mesh renderOrder={2}>
        <ringGeometry args={[OUTER_R - RING_W, OUTER_R, 96]} />
        <meshBasicMaterial
          ref={outerMatRef}
          color="#ffffff"
          transparent
          opacity={0.55}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Inner ring outline */}
      <mesh position={[0, 0, 0.001]} renderOrder={2}>
        <ringGeometry args={[INNER_R - RING_W * 0.8, INNER_R, 80]} />
        <meshBasicMaterial
          ref={innerMatRef}
          color="#ffffff"
          transparent
          opacity={0.32}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Sweep arc — rotates around the dial's local +Z to point at touch.
          Geometry centred on +X (theta=0); rotation.z aligns it with the
          input vector. */}
      <group ref={arcRef}>
        <mesh position={[0, 0, 0.002]} renderOrder={3}>
          <ringGeometry
            args={[INNER_R + 0.04, OUTER_R - 0.02, 48, 1,
                   -ARC_SPREAD / 2, ARC_SPREAD]}
          />
          <meshBasicMaterial
            ref={arcMatRef}
            color="#ffffff"
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Capture disc — invisible. Only fires onPointerDown; the rest of the
          drag is handled by window-level listeners (see useEffect above). */}
      <mesh position={[0, 0, 0.05]} onPointerDown={onPointerDown}>
        <circleGeometry args={[CAPTURE_R, 48]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
