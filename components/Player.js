"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useKeyboardControls } from "@react-three/drei";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";
import { touchInput } from "@/lib/inputStore";
import { bikeState } from "@/lib/bikeStore";
import { triggerShake } from "@/lib/cameraShake";

const BIKE_URL   = "/vanmoof-transformed.glb";
const MAX_SPEED  = 7.5;
const ACCEL      = 6;
const TURN_SPEED = 2.6;

// ─── Smoke Particles ─────────────────────────────────────────────────────────
// FIX #6: SphereGeometry(0.5, 8, 8) — 8 segments for a proper round sphere silhouette
// FIX #2 (smoke color init): initialise instanceColor with transparent grey, not black
const SMOKE_COUNT = 32;

function SmokeParticles({ playerRef }) {
  const instRef  = useRef();
  const clockRef = useRef(0);
  const nextEmit = useRef(0);
  const pool     = useRef(0);

  const px   = useRef(new Float32Array(SMOKE_COUNT));
  const py   = useRef(new Float32Array(SMOKE_COUNT));
  const pz   = useRef(new Float32Array(SMOKE_COUNT));
  const vx   = useRef(new Float32Array(SMOKE_COUNT));
  const vy   = useRef(new Float32Array(SMOKE_COUNT));
  const vz   = useRef(new Float32Array(SMOKE_COUNT));
  const life = useRef(new Float32Array(SMOKE_COUNT));
  const maxL = useRef(new Float32Array(SMOKE_COUNT));
  const sc   = useRef(new Float32Array(SMOKE_COUNT));

  const dummy   = useMemo(() => new THREE.Object3D(), []);
  // FIX #6: 8×8 segments — round sphere, not a jagged polygon
  const instGeo = useMemo(() => new THREE.SphereGeometry(0.5, 8, 8), []);
  const instMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    depthWrite: false,
    vertexColors: true,
  }), []);

  const tmpQ = useMemo(() => new THREE.Quaternion(), []);
  const tmpB = useMemo(() => new THREE.Vector3(), []);
  const tmpC = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    const inst = instRef.current;
    if (!inst) return;
    life.current.fill(0);
    // FIX #2: init color as very dark grey (not pure black which looks bad at any alpha)
    const initGrey = new THREE.Color(0.08, 0.08, 0.08);
    for (let i = 0; i < SMOKE_COUNT; i++) {
      dummy.position.set(0, -999, 0);
      dummy.scale.setScalar(0.001);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      inst.setColorAt(i, initGrey);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }, [dummy]);

  useFrame((_, delta) => {
    const inst = instRef.current;
    if (!inst) return;
    const body = playerRef.current;

    clockRef.current += delta;
    const t  = clockRef.current;
    const dt = Math.min(delta, 0.05);

    let speed = 0;
    if (body) { const v = body.linvel(); speed = Math.hypot(v.x, v.z); }

    if (speed > 0.5 && t > nextEmit.current && body) {
      nextEmit.current = t + 0.04;
      const i  = pool.current % SMOKE_COUNT;
      pool.current++;

      const pos = body.translation();
      const r2  = body.rotation();
      tmpQ.set(r2.x, r2.y, r2.z, r2.w);
      tmpB.set(0, 0, -0.7).applyQuaternion(tmpQ);

      px.current[i] = pos.x + tmpB.x + (Math.random()-0.5)*0.18;
      py.current[i] = 0.15 + Math.random()*0.08;
      pz.current[i] = pos.z + tmpB.z + (Math.random()-0.5)*0.18;

      vx.current[i] = (Math.random()-0.5)*0.18;
      vy.current[i] = 0.28 + Math.random()*0.22;
      vz.current[i] = (Math.random()-0.5)*0.18;

      const lifeT    = 0.5 + Math.random()*0.35;
      life.current[i] = lifeT;
      maxL.current[i] = lifeT;
      // FIX #6: small spheres, radius 0.09–0.16
      sc.current[i]   = 0.09 + Math.random()*0.07;
    }

    for (let i = 0; i < SMOKE_COUNT; i++) {
      if (life.current[i] <= 0) {
        dummy.position.set(0, -999, 0);
        dummy.scale.setScalar(0.001);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
        // Park hidden particles as transparent, not black
        inst.setColorAt(i, tmpC.set(0.08, 0.08, 0.08));
        continue;
      }

      life.current[i] -= dt;

      vx.current[i] *= 1 - 0.5*dt;
      vz.current[i] *= 1 - 0.5*dt;
      vy.current[i] -= 0.08*dt;
      px.current[i] += vx.current[i]*dt;
      py.current[i] += vy.current[i]*dt;
      pz.current[i] += vz.current[i]*dt;

      const frac  = Math.max(0, life.current[i] / maxL.current[i]);
      const scale = sc.current[i] * (1 + (1-frac)*0.9);
      const alpha = (frac < 0.15 ? frac/0.15 : frac) * 0.52;

      dummy.position.set(px.current[i], py.current[i], pz.current[i]);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);

      // Pure mid-grey: 0.72–0.80 range, premultiplied by alpha
      const g = (0.72 + frac*0.08) * alpha;
      inst.setColorAt(i, tmpC.set(g, g, g));
    }

    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={instRef} args={[instGeo, instMat, SMOKE_COUNT]} frustumCulled={false} />
  );
}

