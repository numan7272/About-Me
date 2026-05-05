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

// ─── Smoke Particle System ────────────────────────────────────────────────────
// 40 quads recycled via a pool pattern. Each particle stores its state in
// Float32Arrays so we never allocate per-frame.
const SMOKE_COUNT = 40;

function SmokeParticles({ playerRef }) {
  const meshRef      = useRef();
  const clockRef     = useRef(0);
  const nextEmit     = useRef(0);

  // Per-particle state (all flat arrays, zero GC)
  const px   = useRef(new Float32Array(SMOKE_COUNT));
  const py   = useRef(new Float32Array(SMOKE_COUNT));
  const pz   = useRef(new Float32Array(SMOKE_COUNT));
  const vx   = useRef(new Float32Array(SMOKE_COUNT));
  const vy   = useRef(new Float32Array(SMOKE_COUNT));
  const vz   = useRef(new Float32Array(SMOKE_COUNT));
  const life = useRef(new Float32Array(SMOKE_COUNT));
  const maxL = useRef(new Float32Array(SMOKE_COUNT));
  const sc   = useRef(new Float32Array(SMOKE_COUNT));
  const rot  = useRef(new Float32Array(SMOKE_COUNT));
  const rvel = useRef(new Float32Array(SMOKE_COUNT));
  const pool = useRef(0);

  // Shared geometry + material (single draw call)
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1);
    return g;
  }, []);

  const mat = useMemo(() => new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.78, 0.78, 0.82),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), []);

  // We render each particle as a separate mesh child — but all share the same
  // geometry/material via InstancedMesh for efficiency.
  const dummy     = useMemo(() => new THREE.Object3D(), []);
  const colorArr  = useMemo(() => new Float32Array(SMOKE_COUNT * 4), []);

  const instRef = useRef();
  const instGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const instMat = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexColors: false,
    });
    return m;
  }, []);

  useEffect(() => {
    // Initialise all particles as dead (life = 0)
    life.current.fill(0);
  }, []);

  useFrame((state, delta) => {
    const inst = instRef.current;
    if (!inst) return;
    const body = playerRef.current;

    clockRef.current += delta;
    const t    = clockRef.current;
    const dt   = Math.min(delta, 0.05);

    // ── Emission ──────────────────────────────────────────────────────────────
    let speed = 0;
    if (body) {
      const v = body.linvel();
      speed = Math.hypot(v.x, v.z);
    }

    const emitRate = speed > 0.5 ? 0.035 : 0; // seconds between particles
    if (emitRate > 0 && t > nextEmit.current && body) {
      nextEmit.current = t + emitRate;
      const i = pool.current % SMOKE_COUNT;
      pool.current++;

      const pos  = body.translation();
      const bvel = body.linvel();

      // Spawn at wheel position (slightly behind + at ground level)
      const rot2  = body.rotation();
      const q     = new THREE.Quaternion(rot2.x, rot2.y, rot2.z, rot2.w);
      const back  = new THREE.Vector3(0, 0, -0.9).applyQuaternion(q);

      px.current[i]  = pos.x + back.x + (Math.random()-0.5)*0.25;
      py.current[i]  = 0.18;
      pz.current[i]  = pos.z + back.z + (Math.random()-0.5)*0.25;

      const spread = 0.4;
      vx.current[i]  = -bvel.x * 0.08 + (Math.random()-0.5)*spread;
      vy.current[i]  = 0.35 + Math.random()*0.55;
      vz.current[i]  = -bvel.z * 0.08 + (Math.random()-0.5)*spread;

      const lifeT    = 0.55 + Math.random()*0.45;
      life.current[i] = lifeT;
      maxL.current[i] = lifeT;
      sc.current[i]   = 0.18 + Math.random()*0.22;
      rot.current[i]  = Math.random()*Math.PI*2;
      rvel.current[i] = (Math.random()-0.5)*1.2;
    }

    // ── Update & render each particle ────────────────────────────────────────
    for (let i = 0; i < SMOKE_COUNT; i++) {
      if (life.current[i] <= 0) {
        // park off-screen
        dummy.position.set(0, -999, 0);
        dummy.scale.setScalar(0.001);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
        inst.setColorAt(i, new THREE.Color(0,0,0));
        continue;
      }

      life.current[i] -= dt;

      // Update position
      const drag = 1 - 0.9*dt;
      vx.current[i] *= drag;
      vz.current[i] *= drag;
      vy.current[i] -= 0.12*dt; // slight gravity
      px.current[i] += vx.current[i]*dt;
      py.current[i] += vy.current[i]*dt;
      pz.current[i] += vz.current[i]*dt;
      rot.current[i] += rvel.current[i]*dt;

      // Life fraction 0→1 (1=just born, 0=dead)
      const frac  = Math.max(0, life.current[i] / maxL.current[i]);
      // Grow as it ages, fade out
      const scale = sc.current[i] * (1 + (1-frac)*2.2);
      const alpha = frac < 0.2 ? frac/0.2 : frac; // fade in quick, linger
      const finalAlpha = alpha * 0.55;

      dummy.position.set(px.current[i], py.current[i], pz.current[i]);
      dummy.rotation.set(0, 0, rot.current[i]);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);

      // Grey colour, slightly warm
      const grey = 0.72 + frac*0.12;
      const col  = new THREE.Color(grey, grey-0.02, grey-0.04);
      col.multiplyScalar(finalAlpha);
      inst.setColorAt(i, col);
    }

    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={instRef}
      args={[instGeo, instMat, SMOKE_COUNT]}
      frustumCulled={false}
    />
  );
}

