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

// ─────────────────────────────────────────────────────────────────────────────
// SMOKE PARTICLES
// ─────────────────────────────────────────────────────────────────────────────
// 40 recycled instanced quads. All particle state lives in flat Float32Arrays
// (zero per-frame GC). InstancedMesh gives a single draw call.
const SMOKE_COUNT = 40;

function SmokeParticles({ playerRef }) {
  const instRef  = useRef();
  const clockRef = useRef(0);
  const nextEmit = useRef(0);
  const pool     = useRef(0);

  // Flat arrays — one slot per particle
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

  const dummy   = useMemo(() => new THREE.Object3D(), []);
  const instGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const instMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexColors: true,   // ← required for setColorAt to have any effect
  }), []);

  // Initialise: park all particles off-screen and prime instanceColor buffer
  useEffect(() => {
    const inst = instRef.current;
    if (!inst) return;
    life.current.fill(0);
    const black = new THREE.Color(0, 0, 0);
    for (let i = 0; i < SMOKE_COUNT; i++) {
      dummy.position.set(0, -999, 0);
      dummy.scale.setScalar(0.001);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      inst.setColorAt(i, black);        // ← allocates instanceColor buffer
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.instanceColor.needsUpdate  = true;
  }, [dummy]);

  const tmpQ  = useMemo(() => new THREE.Quaternion(), []);
  const tmpB  = useMemo(() => new THREE.Vector3(), []);
  const tmpC  = useMemo(() => new THREE.Color(), []);

  useFrame((_, delta) => {
    const inst = instRef.current;
    if (!inst) return;
    const body = playerRef.current;

    clockRef.current += delta;
    const t  = clockRef.current;
    const dt = Math.min(delta, 0.05);

    // ── Emission ────────────────────────────────────────────────────────────
    let speed = 0;
    if (body) { const v = body.linvel(); speed = Math.hypot(v.x, v.z); }

    if (speed > 0.5 && t > nextEmit.current && body) {
      nextEmit.current = t + 0.035;
      const i = pool.current % SMOKE_COUNT;
      pool.current++;

      const pos  = body.translation();
      const bvel = body.linvel();
      const r2   = body.rotation();
      tmpQ.set(r2.x, r2.y, r2.z, r2.w);
      tmpB.set(0, 0, -0.9).applyQuaternion(tmpQ);

      px.current[i] = pos.x + tmpB.x + (Math.random()-0.5)*0.25;
      py.current[i] = 0.18;
      pz.current[i] = pos.z + tmpB.z + (Math.random()-0.5)*0.25;

      vx.current[i] = -bvel.x * 0.08 + (Math.random()-0.5)*0.4;
      vy.current[i] = 0.35 + Math.random()*0.55;
      vz.current[i] = -bvel.z * 0.08 + (Math.random()-0.5)*0.4;

      const lifeT    = 0.55 + Math.random()*0.45;
      life.current[i] = lifeT;
      maxL.current[i] = lifeT;
      sc.current[i]   = 0.18 + Math.random()*0.22;
      rot.current[i]  = Math.random()*Math.PI*2;
      rvel.current[i] = (Math.random()-0.5)*1.2;
    }

    // ── Update all particles ──────────────────────────────────────────────────
    for (let i = 0; i < SMOKE_COUNT; i++) {
      if (life.current[i] <= 0) {
        dummy.position.set(0, -999, 0);
        dummy.scale.setScalar(0.001);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
        inst.setColorAt(i, tmpC.set(0, 0, 0));
        continue;
      }

      life.current[i] -= dt;

      const drag = 1 - 0.9*dt;
      vx.current[i] *= drag;  vz.current[i] *= drag;
      vy.current[i] -= 0.12*dt;
      px.current[i] += vx.current[i]*dt;
      py.current[i] += vy.current[i]*dt;
      pz.current[i] += vz.current[i]*dt;
      rot.current[i] += rvel.current[i]*dt;

      const frac  = Math.max(0, life.current[i] / maxL.current[i]);
      const scale = sc.current[i] * (1 + (1-frac)*2.2);
      // Fade in fast (0→0.2), then fade out gently (0.2→1)
      const alpha = (frac < 0.2 ? frac/0.2 : frac) * 0.55;

      dummy.position.set(px.current[i], py.current[i], pz.current[i]);
      dummy.rotation.set(0, 0, rot.current[i]);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);

      // Premultiply colour by alpha so the BasicMaterial fakes transparency
      const grey = 0.72 + frac*0.12;
      tmpC.set(grey*alpha, (grey-0.02)*alpha, (grey-0.04)*alpha);
      inst.setColorAt(i, tmpC);
    }

    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={instRef} args={[instGeo, instMat, SMOKE_COUNT]} frustumCulled={false} />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SPEED LINES — radial additive streaks visible at >72% max speed
// ─────────────────────────────────────────────────────────────────────────────
// Each line has a seeded radius variation so they feel organic without
// calling Math.random() inside useFrame (which causes frame-to-frame jitter).
const LINE_COUNT = 18;
const LINE_SEED  = Array.from({ length: LINE_COUNT }, () => Math.random());

function SpeedLines({ playerRef }) {
  const groupRef = useRef();
  const linesRef = useRef([]);

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    linesRef.current = [];
    for (let i = 0; i < LINE_COUNT; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const mat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      g.add(line);
      linesRef.current.push({ line, geo, seed: LINE_SEED[i] });
    }
  }, []);

  const tmpV = useMemo(() => new THREE.Vector3(), []);
  const tmpQ = useMemo(() => new THREE.Quaternion(), []);

  useFrame((state) => {
    const body = playerRef.current;
    if (!body || !groupRef.current) return;

    const vel   = body.linvel();
    const speed = Math.hypot(vel.x, vel.z);
    const t     = state.clock.getElapsedTime();
    const alpha = speed > MAX_SPEED * 0.72
      ? Math.min(1, (speed - MAX_SPEED*0.72) / (MAX_SPEED*0.28)) * 0.28
      : 0;

    if (alpha === 0) {
      // Hide all lines without touching geometry
      for (const { line } of linesRef.current) line.material.opacity = 0;
      return;
    }

    const pos = body.translation();
    const r2  = body.rotation();
    tmpQ.set(r2.x, r2.y, r2.z, r2.w);

    linesRef.current.forEach(({ line, geo, seed }, i) => {
      const angle = (i / LINE_COUNT) * Math.PI * 2;
      // Seeded radius variation: no Math.random() in the hot path
      const r   = 1.6 + seed * 0.8 + Math.sin(t*6 + i)*0.25;
      const len = 0.55 + seed * 0.45;

      tmpV.set(Math.cos(angle)*r, 0.55, Math.sin(angle)*r).applyQuaternion(tmpQ);

      const pts = geo.attributes.position.array;
      pts[0] = pos.x + tmpV.x;       pts[1] = pos.y + 0.3 + tmpV.y; pts[2] = pos.z + tmpV.z;
      pts[3] = pos.x + tmpV.x*len;   pts[4] = pos.y + 0.3 + tmpV.y; pts[5] = pos.z + tmpV.z*len;
      geo.attributes.position.needsUpdate = true;

      // Flicker using seeded phase so each line pulses independently
      line.material.opacity = alpha * (0.5 + seed * 0.5 + Math.sin(t*12 + seed*10)*0.3);
    });
  });

  return <group ref={groupRef} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// SKID MARKS — instanced quads stamped on the ground when turning
// ─────────────────────────────────────────────────────────────────────────────
const SKID_MAX = 60;

function SkidMarks({ playerRef }) {
  const instRef  = useRef();
  const dummy    = useMemo(() => new THREE.Object3D(), []);
  const skidGeo  = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const skidMat  = useMemo(() => new THREE.MeshBasicMaterial({
    color: 0xffffff,        // colour driven by setColorAt
    transparent: true,
    opacity: 1.0,           // opacity baked into vertex colour via setColorAt
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexColors: true,     // ← required for setColorAt
  }), []);

  const nextSkid = useRef(0);
  const headIdx  = useRef(0);
  const tmpQ     = useMemo(() => new THREE.Quaternion(), []);
  const tmpE     = useMemo(() => new THREE.Euler(), []);
  const tmpC     = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    const inst = instRef.current;
    if (!inst) return;
    const black = new THREE.Color(0, 0, 0);
    for (let i = 0; i < SKID_MAX; i++) {
      dummy.position.set(0, -999, 0);
      dummy.scale.setScalar(0.001);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      inst.setColorAt(i, black);  // ← allocates instanceColor buffer
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.instanceColor.needsUpdate  = true;
  }, [dummy]);

  useFrame((state) => {
    const inst = instRef.current;
    const body = playerRef.current;
    if (!inst || !body) return;

    const vel   = body.linvel();
    const speed = Math.hypot(vel.x, vel.z);
    const angV  = body.angvel();
    const t     = state.clock.getElapsedTime();

    if (Math.abs(angV.y) > 0.4 && speed > 1.5 && t > nextSkid.current) {
      nextSkid.current = t + 0.08;
      const i   = headIdx.current % SKID_MAX;
      headIdx.current++;

      const pos = body.translation();
      const r2  = body.rotation();
      tmpQ.set(r2.x, r2.y, r2.z, r2.w);
      tmpE.setFromQuaternion(tmpQ, 'YXZ');

      dummy.position.set(pos.x, 0.013, pos.z);
      dummy.rotation.set(-Math.PI/2, 0, tmpE.y);
      dummy.scale.set(0.38 + Math.random()*0.12, 0.9 + Math.random()*0.4, 1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);

      const v = 0.07 + Math.random()*0.04;
      inst.setColorAt(i, tmpC.set(v, v, v * 1.05));

      inst.instanceMatrix.needsUpdate = true;
      inst.instanceColor.needsUpdate  = true;
    }
  });

  return (
    <instancedMesh ref={instRef} args={[skidGeo, skidMat, SKID_MAX]} frustumCulled={false} />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BIKE MODEL  (lean animation baked in)
// ─────────────────────────────────────────────────────────────────────────────
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
    if (!groupRef.current || leanRef === null || leanRef === undefined) return;
    groupRef.current.rotation.z = THREE.MathUtils.lerp(
      groupRef.current.rotation.z,
      leanRef.current,
      Math.min(1, 8 * delta),
    );
  });

  return (
    <group ref={groupRef} rotation={[0, -Math.PI / 2, 0]}>
      <primitive object={scene} scale={scale} />
    </group>
  );
}

