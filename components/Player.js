"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useKeyboardControls } from "@react-three/drei";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";
import { touchInput } from "@/lib/inputStore";
import { bikeState, bikeCommand } from "@/lib/bikeStore";
import { triggerShake } from "@/lib/cameraShake";
import { isInGrass } from "@/lib/islandShape";

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
      const pos = body.translation();
      // Only leave skid marks on tarmac. On grass the dark patches read
      // as solid black streaks against the bright green meadow — the
      // user has flagged this multiple times. Skids on roads still
      // work as intended.
      if (!isOnTarmac(pos.x, pos.z)) return;
      nextSkid.current = t + 0.08;
      const i  = headIdx.current % SKID_MAX;
      headIdx.current++;

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

// ─── Grass Trail ─────────────────────────────────────────────────────────────
// Bruno-Simon-style soft tire tracks — two thin parallel strips per drop,
// pale crushed-grass colour, that fade out over a couple of seconds. The
// per-instance birth-time is read each frame to lerp the colour toward
// transparent; once it's old, the slot is recycled.
const TRAIL_MAX  = 220;             // 110 drops × 2 strips
const TRAIL_LIFE = 4.5;             // seconds before a drop fully fades

// Road segments duplicated from Decorations.js — the grass trail is suppressed
// on tarmac because tracks would read as litter on a paved road.
const TRAIL_ROAD_SEG = [
  [[  0,   0], [-38, -35]],
  [[  0,   0], [ 42, -22]],
  [[  0,   0], [  8,  40]],
  [[  0,   0], [-36,  32]],
  [[-38, -35], [ 42, -22]],
  [[ 42, -22], [  8,  40]],
  [[  8,  40], [-36,  32]],
  [[-36,  32], [-38, -35]],
];
const TRAIL_ROAD_HALF = 3.0;        // a hair narrower than the visual road

function distToSegSq(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-6) return (px - ax) ** 2 + (pz - az) ** 2;
  let t = ((px - ax) * dx + (pz - az) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cz = az + t * dz;
  return (px - cx) ** 2 + (pz - cz) ** 2;
}

function isOnTarmac(x, z) {
  const r2 = TRAIL_ROAD_HALF * TRAIL_ROAD_HALF;
  for (const [[ax, az], [bx, bz]] of TRAIL_ROAD_SEG) {
    if (distToSegSq(x, z, ax, az, bx, bz) < r2) return true;
  }
  return false;
}