// ─── Speed-lines (radial streaks when going fast) ─────────────────────────────
const LINE_COUNT = 18;
function SpeedLines({ playerRef }) {
  const groupRef = useRef();
  const linesRef = useRef([]);

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    linesRef.current = [];
    for (let i = 0; i < LINE_COUNT; i++) {
      const geo = new THREE.BufferGeometry();
      const pts = new Float32Array(6); // 2 points × 3 coords
      geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
      const mat = new THREE.LineBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      g.add(line);
      linesRef.current.push({ line, geo });
    }
  }, []);

  const tmpV = useMemo(() => new THREE.Vector3(), []);
  const tmpQ = useMemo(() => new THREE.Quaternion(), []);

  useFrame((state, delta) => {
    const body = playerRef.current;
    if (!body || !groupRef.current) return;

    const vel    = body.linvel();
    const speed  = Math.hypot(vel.x, vel.z);
    const t      = state.clock.getElapsedTime();
    const active = speed > MAX_SPEED * 0.72;
    const alpha  = active ? Math.min(1,(speed - MAX_SPEED*0.72)/(MAX_SPEED*0.28)) * 0.28 : 0;

    const pos = body.translation();
    const rot = body.rotation();
    tmpQ.set(rot.x, rot.y, rot.z, rot.w);

    linesRef.current.forEach(({ line, geo }, i) => {
      const angleOffset = (i / LINE_COUNT) * Math.PI * 2;
      const r = 1.8 + Math.sin(t*6 + i)*0.3;
      const len = 0.6 + Math.random()*0.4;

      tmpV.set(Math.cos(angleOffset)*r, 0.6, Math.sin(angleOffset)*r);
      tmpV.applyQuaternion(tmpQ);

      const pts = geo.attributes.position.array;
      pts[0] = pos.x + tmpV.x;         pts[1] = pos.y + tmpV.y + 0.3; pts[2] = pos.z + tmpV.z;
      pts[3] = pos.x + tmpV.x*len;     pts[4] = pos.y + tmpV.y + 0.3; pts[5] = pos.z + tmpV.z*len;
      geo.attributes.position.needsUpdate = true;

      line.material.opacity = alpha * (0.6 + Math.sin(t*14+i)*0.4);
    });
  });

  return <group ref={groupRef} />;
}