useGLTF.preload(BIKE_URL);

// ─────────────────────────────────────────────────────────────────────────────
// PLAYER
// ─────────────────────────────────────────────────────────────────────────────
export default function Player({ playerRef, followModeRef }) {
  const [, getKeys] = useKeyboardControls();
  const leanRef     = useRef(0);
  const tmpForward  = useMemo(() => new THREE.Vector3(), []);
  const tmpQuat     = useMemo(() => new THREE.Quaternion(), []);

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

    const r2 = body.rotation();
    tmpQuat.set(r2.x, r2.y, r2.z, r2.w);
    tmpForward.set(0, 0, 1).applyQuaternion(tmpQuat);

    const targetSpeed = fwdIn * MAX_SPEED * (brakeDown ? 0 : 1);
    const cur    = body.linvel();
    const lerpT  = Math.min(1, ACCEL * delta);
    const brakeT = brakeDown ? Math.min(1, 10 * delta) : lerpT;

    body.setLinvel({
      x: THREE.MathUtils.lerp(cur.x, brakeDown ? 0 : tmpForward.x * targetSpeed, brakeDown ? brakeT : lerpT),
      y: cur.y,
      z: THREE.MathUtils.lerp(cur.z, brakeDown ? 0 : tmpForward.z * targetSpeed, brakeDown ? brakeT : lerpT),
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

    // Lean: target angle proportional to turn input × speed
    const targetLean = -turnIn * speedFactor * 0.18;
    leanRef.current  = THREE.MathUtils.lerp(leanRef.current, targetLean, Math.min(1, 6*delta));
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

      {/* Effects rendered in world-space, outside the RigidBody */}
      <SmokeParticles playerRef={playerRef} />
      <SpeedLines     playerRef={playerRef} />
      <SkidMarks      playerRef={playerRef} />
    </>
  );
}