// ─── Speed Lines ─────────────────────────────────────────────────────────────
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
      for (const { line } of linesRef.current) line.material.opacity = 0;
      return;
    }

    const pos = body.translation();
    const r2  = body.rotation();
    tmpQ.set(r2.x, r2.y, r2.z, r2.w);

    linesRef.current.forEach(({ line, geo, seed }, i) => {
      const angle = (i / LINE_COUNT) * Math.PI * 2;
      const r     = 1.6 + seed*0.8 + Math.sin(t*6 + i)*0.25;
      const len   = 0.55 + seed*0.45;

      tmpV.set(Math.cos(angle)*r, 0.55, Math.sin(angle)*r).applyQuaternion(tmpQ);

      const pts = geo.attributes.position.array;
      pts[0] = pos.x + tmpV.x;     pts[1] = pos.y + 0.3 + tmpV.y; pts[2] = pos.z + tmpV.z;
      pts[3] = pos.x + tmpV.x*len; pts[4] = pos.y + 0.3 + tmpV.y; pts[5] = pos.z + tmpV.z*len;
      geo.attributes.position.needsUpdate = true;

      line.material.opacity = alpha * (0.5 + seed*0.5 + Math.sin(t*12 + seed*10)*0.3);
    });
  });

  return <group ref={groupRef} />;
}

// ─── Skid Marks ──────────────────────────────────────────────────────────────
const SKID_MAX = 60;

function SkidMarks({ playerRef }) {
  const instRef = useRef();
  const dummy   = useMemo(() => new THREE.Object3D(), []);
  const skidGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const skidMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexColors: true,
  }), []);

  const nextSkid = useRef(0);
  const headIdx  = useRef(0);
  const tmpQ     = useMemo(() => new THREE.Quaternion(), []);
  const tmpE     = useMemo(() => new THREE.Euler(), []);
  const tmpC     = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    const inst = instRef.current;
    if (!inst) return;
    const initC = new THREE.Color(0.08, 0.08, 0.08);
    for (let i = 0; i < SKID_MAX; i++) {
      dummy.position.set(0, -999, 0);
      dummy.scale.setScalar(0.001);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      inst.setColorAt(i, initC);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }, [dummy]);

  useFrame((state) => {
    const inst = instRef.current;
    const body = playerRef.current;
    if (!inst || !body) return;

    const vel  = body.linvel();
    const speed = Math.hypot(vel.x, vel.z);
    const angV  = body.angvel();
    const t     = state.clock.getElapsedTime();

    if (Math.abs(angV.y) > 0.4 && speed > 1.5 && t > nextSkid.current) {
      nextSkid.current = t + 0.08;
      const i  = headIdx.current % SKID_MAX;
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
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={instRef} args={[skidGeo, skidMat, SKID_MAX]} frustumCulled={false} />
  );
}

// ─── Drift Sparks ────────────────────────────────────────────────────────────
// Bright additively-blended particles that fly outward from the wheels when
// the bike is mid-drift (sharp turn at speed). They're tiny, very short-lived,
// and read as "sparks" once bloom kicks in.
const SPARK_COUNT = 32;

function DriftSparks({ playerRef }) {
  const instRef = useRef();
  const dummy   = useMemo(() => new THREE.Object3D(), []);
  const tmpC    = useMemo(() => new THREE.Color(), []);
  const tmpQ    = useMemo(() => new THREE.Quaternion(), []);
  const tmpV    = useMemo(() => new THREE.Vector3(), []);

  // Per-particle state
  const px   = useRef(new Float32Array(SPARK_COUNT));
  const py   = useRef(new Float32Array(SPARK_COUNT));
  const pz   = useRef(new Float32Array(SPARK_COUNT));
  const vx   = useRef(new Float32Array(SPARK_COUNT));
  const vy   = useRef(new Float32Array(SPARK_COUNT));
  const vz   = useRef(new Float32Array(SPARK_COUNT));
  const life = useRef(new Float32Array(SPARK_COUNT));
  const maxL = useRef(new Float32Array(SPARK_COUNT));
  const hue  = useRef(new Float32Array(SPARK_COUNT));   // 0 = cyan, 1 = orange
  const head = useRef(0);
  const accum = useRef(0);

  const geo = useMemo(() => new THREE.SphereGeometry(0.06, 6, 6), []);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        vertexColors: true,
      }),
    [],
  );

  useEffect(() => {
    const inst = instRef.current;
    if (!inst) return;
    for (let i = 0; i < SPARK_COUNT; i++) {
      dummy.position.set(0, -999, 0);
      dummy.scale.setScalar(0.001);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      inst.setColorAt(i, tmpC.set(0, 0, 0));
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }, [dummy, tmpC]);

  useFrame((_, delta) => {
    const inst = instRef.current;
    const body = playerRef.current;
    if (!inst) return;

    const dt = Math.min(delta, 0.05);
    accum.current += dt;

    // Emission gating — only when both turning and moving fast enough
    if (body) {
      const vel    = body.linvel();
      const angV   = body.angvel();
      const speed  = Math.hypot(vel.x, vel.z);
      const turning = Math.abs(angV.y) > 0.6 && speed > 2.5;

      if (turning && accum.current > 0.025) {
        accum.current = 0;
        // Emit two sparks per pulse — outer wheel side
        for (let burst = 0; burst < 2; burst++) {
          const i = head.current % SPARK_COUNT;
          head.current++;

          const pos = body.translation();
          const r2  = body.rotation();
          tmpQ.set(r2.x, r2.y, r2.z, r2.w);
          // Bike's local right axis (centrifugal direction)
          const sign = -Math.sign(angV.y);
          tmpV.set(sign * 0.45, 0, (Math.random() - 0.5) * 0.6).applyQuaternion(tmpQ);

          px.current[i] = pos.x + tmpV.x;
          py.current[i] = 0.18 + Math.random() * 0.05;
          pz.current[i] = pos.z + tmpV.z;

          // Outward + slightly upward velocity
          tmpV.set(sign * (1.2 + Math.random()), 1.5 + Math.random() * 0.8,
                   (Math.random() - 0.5) * 1.0).applyQuaternion(tmpQ);
          vx.current[i] = tmpV.x;
          vy.current[i] = tmpV.y;
          vz.current[i] = tmpV.z;

          const lifeT     = 0.28 + Math.random() * 0.22;
          life.current[i] = lifeT;
          maxL.current[i] = lifeT;
          // Random hue cyan ↔ orange for variety
          hue.current[i]  = Math.random() < 0.5 ? 0 : 1;
        }
      }
    }

    // Update all live particles
    for (let i = 0; i < SPARK_COUNT; i++) {
      if (life.current[i] <= 0) {
        dummy.position.set(0, -999, 0);
        dummy.scale.setScalar(0.001);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
        inst.setColorAt(i, tmpC.set(0, 0, 0));
        continue;
      }

      life.current[i] -= dt;
      vy.current[i] -= 4.5 * dt;          // gravity
      px.current[i] += vx.current[i] * dt;
      py.current[i] += vy.current[i] * dt;
      pz.current[i] += vz.current[i] * dt;

      const frac  = Math.max(0, life.current[i] / maxL.current[i]);
      const scale = 0.45 + frac * 0.85;

      dummy.position.set(px.current[i], py.current[i], pz.current[i]);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);

      // Bright at start, dim at end. Cyan or orange tint based on hue array.
      const intensity = frac * 1.6;
      if (hue.current[i] < 0.5) {
        tmpC.set(0.35 * intensity, 0.95 * intensity, intensity);  // cyan
      } else {
        tmpC.set(intensity, 0.55 * intensity, 0.18 * intensity);  // orange
      }
      inst.setColorAt(i, tmpC);
    }

    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={instRef}
      args={[geo, mat, SPARK_COUNT]}
      frustumCulled={false}
    />
  );
}