// ─── Skid Mark Decals (instanced quads left on the ground) ───────────────────
const SKID_MAX = 60;
function SkidMarks({ playerRef }) {
  const instRef  = useRef();
  const dummy    = useMemo(() => new THREE.Object3D(), []);
  const skidGeo  = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const skidMat  = useMemo(() => new THREE.MeshBasicMaterial({
    color: 0x111116, transparent: true, opacity: 0.45,
    depthWrite: false, side: THREE.DoubleSide,
  }), []);

  const nextSkid = useRef(0);
  const headIdx  = useRef(0);
  const alphas   = useRef(new Float32Array(SKID_MAX).fill(0));
  const tmpQ     = useMemo(() => new THREE.Quaternion(), []);
  const tmpE     = useMemo(() => new THREE.Euler(), []);

  useEffect(() => {
    const inst = instRef.current;
    if (!inst) return;
    // Park all off-screen initially
    for (let i = 0; i < SKID_MAX; i++) {
      dummy.position.set(0, -999, 0); dummy.scale.setScalar(0.001); dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      inst.setColorAt(i, new THREE.Color(0,0,0));
    }
    inst.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  useFrame((state, delta) => {
    const inst = instRef.current;
    const body = playerRef.current;
    if (!inst || !body) return;

    const vel   = body.linvel();
    const speed = Math.hypot(vel.x, vel.z);
    const rot2  = body.rotation();
    const t     = state.clock.getElapsedTime();

    // Emit a skid mark stamp when turning at speed
    const angVel = body.angvel();
    const isTurning = Math.abs(angVel.y) > 0.4 && speed > 1.5;

    if (isTurning && t > nextSkid.current) {
      nextSkid.current = t + 0.08;
      const i   = headIdx.current % SKID_MAX;
      headIdx.current++;

      const pos = body.translation();
      tmpQ.set(rot2.x, rot2.y, rot2.z, rot2.w);
      tmpE.setFromQuaternion(tmpQ, 'YXZ');

      dummy.position.set(pos.x, 0.013, pos.z);
      dummy.rotation.set(-Math.PI/2, 0, tmpE.y);
      dummy.scale.set(0.38 + Math.random()*0.12, 0.9 + Math.random()*0.4, 1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);

      const dark = 0.07 + Math.random()*0.04;
      inst.setColorAt(i, new THREE.Color(dark, dark, dark*1.05));
      alphas.current[i] = 1;

      inst.instanceMatrix.needsUpdate = true;
      inst.instanceColor.needsUpdate  = true;
    }
  });

  return (
    <instancedMesh
      ref={instRef}
      args={[skidGeo, skidMat, SKID_MAX]}
      frustumCulled={false}
    />
  );
}

// ─── Bike lean (tilt into turns) ─────────────────────────────────────────────
const leanAngle = { value: 0 };

// ─── VanMoof Model ────────────────────────────────────────────────────────────
function VanMoofModel({ scale = 1, leanRef }) {
  const { scene } = useGLTF(BIKE_URL);
  const groupRef  = useRef();

  useEffect(() => {
    scene.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow    = true;
      o.receiveShadow = true;
      if (o.material) {
        o.material.roughness       = Math.min(o.material.roughness  ?? 0.5, 0.4);
        o.material.metalness       = Math.max(o.material.metalness  ?? 0.2, 0.4);
        o.material.envMapIntensity = 1.2;
      }
    });
  }, [scene]);

  useFrame((_, delta) => {
    if (!groupRef.current || !leanRef) return;
    const target = leanRef.current;
    groupRef.current.rotation.z = THREE.MathUtils.lerp(
      groupRef.current.rotation.z, target, Math.min(1, 8*delta),
    );
  });

  return (
    <group ref={groupRef} rotation={[0, -Math.PI / 2, 0]}>
      <primitive object={scene} scale={scale} />
    </group>
  );
}

useGLTF.preload(BIKE_URL);

// ─── Player ───────────────────────────────────────────────────────────────────
export default function Player({ playerRef, followModeRef }) {
  const [, getKeys]  = useKeyboardControls();
  const leanRef      = useRef(0);
  const tmpForward   = useMemo(() => new THREE.Vector3(), []);
  const tmpQuat      = useMemo(() => new THREE.Quaternion(), []);

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
    const cur    = body.linvel();
    const lerpT  = Math.min(1, ACCEL * delta);
    const brakeT = brakeDown ? Math.min(1, 10 * delta) : lerpT;

    body.setLinvel({
      x: brakeDown
        ? THREE.MathUtils.lerp(cur.x, 0, brakeT)
        : THREE.MathUtils.lerp(cur.x, tmpForward.x * targetSpeed, lerpT),
      y: cur.y,
      z: brakeDown
        ? THREE.MathUtils.lerp(cur.z, 0, brakeT)
        : THREE.MathUtils.lerp(cur.z, tmpForward.z * targetSpeed, lerpT),
    }, true);

    const groundSpeed = Math.hypot(cur.x, cur.z);
    const speedFactor = turnIn !== 0
      ? THREE.MathUtils.clamp(groundSpeed / MAX_SPEED, 0.55, 1)
      : 0;
    body.setAngvel({
      x: 0,
      y: turnIn !== 0 ? turnIn * TURN_SPEED * speedFactor : 0,
      z: 0,
    }, true);

    // ── Lean into turns ─────────────────────────────────────────────────────
    const targetLean = -turnIn * speedFactor * 0.18;
    leanRef.current = THREE.MathUtils.lerp(leanRef.current, targetLean, Math.min(1,6*delta));
  });

  return (
    <>
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
        <VanMoofModel scale={1} leanRef={leanRef} />
      </RigidBody>

      {/* Effects live OUTSIDE the RigidBody (world-space) */}
      <SmokeParticles playerRef={playerRef} />
      <SpeedLines     playerRef={playerRef} />
      <SkidMarks      playerRef={playerRef} />
    </>
  );
}