function GrassTrail({ playerRef }) {
  const instRef  = useRef();
  const dummy    = useMemo(() => new THREE.Object3D(), []);
  const tmpQ     = useMemo(() => new THREE.Quaternion(), []);
  const tmpE     = useMemo(() => new THREE.Euler(), []);
  const tmpRight = useMemo(() => new THREE.Vector3(), []);

  const trailGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  // Bright cream — explicit Color object so the value is unambiguous to
  // the renderer.  We disable depth testing entirely (renderOrder
  // controls layering) so the strip is never occluded by the turf,
  // grass blades, or any other geometry. No instanceColor anywhere —
  // skipping it means Three never creates the per-instance tint buffer
  // that was darkening the strips on some drivers.
  const trailMat = useMemo(() => new THREE.MeshBasicMaterial({
    color:        new THREE.Color(0.96, 0.98, 0.86),
    side:         THREE.DoubleSide,
    transparent:  true,
    opacity:      0.85,
    depthTest:    false,
    depthWrite:   false,
    toneMapped:   false,
  }), []);

  const nextDrop   = useRef(0);
  const headIdx    = useRef(0);
  const birth      = useMemo(() => new Float32Array(TRAIL_MAX), []);
  const slotX      = useMemo(() => new Float32Array(TRAIL_MAX), []);
  const slotZ      = useMemo(() => new Float32Array(TRAIL_MAX), []);
  const slotYaw    = useMemo(() => new Float32Array(TRAIL_MAX), []);
  const slotLength = useMemo(() => new Float32Array(TRAIL_MAX), []);

  // Setup: park every slot off-screen with a tiny scale so nothing renders
  // until a drop happens. We deliberately do NOT call setColorAt here —
  // creating instanceColor at all is what dragged the strip colour to
  // black on some GPUs, so we just let the material colour rule.
  useEffect(() => {
    const inst = instRef.current;
    if (!inst) return;
    for (let i = 0; i < TRAIL_MAX; i++) {
      birth[i] = -1e6;
      dummy.position.set(0, -999, 0);
      dummy.scale.setScalar(0.001);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  }, [dummy, birth]);

  useFrame((state) => {
    const inst = instRef.current;
    const body = playerRef.current;
    if (!inst) return;

    const t = state.clock.getElapsedTime();

    // ── Fade pass: shrink each live strip's width to zero as it ages.
    let dirty = false;
    for (let i = 0; i < TRAIL_MAX; i++) {
      if (birth[i] < -1e5) continue;
      const age = t - birth[i];
      if (age > TRAIL_LIFE) {
        dummy.position.set(0, -999, 0);
        dummy.scale.setScalar(0.001);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
        birth[i] = -1e6;
        dirty = true;
        continue;
      }
      const k    = 1 - age / TRAIL_LIFE;
      const ease = k * k;
      // Strip sits clearly above the turf top (y = 0.045) so depth-
      // ordering can't drag it back behind the grass. With
      // depthTest:false this is purely belt-and-braces.
      dummy.position.set(slotX[i], 0.05, slotZ[i]);
      dummy.rotation.set(-Math.PI / 2, 0, slotYaw[i]);
      dummy.scale.set(0.26 * ease, slotLength[i], 1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      dirty = true;
    }
    if (dirty) inst.instanceMatrix.needsUpdate = true;

    // ── Emission: drop a new pair of strips if rolling fast on grass.
    if (!body) return;
    const vel   = body.linvel();
    const speed = Math.hypot(vel.x, vel.z);
    if (speed < 1.2) return;

    const pos = body.translation();
    if (isOnTarmac(pos.x, pos.z)) return;
    if (!isInGrass(pos.x, pos.z))  return;

    if (t < nextDrop.current) return;
    nextDrop.current = t + 0.06;

    const r2 = body.rotation();
    tmpQ.set(r2.x, r2.y, r2.z, r2.w);
    tmpE.setFromQuaternion(tmpQ, "YXZ");
    const yaw = tmpE.y;

    // Single strip directly behind the back wheel — one tire track,
    // not two. The bike's local +Z is its forward; the back wheel sits
    // ~0.85 m behind the body centre, so we offset the drop along the
    // negative-forward direction.
    const BACK_OFFSET = 0.85;
    const fwdX = Math.sin(yaw);
    const fwdZ = Math.cos(yaw);

    const i = headIdx.current % TRAIL_MAX;
    headIdx.current++;

    slotX[i]      = pos.x - fwdX * BACK_OFFSET;
    slotZ[i]      = pos.z - fwdZ * BACK_OFFSET;
    slotYaw[i]    = yaw;
    slotLength[i] = 0.85 + Math.random() * 0.12;
    birth[i]      = t;
  });

  // renderOrder: -5 keeps the strips behind the bike & landmarks (which
  // default to renderOrder 0) so they don't draw on top of the bike
  // itself, but still in front of the turf which has renderOrder 0 as
  // well — depthTest:false + this order forces a stable layering.
  return (
    <instancedMesh
      ref={instRef}
      args={[trailGeo, trailMat, TRAIL_MAX]}
      frustumCulled={false}
      renderOrder={1}
    />
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
  const outlineGroup = useMemo(() => new THREE.Group(), []);

  useEffect(() => {
    // Pass 1: tweak the bike's PBR look. Pass 2: build a backface-only
    // shell that gets scaled up slightly — classic "inverted hull"
    // outline trick. Cheaper than a full edge-detect post-pass and the
    // shape stays consistent through bloom + tone-mapping.
    while (outlineGroup.children.length) outlineGroup.remove(outlineGroup.children[0]);

    const outlineMat = new THREE.MeshBasicMaterial({
      color:    0x0a0a10,
      side:     THREE.BackSide,
      toneMapped: false,
      depthWrite: true,
    });

    scene.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow    = true;
      o.receiveShadow = true;
      if (o.material) {
        o.material.roughness       = Math.min(o.material.roughness  ?? 0.5, 0.4);
        o.material.metalness       = Math.max(o.material.metalness  ?? 0.2, 0.4);
        o.material.envMapIntensity = 1.2;
      }
      // Build the outline shell as cloned meshes that share the same
      // local transform as the original. We push them slightly outward
      // along the normal by upscaling the mesh.
      const shell = o.clone();
      shell.material = outlineMat;
      shell.castShadow = false;
      shell.receiveShadow = false;
      shell.scale.multiplyScalar(1.025);
      outlineGroup.add(shell);
    });
  }, [scene, outlineGroup]);

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
      {/* The outline shell sits on top — same local space, just slightly
          larger. Backface culling means we only see the rim around the
          bike's silhouette. */}
      <primitive object={outlineGroup} scale={scale} />
    </group>
  );
}