// ─── Bike Model ───────────────────────────────────────────────────────────────
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

// ─── Player ───────────────────────────────────────────────────────────────────
export default function Player({ playerRef, followModeRef }) {
  const [, getKeys] = useKeyboardControls();
  const leanRef     = useRef(0);
  const tmpForward  = useMemo(() => new THREE.Vector3(), []);
  const tmpQuat     = useMemo(() => new THREE.Quaternion(), []);
  const tmpEuler    = useMemo(() => new THREE.Euler(0, 0, 0, "YXZ"), []);

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

    const targetLean = -turnIn * speedFactor * 0.18;
    leanRef.current  = THREE.MathUtils.lerp(leanRef.current, targetLean, Math.min(1, 6*delta));

    // Publish state for the DOM HUDs (mini-map, speedometer)
    const pos = body.translation();
    bikeState.x     = pos.x;
    bikeState.y     = pos.y;
    bikeState.z     = pos.z;
    bikeState.speed = groundSpeed;
    tmpEuler.setFromQuaternion(tmpQuat);
    bikeState.yaw   = tmpEuler.y;
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
        onCollisionEnter={() => {
          // Speed-scaled camera shake. Tiny taps don't register, hard
          // smacks rumble the camera.
          const v = playerRef.current?.linvel();
          if (!v) return;
          const speed = Math.hypot(v.x, v.z);
          if (speed > 0.8) triggerShake(Math.min(0.65, speed * 0.07));
        }}
      >
        <CuboidCollider args={[0.32, 0.45, 0.85]} position={[0, 0.45, 0]} />
        <VanMoofModel scale={1} leanRef={leanRef} />
      </RigidBody>

      <SmokeParticles playerRef={playerRef} />
      <SpeedLines     playerRef={playerRef} />
      <SkidMarks      playerRef={playerRef} />
      <DriftSparks    playerRef={playerRef} />
    </>
  );
}