useGLTF.preload(BIKE_URL);

// ─── Player ───────────────────────────────────────────────────────────────────
export default function Player({ playerRef, followModeRef }) {
  const [, getKeys] = useKeyboardControls();
  const { camera }  = useThree();

  const leanRef     = useRef(0);
  const tmpForward  = useMemo(() => new THREE.Vector3(), []);
  const tmpRight    = useMemo(() => new THREE.Vector3(), []);
  const tmpDesired  = useMemo(() => new THREE.Vector3(), []);
  const tmpQuat     = useMemo(() => new THREE.Quaternion(), []);
  const tmpEuler    = useMemo(() => new THREE.Euler(0, 0, 0, "YXZ"), []);

  useFrame((_, delta) => {
    const body = playerRef.current;
    if (!body) return;

    /* ── 0) one-shot teleport (quick-travel from the mini-map) ─────────── */
    if (bikeCommand.teleportTo) {
      const t = bikeCommand.teleportTo;
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      body.setTranslation({ x: t.x, y: t.y, z: t.z }, true);
      if (typeof t.yaw === "number") {
        const half = t.yaw / 2;
        body.setRotation({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) }, true);
      }
      bikeCommand.teleportTo = null;
      // Snap follow camera back so it doesn't pan across the whole map
      if (followModeRef) followModeRef.current = true;
    }

    /* ── 1) read input — keyboard digital + joystick analog ────────────── */
    const k            = getKeys();
    const forwardDown  = k.forward  || touchInput.forward;
    const backwardDown = k.backward || touchInput.backward;
    const leftDown     = k.left     || touchInput.left;
    const rightDown    = k.right    || touchInput.right;
    const brakeDown    = k.brake    || touchInput.brake;

    const joyMag = Math.hypot(touchInput.joystickX, touchInput.joystickY);
    const useJoystick = touchInput.joystickActive && joyMag > 0.05;

    if (followModeRef?.current !== undefined) {
      if (forwardDown || backwardDown || leftDown || rightDown || useJoystick) {
        followModeRef.current = true;
      }
    }

    /* ── 2) current rotation, body forward axis ────────────────────────── */
    const r2 = body.rotation();
    tmpQuat.set(r2.x, r2.y, r2.z, r2.w);
    tmpForward.set(0, 0, 1).applyQuaternion(tmpQuat);  // bike's local +Z in world

    const cur         = body.linvel();
    const groundSpeed = Math.hypot(cur.x, cur.z);
    const lerpT       = Math.min(1, ACCEL * delta);
    const brakeT      = brakeDown ? Math.min(1, 10 * delta) : lerpT;

    let targetVx, targetVz, angY;

    if (useJoystick) {
      /* ── 3a) Bruno-Simon-style directional joystick ──────────────────────
         Joystick angle = desired heading (camera-relative). We rotate the
         bike toward that heading with a P-controller on yaw error, while
         driving forward at throttle = joystick magnitude. Pulling sideways
         no longer spins on the spot — it banks the bike into a turn. */
      camera.getWorldDirection(tmpRight);   // cam forward, will reuse
      tmpRight.y = 0;
      tmpRight.normalize();
      // tmpRight currently holds the cam-forward; build axes from it.
      const camForwardX = tmpRight.x;
      const camForwardZ = tmpRight.z;
      // World up × cam-forward = cam-right (in XZ plane)
      const camRightX = -camForwardZ;
      const camRightZ =  camForwardX;

      // Desired world direction = cam-forward * jY  +  cam-right * jX
      tmpDesired.set(
        camForwardX * touchInput.joystickY + camRightX * touchInput.joystickX,
        0,
        camForwardZ * touchInput.joystickY + camRightZ * touchInput.joystickX,
      );
      const desLen = Math.hypot(tmpDesired.x, tmpDesired.z) || 1;
      tmpDesired.x /= desLen;
      tmpDesired.z /= desLen;

      const desiredYaw = Math.atan2(tmpDesired.x, tmpDesired.z);

      // Wrap delta yaw to [-π, π]
      tmpEuler.setFromQuaternion(tmpQuat);
      let dy = desiredYaw - tmpEuler.y;
      while (dy >  Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;

      // P-controller, capped to a sane angular speed
      const ANG_CAP = TURN_SPEED * 1.6;
      angY = THREE.MathUtils.clamp(dy * 5, -ANG_CAP, ANG_CAP);

      // Throttle along the bike's *current* forward axis — gives a smooth
      // turning feel rather than rubber-banding sideways.
      const throttle = Math.min(1, joyMag);
      const targetSpeed = throttle * MAX_SPEED;
      targetVx = tmpForward.x * targetSpeed;
      targetVz = tmpForward.z * targetSpeed;

      // Lean visually into the turn, scaled by both throttle and yaw error
      const leanTarget = THREE.MathUtils.clamp(dy, -1, 1) * 0.22 * throttle;
      leanRef.current  = THREE.MathUtils.lerp(
        leanRef.current,
        leanTarget,
        Math.min(1, 6 * delta),
      );
    } else {
      /* ── 3b) Digital keyboard fallback ────────────────────────────────── */
      const fwdIn  = (forwardDown  ? 1 : 0) - (backwardDown ? 1 : 0);
      const turnIn = (leftDown     ? 1 : 0) - (rightDown    ? 1 : 0);

      const targetSpeed = fwdIn * MAX_SPEED * (brakeDown ? 0 : 1);
      targetVx = tmpForward.x * targetSpeed;
      targetVz = tmpForward.z * targetSpeed;

      const speedFactor = turnIn !== 0
        ? THREE.MathUtils.clamp(groundSpeed / MAX_SPEED, 0.55, 1)
        : 0;
      angY = turnIn !== 0 ? turnIn * TURN_SPEED * speedFactor : 0;

      const leanTarget = -turnIn * speedFactor * 0.18;
      leanRef.current  = THREE.MathUtils.lerp(
        leanRef.current,
        leanTarget,
        Math.min(1, 6 * delta),
      );
    }

    /* ── 4) commit physics ──────────────────────────────────────────────── */
    body.setLinvel(
      {
        x: THREE.MathUtils.lerp(cur.x, brakeDown ? 0 : targetVx, brakeDown ? brakeT : lerpT),
        y: cur.y,
        z: THREE.MathUtils.lerp(cur.z, brakeDown ? 0 : targetVz, brakeDown ? brakeT : lerpT),
      },
      true,
    );
    body.setAngvel({ x: 0, y: angY, z: 0 }, true);

    /* ── 5) HUD bridge ──────────────────────────────────────────────────── */
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
      <GrassTrail     playerRef={playerRef} />
    </>
  );
}
