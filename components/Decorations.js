"use client";

import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";

import { isInGrass } from "@/lib/islandShape";
import { bikeState } from "@/lib/bikeStore";
import { trackState } from "@/lib/trackTexture";
import { sharedUniforms } from "@/lib/sharedUniforms";
import { quality } from "@/lib/quality";

// ─────────────────────────────────────────────────────────────────────────────
// Seeded pseudo-random helper — deterministic so the layout never re-shuffles.
// ─────────────────────────────────────────────────────────────────────────────
function seededRng(seed) {
  let s = seed | 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) | 0;
    return ((s >>> 0) / 0xffffffff);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GRASS FIELD — Bruno Simon's exact approach.
//
// Each blade is a single triangle with 3 vertices, all stored at the
// same world XZ (the blade's anchor). A per-vertex `aShape` attribute
// gives one of three offsets:
//   (0, 1)   → tip (centered, full height)
//   (1, 0)   → base-right (full width offset, ground)
//   (-1, 0)  → base-left
// The vertex shader multiplies these by uBladeWidth / uBladeHeight,
// rotates the side offset to face the camera, and adds wind sway.
//
// Not InstancedMesh — flat BufferGeometry with 3*N vertices total, like
// Bruno's Grass.js. Memory is fine (3 × N × 6 floats for everything),
// and the shader is much simpler than packing per-instance attributes.
//
// Density much higher than before: Bruno runs 78k blades over a 280²
// area; we scale to 30-50k for our smaller play area.
// ─────────────────────────────────────────────────────────────────────────────

const GRASS_VERT = /* glsl */`
  // Per-vertex attributes:
  //   position : the blade's anchor (worldX, 0, worldZ) — same for all 3
  //              vertices of a triangle.
  //   aShape   : (-1..1, 0..1) — vertex 0 is tip (0, 1), vertex 1 is
  //              base-right (1, 0), vertex 2 is base-left (-1, 0).
  //   aHash    : per-blade random 0..1 (same value 3× in a row).
  attribute vec2  aShape;
  attribute float aHash;

  uniform float     uTime;
  uniform vec2      uWindDir;
  uniform float     uWindStrength;
  uniform sampler2D uWindNoiseTex;
  uniform float     uWindNoiseScale;
  uniform sampler2D uTrackTex;
  uniform float     uTrackWorldSize;
  uniform float     uTrackHas;
  uniform float     uBladeWidth;
  uniform float     uBladeHeight;

  varying float vTip;
  varying float vHash;

  void main() {
    vec3 base = position;                    // world XZ + Y=0
    float scale = 0.7 + aHash * 0.55;        // per-blade size variation

    // Per-vertex local offset: side along ±X (multiplied by width),
    // up along Y (multiplied by height). aShape.y is also our tipFactor.
    float w = aShape.x * uBladeWidth  * scale;
    float h = aShape.y * uBladeHeight * scale;

    // Camera-facing rotation around Y. Each blade points its flat side
    // at the camera, with a small per-blade jitter so the field isn't
    // stamped. ±0.6 rad is enough randomness without losing the
    // benefit of facing-the-camera (which avoids edge-on invisibility).
    vec3 toCam = cameraPosition - base;
    float rotY = atan(toCam.x, toCam.z) + (aHash - 0.5) * 1.2;
    float cR   = cos(rotY);
    float sR   = sin(rotY);
    vec2 sideXZ = vec2(cR * w, sR * w);

    // Track flatten — sample the off-screen render of the bike's path
    // and squash the height factor where the bike has been.
    vec2 trackUv = base.xz / uTrackWorldSize + 0.5;
    float track  = uTrackHas * texture2D(uTrackTex, trackUv).r;
    float flatten = 1.0 - track * 0.85;

    // Wind — sample the procedural noise texture at the blade's world
    // XZ. R/G channels encode wind X/Z direction (0..1 → -1..1).
    vec2 noiseUv = base.xz * uWindNoiseScale + uWindDir * uTime * 0.06;
    vec2 windVec = texture2D(uWindNoiseTex, noiseUv).rg * 2.0 - 1.0;

    // Per-blade phase keeps neighbours out of perfect sync
    float personal = sin(uTime * 1.7 + aHash * 6.2832) * 0.35;
    float sway     = (length(windVec) * 1.4 + personal) * uWindStrength;

    // Tip displacement in world XZ — only the upper vertex moves much
    // (aShape.y is 0 at base, 1 at tip).
    vec2 tipPush = sway * aShape.y * uBladeHeight * windVec;

    vec3 offset = vec3(sideXZ.x + tipPush.x,
                       h * flatten,
                       sideXZ.y + tipPush.y);

    gl_Position = projectionMatrix * viewMatrix * vec4(base + offset, 1.0);

    vTip  = aShape.y;
    vHash = aHash;
  }
`;

const GRASS_FRAG = /* glsl */`
  precision highp float;

  uniform vec3  uTipColorA;
  uniform vec3  uTipColorB;
  uniform vec3  uRootColorA;
  uniform vec3  uRootColorB;
  uniform float uDayWeight;

  varying float vTip;
  varying float vHash;

  void main() {
    float jitter = 0.5 + 0.5 * sin(vHash * 17.71);
    vec3 root = mix(uRootColorA, uRootColorB, jitter);
    vec3 tip  = mix(uTipColorA,  uTipColorB,  jitter);

    vec3 col = mix(root, tip, vTip);
    col *= mix(0.55, 1.0, vTip);                     // base AO
    col = mix(col * vec3(0.18, 0.24, 0.42), col, uDayWeight);

    gl_FragColor = vec4(col, 1.0);
  }
`;

const ISLAND_HALF = 68;             // sampling bounds; isInGrass trims to coast

// Blade dimensions — calibrated against Bruno's folio-2025 Grass.js.
const BLADE_WIDTH  = 0.075;
const BLADE_HEIGHT = 0.42;

// bladeShape encodes per-vertex offsets for a single triangle:
//   vertex 0 → tip:        ( 0,  1)
//   vertex 1 → base-right: ( 1,  0)
//   vertex 2 → base-left:  (-1,  0)
// The vertex shader multiplies these by uBladeWidth/Height and rotates
// the side offset around Y to face the camera. Bruno's exact pattern.
const BLADE_SHAPE = [
  [0,  1],
  [1,  0],
  [-1, 0],
];

function GrassField() {
  // Build the whole field as a flat (non-instanced) BufferGeometry —
  // 3 * N vertices total, each storing the blade's world XZ anchor in
  // its position, plus per-vertex aShape and aHash attributes. The
  // shader fans those into the final triangle.
  const geometry = useMemo(() => {
    const target = quality.grassCount;
    const rng = seededRng(0xdeadbeef);
    const pos    = [];
    const shape  = [];
    const hashes = [];

    let placed = 0;
    let attempts = 0;
    while (placed < target && attempts < target * 6) {
      attempts++;
      const x = (rng() - 0.5) * (ISLAND_HALF * 2 - 4);
      const z = (rng() - 0.5) * (ISLAND_HALF * 2 - 4);
      if (!isInGrass(x, z)) continue;
      if (isOnRoad(x, z))   continue;
      if (isInPlaza(x, z))  continue;

      const h = rng();
      // 3 verts per blade, all anchored at the same world XZ.
      for (let v = 0; v < 3; v++) {
        pos.push(x, 0, z);
        shape.push(BLADE_SHAPE[v][0], BLADE_SHAPE[v][1]);
        hashes.push(h);
      }
      placed++;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos,    3));
    g.setAttribute("aShape",   new THREE.Float32BufferAttribute(shape,  2));
    g.setAttribute("aHash",    new THREE.Float32BufferAttribute(hashes, 1));
    return g;
  }, []);

  // Material reuses sharedUniforms by reference — World.js's tick
  // pushes new values once and every shader picks them up.
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader:   GRASS_VERT,
        fragmentShader: GRASS_FRAG,
        uniforms: {
          uTime:           sharedUniforms.uTime,
          uWindDir:        sharedUniforms.uWindDir,
          uWindStrength:   sharedUniforms.uWindStrength,
          uWindNoiseTex:   sharedUniforms.uWindNoiseTex,
          uWindNoiseScale: sharedUniforms.uWindNoiseScale,
          uDayWeight:      sharedUniforms.uDayWeight,
          uTrackTex:       sharedUniforms.uTrackTex,
          uTrackWorldSize: sharedUniforms.uTrackWorldSize,
          uTrackHas:       sharedUniforms.uTrackHas,
          uBladeWidth:     { value: BLADE_WIDTH },
          uBladeHeight:    { value: BLADE_HEIGHT },
          uTipColorA:      { value: new THREE.Color(0.46, 0.84, 0.26) },
          uTipColorB:      { value: new THREE.Color(0.74, 0.92, 0.32) },
          uRootColorA:     { value: new THREE.Color(0.07, 0.26, 0.10) },
          uRootColorB:     { value: new THREE.Color(0.12, 0.34, 0.14) },
        },
        side: THREE.DoubleSide,
      }),
    [],
  );

  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <primitive object={material} attach="material" />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WIND STREAKS — Bruno-Simon-style progress-based "draw + erase".
//
// Mirrors his folio-2025 WindLines.js pattern: each streak is a
// TubeGeometry built from a CatmullRomCurve3 through alternating
// high/low handles, with a custom shader that uses the along-tube UV
// coordinate plus a `uProgress` uniform to make a finite "ribbon
// window" travel from one end to the other. The visible window has a
// soft head and a fading tail, so each line draws itself in and erases
// behind itself like a flowing pen stroke.
//
// Streaks sit just above the meadow (tire height) — the user wanted
// them low and subtle, not high in the air.
// ─────────────────────────────────────────────────────────────────────────────

const STREAK_COUNT  = 14;
const STREAK_RADIUS = 28;
const STREAK_HEIGHT = 0.55;     // tire height
const STREAK_BAND   = 0.45;     // ±vertical wobble around STREAK_HEIGHT

function buildStreakCurve(length, handleCount, amplitude) {
  const halfExtent = length / 2;
  const handleSpan = length / (handleCount - 1);
  const handles = [];
  for (let i = 0; i < handleCount; i++) {
    handles.push(new THREE.Vector3(
      0,
      (i % 2) - 0.5 * amplitude,
      -halfExtent + i * handleSpan,
    ));
  }
  return new THREE.CatmullRomCurve3(handles);
}

const STREAK_VERT = /* glsl */`
  varying float vRatio;
  void main() {
    // TubeGeometry's uv.x runs 0..1 along the tube length. We forward it
    // to the fragment shader so the draw/erase animation can reference
    // each fragment's position along the line.
    vRatio = uv.x;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const STREAK_FRAG = /* glsl */`
  precision mediump float;
  uniform float uProgress;
  uniform float uTailLen;
  uniform vec3  uColor;
  uniform float uOpacity;
  varying float vRatio;
  void main() {
    // distFromHead = how far behind the current draw head this fragment is
    float dist = uProgress - vRatio;
    if (dist < 0.0)        discard;        // not drawn yet
    if (dist > uTailLen)   discard;        // already faded out
    // Linear fade: full alpha at the head, 0 at the tail end. Smoothstep
    // at the very head edge softens the appear-from-nothing transition.
    float alpha = 1.0 - dist / uTailLen;
    alpha *= smoothstep(0.0, 0.05, dist);  // very subtle fade-in at head
    gl_FragColor = vec4(uColor, alpha * uOpacity);
  }
`;

function WindStreaks() {
  const groupRefs = useRef([]);
  const matRefs   = useRef([]);
  const wind      = useMemo(() => new THREE.Vector2(0.62, 0.78).normalize(), []);
  const angle     = useMemo(() => Math.atan2(wind.x, wind.y), [wind]);
  const lateralX  = useMemo(() => -wind.y, [wind]);
  const lateralZ  = useMemo(() =>  wind.x, [wind]);

  // Each streak's static parameters: a unique curve (geometry stays the
  // same, only the progress animation moves) + drift offsets so the
  // streaks don't overlap each other.
  const streaks = useMemo(() => {
    const rng = seededRng(0xc0fee_b00);
    return Array.from({ length: STREAK_COUNT }, () => {
      const length      = 4.5 + rng() * 4.0;
      const handleCount = 4 + Math.floor(rng() * 3);
      // Lower amplitude → flatter, more subtle ribbons (the user
      // specifically asked for the wind effects to be quieter).
      const amplitude   = 0.30 + rng() * 0.45;
      const curve       = buildStreakCurve(length, handleCount, amplitude);
      return {
        // 36 segments along, 6 around → smooth curve, ~6 px thick visually
        geom:        new THREE.TubeGeometry(curve, 36, 0.025, 6, false),
        lateral:     (rng() - 0.5) * STREAK_RADIUS * 1.6,
        heightDelta: (rng() - 0.5) * STREAK_BAND,
        offset:      rng() * STREAK_RADIUS * 2,
        // Per-streak animation parameters
        duration:    2.5 + rng() * 1.6,         // seconds for one full draw
        phase:       rng() * 2.5,
      };
    });
  }, []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    for (let i = 0; i < streaks.length; i++) {
      const s = streaks[i];
      const g = groupRefs.current[i];
      const m = matRefs.current[i];

      // Drifting position around the player along the wind vector
      if (g) {
        const along = ((s.offset + t * 1.6) % (STREAK_RADIUS * 2)) - STREAK_RADIUS;
        g.position.set(
          bikeState.x + wind.x * along + lateralX * s.lateral,
          STREAK_HEIGHT + s.heightDelta,
          bikeState.z + wind.y * along + lateralZ * s.lateral,
        );
        g.rotation.y = angle;
      }

      // Draw/erase animation: progress wraps from 0 to 1 + tailLen so the
      // entire ribbon disappears before the next draw starts. The +tailLen
      // overrun is what makes the ribbon "erase" itself completely at the
      // end of each cycle instead of snapping back to the start.
      if (m) {
        const tailLen = m.uniforms.uTailLen.value;
        const cycle   = ((t + s.phase) / s.duration) % 1;
        m.uniforms.uProgress.value = cycle * (1 + tailLen);
      }
    }
  });

  return (
    <group renderOrder={2}>
      {streaks.map((s, i) => (
        <group
          key={i}
          ref={(el) => { groupRefs.current[i] = el; }}
        >
          <mesh geometry={s.geom}>
            <shaderMaterial
              ref={(el) => { matRefs.current[i] = el; }}
              vertexShader={STREAK_VERT}
              fragmentShader={STREAK_FRAG}
              uniforms={{
                uProgress: { value: 0 },
                uTailLen:  { value: 0.32 },
                uColor:    { value: new THREE.Color(1, 1, 1) },
                uOpacity:  { value: 0.55 },
              }}
              transparent
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RAIN LINES — Bruno-Simon-style falling streaks.
//
// Many short vertical lines drop from the sky, wrapping around when
// they fall below ground level. Pure cosmetic — no physics, no impact
// on the player. Always-on at low density for atmosphere; the shader's
// per-line phase keeps them out of sync so the rain reads as natural
// rather than a curtain falling in unison.
// ─────────────────────────────────────────────────────────────────────────────
const RAIN_COUNT  = 220;
const RAIN_RADIUS = 36;          // wrap distance from player on XZ
const RAIN_HEIGHT = 24;          // drop height range
const RAIN_FALL   = 16;          // m/s falling speed

function RainLines() {
  const ref     = useRef();
  const dummy   = useMemo(() => new THREE.Object3D(), []);

  // Pre-bake per-drop random offsets (XZ + initial Y phase).
  const seeds = useMemo(() => {
    const rng = seededRng(0xa1d_a1ff);
    return Array.from({ length: RAIN_COUNT }, () => ({
      x:      (rng() - 0.5) * RAIN_RADIUS * 2,
      z:      (rng() - 0.5) * RAIN_RADIUS * 2,
      yPhase: rng() * RAIN_HEIGHT,
      length: 0.6 + rng() * 0.6,
    }));
  }, []);

  const geom = useMemo(() => new THREE.PlaneGeometry(0.018, 1, 1, 1), []);
  const mat  = useMemo(() => new THREE.MeshBasicMaterial({
    color: 0xc8e0ff,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  }), []);

  useFrame((state) => {
    const inst = ref.current;
    if (!inst) return;
    const t = state.clock.getElapsedTime();
    for (let i = 0; i < RAIN_COUNT; i++) {
      const s = seeds[i];
      // Falling Y wraps every RAIN_HEIGHT metres
      const y = ((s.yPhase + RAIN_HEIGHT - t * RAIN_FALL) % RAIN_HEIGHT);
      dummy.position.set(bikeState.x + s.x, y, bikeState.z + s.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, s.length, 1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[geom, mat, RAIN_COUNT]}
      frustumCulled={false}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CLOUD SHADOWS — soft, drifting dark patches on the ground.
//
// A single big plane sitting just above the grass at y=0.06 with a
// noise-based fragment shader. The noise pattern animates along a fixed
// wind direction so the shadows visibly travel across the meadow.
// Doesn't actually receive light — it's a multiplicative-darkening fake
// rendered with a controlled opacity.
// ─────────────────────────────────────────────────────────────────────────────
const CLOUDS_VERT = /* glsl */`
  varying vec2 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const CLOUDS_FRAG = /* glsl */`
  precision highp float;
  uniform float uTime;
  uniform vec2  uWindDir;
  uniform float uIntensity;
  varying vec2  vWorld;

  // Cheap procedural cloud noise — three sine layers in world space
  // sliding along uWindDir so the pattern flows.
  float layer(vec2 p, float scale, float phase) {
    p *= scale;
    return 0.5 + 0.5 * sin(p.x + phase) * sin(p.y * 1.3 - phase * 0.8);
  }

  void main() {
    vec2 t = uWindDir * uTime * 0.6;
    float n = layer(vWorld - t,        0.05, uTime * 0.30)
            * layer(vWorld - t * 0.7,  0.09, uTime * 0.18)
            * layer(vWorld - t * 1.4,  0.18, uTime * 0.42);

    // Cloud mask — keep only the darker half of the noise so we get
    // discrete shadow blobs rather than a uniform haze.
    float mask = smoothstep(0.50, 0.20, n);
    float alpha = mask * uIntensity;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
  }
`;

function CloudShadows({ dayRef }) {
  const matRef = useRef();
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   CLOUDS_VERT,
    fragmentShader: CLOUDS_FRAG,
    uniforms: {
      uTime:      { value: 0 },
      uWindDir:   { value: new THREE.Vector2(0.65, 0.76) },
      uIntensity: { value: 0.35 },
    },
    transparent: true,
    depthWrite:  false,
  }), []);
  matRef.current = material;

  useFrame((_, dt) => {
    matRef.current.uniforms.uTime.value += dt;
    if (dayRef?.current) {
      // Only show cloud shadows during daylight — a moonlit night
      // would have a different shadow logic that we skip for now.
      matRef.current.uniforms.uIntensity.value =
        0.35 * (dayRef.current.dayWeight ?? 1);
    }
  });

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.07, 0]}
      renderOrder={1}
    >
      <planeGeometry args={[160, 160, 1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOW-POLY TREES — three species rotated through the placement list so the
// island reads as a real woodland rather than a stamp duplicated 21 times.
// ─────────────────────────────────────────────────────────────────────────────

// 1) FIR — original stacked-cone shape. Tall, layered, spruce-like.
function FirTree({ position, scale = 1, hueShift = 0, rotY = 0 }) {
  const c1 = new THREE.Color(`hsl(${135 + hueShift}, 50%, 27%)`).getStyle();
  const c2 = new THREE.Color(`hsl(${130 + hueShift}, 55%, 35%)`).getStyle();
  const c3 = new THREE.Color(`hsl(${125 + hueShift}, 58%, 42%)`).getStyle();
  return (
    <RigidBody type="fixed" colliders={false} position={position}>
      <CuboidCollider args={[0.2 * scale, 0.7 * scale, 0.2 * scale]} position={[0, 0.7 * scale, 0]} />
      <group scale={scale} rotation={[0, rotY, 0]}>
        <mesh castShadow position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.12, 0.16, 1.1, 7]} />
          <meshStandardMaterial color="#6b4226" roughness={0.96} />
        </mesh>
        <mesh castShadow position={[0, 1.65, 0]}>
          <coneGeometry args={[0.75, 1.6, 7]} />
          <meshStandardMaterial color={c1} roughness={0.88} />
        </mesh>
        <mesh castShadow position={[0, 2.5, 0]}>
          <coneGeometry args={[0.52, 1.2, 7]} />
          <meshStandardMaterial color={c2} roughness={0.85} />
        </mesh>
        <mesh castShadow position={[0, 3.1, 0]}>
          <coneGeometry args={[0.3, 0.85, 6]} />
          <meshStandardMaterial color={c3} roughness={0.82} />
        </mesh>
      </group>
    </RigidBody>
  );
}

// 2) PINE — taller and skinnier, single tall cone canopy. Reads as cypress.
function PineTree({ position, scale = 1, hueShift = 0, rotY = 0 }) {
  const c = new THREE.Color(`hsl(${145 + hueShift}, 45%, 28%)`).getStyle();
  return (
    <RigidBody type="fixed" colliders={false} position={position}>
      <CuboidCollider args={[0.18 * scale, 0.85 * scale, 0.18 * scale]} position={[0, 0.85 * scale, 0]} />
      <group scale={scale} rotation={[0, rotY, 0]}>
        <mesh castShadow position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.09, 0.13, 1.1, 6]} />
          <meshStandardMaterial color="#5a3a22" roughness={0.96} />
        </mesh>
        <mesh castShadow position={[0, 2.4, 0]}>
          <coneGeometry args={[0.55, 3.2, 8]} />
          <meshStandardMaterial color={c} roughness={0.85} />
        </mesh>
        <mesh castShadow position={[0, 3.7, 0]}>
          <coneGeometry args={[0.28, 0.9, 6]} />
          <meshStandardMaterial color={c} roughness={0.82} />
        </mesh>
      </group>
    </RigidBody>
  );
}

// 3) BUSH — round, dome-shaped foliage on a short trunk. Reads as oak/maple.
function BushTree({ position, scale = 1, hueShift = 0, rotY = 0 }) {
  const c1 = new THREE.Color(`hsl(${110 + hueShift}, 48%, 32%)`).getStyle();
  const c2 = new THREE.Color(`hsl(${100 + hueShift}, 52%, 40%)`).getStyle();
  return (
    <RigidBody type="fixed" colliders={false} position={position}>
      <CuboidCollider args={[0.25 * scale, 0.55 * scale, 0.25 * scale]} position={[0, 0.55 * scale, 0]} />
      <group scale={scale} rotation={[0, rotY, 0]}>
        <mesh castShadow position={[0, 0.4, 0]}>
          <cylinderGeometry args={[0.16, 0.20, 0.8, 7]} />
          <meshStandardMaterial color="#7a4a28" roughness={0.95} />
        </mesh>
        <mesh castShadow position={[0, 1.2, 0]}>
          <icosahedronGeometry args={[0.95, 0]} />
          <meshStandardMaterial color={c1} roughness={0.85} flatShading />
        </mesh>
        <mesh castShadow position={[0.45, 1.55, 0.15]}>
          <icosahedronGeometry args={[0.55, 0]} />
          <meshStandardMaterial color={c2} roughness={0.82} flatShading />
        </mesh>
        <mesh castShadow position={[-0.3, 1.7, -0.2]}>
          <icosahedronGeometry args={[0.45, 0]} />
          <meshStandardMaterial color={c2} roughness={0.82} flatShading />
        </mesh>
      </group>
    </RigidBody>
  );
}

const TREE_SPECIES = [FirTree, PineTree, BushTree, FirTree, BushTree, PineTree];

// ─────────────────────────────────────────────────────────────────────────────
// LOW-POLY HOUSE  (box body + pyramid roof)
// ─────────────────────────────────────────────────────────────────────────────
const HOUSE_PALETTE = [
  { wall: "#fde8d0", roof: "#e07b5a" },
  { wall: "#d4ecd4", roof: "#5a9e6a" },
  { wall: "#d0e4f5", roof: "#5572b8" },
  { wall: "#f7e0c8", roof: "#b87840" },
  { wall: "#e8d8f5", roof: "#8860c0" },
  { wall: "#fdf5c8", roof: "#c8a030" },
];

function House({ position, rotation = 0, paletteIdx = 0, scale = 1, variant = 0 }) {
  const { wall, roof } = HOUSE_PALETTE[paletteIdx % HOUSE_PALETTE.length];
  const tall = variant === 1;            // tall narrow townhouse variant
  const cottage = variant === 2;         // wide low cottage variant
  const w  = cottage ? 3.1 : tall ? 1.8 : 2.4;
  const h  = tall ? 3.0 : 2.2;
  const d  = cottage ? 2.0 : 2.4;
  const rh = tall ? 1.8 : 1.5;

  return (
    <RigidBody type="fixed" colliders={false} position={position}>
      <CuboidCollider
        args={[(w / 2) * scale, (h / 2) * scale, (d / 2) * scale]}
        position={[0, (h / 2) * scale, 0]}
      />
      <group scale={scale} rotation={[0, rotation, 0]}>
        {/* Stone foundation */}
        <mesh castShadow receiveShadow position={[0, 0.12, 0]}>
          <boxGeometry args={[w + 0.18, 0.24, d + 0.18]} />
          <meshStandardMaterial color="#9a9286" roughness={0.92} />
        </mesh>
        {/* Walls */}
        <mesh castShadow receiveShadow position={[0, h / 2 + 0.24, 0]}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color={wall} roughness={0.82} metalness={0.02} />
        </mesh>
        {/* Roof — 4-sided pyramid */}
        <mesh castShadow position={[0, h + 0.24 + rh / 2, 0]}>
          <coneGeometry args={[Math.max(w, d) * 0.8 + 0.05, rh, 4]} />
          <meshStandardMaterial color={roof} roughness={0.76} metalness={0.02} />
        </mesh>
        {/* Chimney (variant-dependent offset) */}
        <mesh castShadow position={[w * 0.28, h + 0.24 + rh * 0.6, -d * 0.28]}>
          <boxGeometry args={[0.22, 0.8, 0.22]} />
          <meshStandardMaterial color="#8a6a55" roughness={0.9} />
        </mesh>
        {/* Smoke puff (just a tiny rounded cap, static) */}
        <mesh position={[w * 0.28, h + 0.24 + rh * 0.6 + 0.5, -d * 0.28]}>
          <sphereGeometry args={[0.18, 8, 8]} />
          <meshStandardMaterial color="#c8c4be" roughness={0.95} transparent opacity={0.6} />
        </mesh>
        {/* Door */}
        <mesh position={[0, 0.74, d / 2 + 0.01]}>
          <boxGeometry args={[0.6, 1.2, 0.06]} />
          <meshStandardMaterial color="#4a3520" roughness={0.7} />
        </mesh>
        {/* Door step */}
        <mesh position={[0, 0.18, d / 2 + 0.18]}>
          <boxGeometry args={[0.8, 0.12, 0.32]} />
          <meshStandardMaterial color="#a89a86" roughness={0.9} />
        </mesh>
        {/* Front window with frame */}
        <mesh position={[w * 0.32, h * 0.55 + 0.24, d / 2 + 0.005]}>
          <boxGeometry args={[0.55, 0.55, 0.04]} />
          <meshStandardMaterial color="#5a4a3a" roughness={0.7} />
        </mesh>
        <mesh position={[w * 0.32, h * 0.55 + 0.24, d / 2 + 0.012]}>
          <boxGeometry args={[0.42, 0.42, 0.04]} />
          <meshStandardMaterial color="#cfe6f7" roughness={0.15} metalness={0.15} emissive="#fff7d6" emissiveIntensity={0.18} />
        </mesh>
        {/* Side window */}
        {tall ? null : (
          <mesh position={[-w * 0.32, h * 0.55 + 0.24, d / 2 + 0.005]}>
            <boxGeometry args={[0.42, 0.42, 0.04]} />
            <meshStandardMaterial color="#cfe6f7" roughness={0.15} metalness={0.15} emissive="#fff7d6" emissiveIntensity={0.15} />
          </mesh>
        )}
        {/* Planter box under window — adds life on the cottage variant */}
        {cottage && (
          <>
            <mesh position={[w * 0.32, h * 0.32 + 0.24, d / 2 + 0.16]}>
              <boxGeometry args={[0.6, 0.16, 0.18]} />
              <meshStandardMaterial color="#6b4a2c" roughness={0.85} />
            </mesh>
            <mesh position={[w * 0.32, h * 0.32 + 0.36, d / 2 + 0.16]}>
              <icosahedronGeometry args={[0.13, 0]} />
              <meshStandardMaterial color="#cf3a7b" roughness={0.7} flatShading />
            </mesh>
          </>
        )}
      </group>
    </RigidBody>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LAMPS — two variants alternated through the placement list.
// 1) StreetLamp: original swing-arm pole with a glowing bulb (urban feel).
// 2) HangingLantern: bell-shaped cage on a curved arm (warmer, garden feel).
// ─────────────────────────────────────────────────────────────────────────────
function StreetLamp({ position }) {
  return (
    <RigidBody type="fixed" colliders={false} position={position}>
      <CuboidCollider args={[0.08, 1.5, 0.08]} position={[0, 1.5, 0]} />
      {/* Base plate */}
      <mesh castShadow position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 0.1, 12]} />
        <meshStandardMaterial color="#3a3a3f" metalness={0.6} roughness={0.5} />
      </mesh>
      {/* Pole */}
      <mesh castShadow position={[0, 1.55, 0]}>
        <cylinderGeometry args={[0.055, 0.07, 3.0, 8]} />
        <meshStandardMaterial color="#1f2937" metalness={0.65} roughness={0.42} />
      </mesh>
      {/* Arm */}
      <mesh castShadow position={[0.22, 2.95, 0]}>
        <boxGeometry args={[0.48, 0.07, 0.14]} />
        <meshStandardMaterial color="#27272a" metalness={0.6} roughness={0.45} />
      </mesh>
      {/* Lamp head + bulb */}
      <mesh castShadow position={[0.44, 2.92, 0]}>
        <cylinderGeometry args={[0.13, 0.16, 0.15, 10]} />
        <meshStandardMaterial color="#27272a" metalness={0.55} roughness={0.55} />
      </mesh>
      <mesh position={[0.44, 2.82, 0]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshStandardMaterial
          color="#fef9c3"
          emissive="#fbbf24"
          emissiveIntensity={2.8}
          toneMapped={false}
        />
      </mesh>
      <pointLight
        position={[0.44, 2.82, 0]}
        intensity={0.5}
        distance={8}
        decay={2}
        color="#fbbf24"
        castShadow={false}
      />
    </RigidBody>
  );
}

function HangingLantern({ position }) {
  return (
    <RigidBody type="fixed" colliders={false} position={position}>
      <CuboidCollider args={[0.08, 1.4, 0.08]} position={[0, 1.4, 0]} />
      {/* Base */}
      <mesh castShadow position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.20, 0.24, 0.12, 8]} />
        <meshStandardMaterial color="#1d1816" metalness={0.5} roughness={0.6} />
      </mesh>
      {/* Pole */}
      <mesh castShadow position={[0, 1.45, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 2.7, 8]} />
        <meshStandardMaterial color="#221b15" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* Curved arm — a horizontal then vertical drop (two short cylinders) */}
      <mesh castShadow position={[0.18, 2.78, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 0.42, 8]} />
        <meshStandardMaterial color="#221b15" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0.39, 2.62, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.34, 8]} />
        <meshStandardMaterial color="#221b15" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* Lantern cage — black frame */}
      <mesh castShadow position={[0.39, 2.32, 0]}>
        <boxGeometry args={[0.34, 0.42, 0.34]} />
        <meshStandardMaterial color="#1a1411" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* Glow core inside the cage */}
      <mesh position={[0.39, 2.32, 0]}>
        <boxGeometry args={[0.22, 0.30, 0.22]} />
        <meshStandardMaterial
          color="#fef3c7"
          emissive="#fb923c"
          emissiveIntensity={2.2}
          toneMapped={false}
        />
      </mesh>
      {/* Decorative cap on top */}
      <mesh castShadow position={[0.39, 2.62, 0]}>
        <coneGeometry args={[0.18, 0.16, 4]} />
        <meshStandardMaterial color="#1a1411" metalness={0.45} roughness={0.55} />
      </mesh>
      <pointLight
        position={[0.39, 2.32, 0]}
        intensity={0.55}
        distance={9}
        decay={2}
        color="#fb923c"
        castShadow={false}
      />
    </RigidBody>
  );
}

const LAMP_VARIANTS = [StreetLamp, HangingLantern];

// ─────────────────────────────────────────────────────────────────────────────
// ROCK
// ─────────────────────────────────────────────────────────────────────────────
function Rock({ position, seed = 1 }) {
  const rng = useMemo(() => seededRng(seed), [seed]);
  const sx = 0.8 + rng() * 0.7;
  const sy = 0.5 + rng() * 0.45;
  const sz = 0.8 + rng() * 0.6;
  const ry = rng() * Math.PI;
  // Slightly varied stone palette so a cluster of rocks doesn't look stamped
  const tint = `hsl(${210 + Math.floor(rng() * 35) - 15}, 8%, ${40 + Math.floor(rng() * 14)}%)`;
  return (
    <mesh
      castShadow
      receiveShadow
      position={[position[0], 0.28 * sy, position[2]]}
      rotation={[0, ry, 0]}
      scale={[sx, sy, sz]}
    >
      <dodecahedronGeometry args={[0.52, 0]} />
      <meshStandardMaterial color={tint} roughness={0.94} metalness={0.08} flatShading />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GRASS MOUND — low elliptical hill of grass that breaks up the flat
// ground plane.  Visual-only (no collider) — the bike rolls right over
// shallow mounds without noticing, but the eye reads them as terrain.
// ─────────────────────────────────────────────────────────────────────────────
function GrassMound({ position, scale = 1, hueShift = 0, ry = 0 }) {
  const baseColor = useMemo(
    () => new THREE.Color(`hsl(${108 + hueShift}, 42%, ${28 + (hueShift % 7)}%)`).getStyle(),
    [hueShift],
  );
  return (
    <group position={[position[0], 0, position[2]]} rotation={[0, ry, 0]}>
      {/* Main dome — low, wide, flat-shaded so the silhouette reads as a hill */}
      <mesh
        position={[0, -0.12, 0]}
        scale={[scale * 1.4, scale * 0.42, scale * 1.0]}
        receiveShadow
        castShadow
      >
        <sphereGeometry args={[2.4, 18, 10]} />
        <meshStandardMaterial color={baseColor} roughness={0.9} flatShading />
      </mesh>
      {/* Smaller secondary bump for irregularity */}
      <mesh
        position={[scale * 0.9, -0.05, scale * 0.4]}
        scale={[scale * 0.9, scale * 0.34, scale * 0.7]}
        receiveShadow
        castShadow
      >
        <sphereGeometry args={[1.5, 14, 8]} />
        <meshStandardMaterial color={baseColor} roughness={0.92} flatShading />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DIRT PATCH — flat exposed-earth circle. A simple way to break up the
// uniformly-green meadow and suggest worn tracks between landmarks.
// ─────────────────────────────────────────────────────────────────────────────
function DirtPatch({ position, radius = 1.2, seed = 1 }) {
  const rng = useMemo(() => seededRng(seed), [seed]);
  const ry = rng() * Math.PI * 2;
  const tint = useMemo(
    () => new THREE.Color(`hsl(${28 + Math.floor(rng() * 12)}, 38%, ${30 + Math.floor(rng() * 8)}%)`).getStyle(),
    [rng],
  );
  return (
    <mesh
      position={[position[0], 0.014, position[2]]}
      rotation={[-Math.PI / 2, 0, ry]}
      receiveShadow
      renderOrder={0}
    >
      <circleGeometry args={[radius, 24]} />
      <meshStandardMaterial
        color={tint}
        roughness={0.95}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOWER PATCH — small clump of bright icosahedral "blossoms" on stems.
// Adds a pop of saturated colour at ground level so the meadow doesn't feel
// like one flat green carpet.
// ─────────────────────────────────────────────────────────────────────────────
const FLOWER_HUES = ["#fde68a", "#fbcfe8", "#a7f3d0", "#bfdbfe", "#fca5a5", "#ddd6fe"];

function FlowerPatch({ position, seed = 1 }) {
  const rng = useMemo(() => seededRng(seed), [seed]);
  const blooms = useMemo(
    () => Array.from({ length: 5 + Math.floor(rng() * 4) }, () => ({
      x:    (rng() - 0.5) * 0.9,
      z:    (rng() - 0.5) * 0.9,
      h:    0.18 + rng() * 0.18,
      hue:  FLOWER_HUES[Math.floor(rng() * FLOWER_HUES.length)],
      size: 0.07 + rng() * 0.04,
    })),
    [rng],
  );
  return (
    <group position={position}>
      {blooms.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]}>
          {/* Stem */}
          <mesh castShadow position={[0, b.h / 2, 0]}>
            <cylinderGeometry args={[0.012, 0.018, b.h, 5]} />
            <meshStandardMaterial color="#3f6c30" roughness={0.85} />
          </mesh>
          {/* Blossom */}
          <mesh castShadow position={[0, b.h, 0]}>
            <icosahedronGeometry args={[b.size, 0]} />
            <meshStandardMaterial
              color={b.hue}
              emissive={b.hue}
              emissiveIntensity={0.18}
              roughness={0.65}
              flatShading
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Road / plaza exclusion — keep trees and lamps off the streets.
// MUST stay in sync with the road list in components/Ground.js.
// ─────────────────────────────────────────────────────────────────────────────
const ROAD_SEGMENTS = [
  [[  0,   0], [-38, -35]],   // HQ ↔ HAW
  [[  0,   0], [ 42, -22]],   // HQ ↔ Designa
  [[  0,   0], [  8,  40]],   // HQ ↔ Kebab
  [[  0,   0], [-36,  32]],   // HQ ↔ Highschool
  [[-38, -35], [ 42, -22]],   // HAW ↔ Designa
  [[ 42, -22], [  8,  40]],   // Designa ↔ Kebab  ← was missing
  [[  8,  40], [-36,  32]],   // Kebab ↔ Highschool
  [[-36,  32], [-38, -35]],   // Highschool ↔ HAW
];
const ROAD_CLEARANCE = 5.5;   // metres from any road centre-line

const PLAZAS = [
  [  0,   0, 9.5],
  [-38, -35, 8.0],
  [ 42, -22, 8.0],
  [  8,  40, 8.0],
  [-36,  32, 8.0],
];

function distToSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-6) return Math.hypot(px - ax, pz - az);
  let t = ((px - ax) * dx + (pz - az) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

function isOnRoad(x, z) {
  return ROAD_SEGMENTS.some(([[ax, az], [bx, bz]]) =>
    distToSeg(x, z, ax, az, bx, bz) < ROAD_CLEARANCE,
  );
}

function isInPlaza(x, z) {
  return PLAZAS.some(([px, pz, r]) => Math.hypot(x - px, z - pz) < r);
}

// Decoration positions must sit on grass — not on roads, plazas, the beach
// ring, or beyond the irregular coastline. The grass polygon test comes
// from the shared islandShape module so the coast is the single source of
// truth.
const isBlocked = (x, z) =>
  isOnRoad(x, z) || isInPlaza(x, z) || !isInGrass(x, z);

// ─────────────────────────────────────────────────────────────────────────────
// Layout data — hand-placed, path-safe, landmark-safe
// ─────────────────────────────────────────────────────────────────────────────
const TREES_RAW = [
  [-55, 0, -50], [-50, 0, 15], [-55, 0, 45],
  [ 55, 0,  50], [ 50, 0,-45], [ 55, 0,  5],
  [ -8, 0, -55], [ 18, 0,-55], [-22, 0, -52],
  [ 48, 0,  42], [-48, 0,  40], [ 28, 0,  52],
  [-50, 0, -10], [ 52, 0, -12], [ -2, 0,  55],
  [ 35, 0,  -6], [-35, 0,   8], [ 22, 0,  18],
  [-22, 0, -10], [ 10, 0, -22], [-12, 0,  15],
];

// Lamp posts — only ones lining the road network make sense. The "outer
// ring" lamps that used to sit between landmarks and the coast were
// removed; isolated lamps in the middle of nowhere read as random clutter
// rather than civic infrastructure.
const LAMPS_RAW = [
  // Along the spokes radiating from HQ
  [  0, 0,  16], [  0, 0, -16],
  [ 16, 0,   0], [-16, 0,   0],
  // Mid-spoke pairs, just on the grass beside each road
  [-15, 0, -14], [ 17, 0,  -9],
  [  3, 0,  16], [-14, 0,  13],
  // Plaza approach lamps — placed at the junctions
  [-31, 0, -28], [ 34, 0, -18],
  [  6, 0,  32], [-28, 0,  26],
];

// Houses — placed in the meadow "wedges" between landmark roads, where
// the radial road from HQ and any inter-landmark road both clear the
// position by at least HOUSE_ROAD_CLEAR metres. Each spot has been hand-
// audited to avoid overlapping a tree or the Designa↔Kebab cross-road.
const HOUSES_RAW = [
  { pos: [-26, 0,  12], rot: 0.4,  pi: 0, sc: 1.0,  v: 0 },   // NW wedge
  { pos: [-12, 0,  24], rot: 0.7,  pi: 2, sc: 1.0,  v: 1 },   // N wedge
  { pos: [ 30, 0,  18], rot: 1.1,  pi: 4, sc: 0.9,  v: 1 },   // NE wedge
  { pos: [ 36, 0,   4], rot: -0.3, pi: 1, sc: 0.95, v: 2 },   // E wedge
  { pos: [ 12, 0, -38], rot: -0.5, pi: 3, sc: 1.05, v: 2 },   // S wedge
];

const ROCKS = [
  [-45, 0,  30], [ 45, 0, -30], [-30, 0, -48],
  [  0, 0,  48], [ 48, 0,  18], [-48, 0, -18],
  [ 30, 0,  30], [-30, 0,  30], [ 15, 0, -45],
  // Small clusters near landmark plazas for more "settled" feel
  [-44, 0, -40], [-32, 0, -42], [ 36, 0, -28],
  [ 12, 0,  44], [-30, 0,  38], [ 25, 0,  -2],
];

// Hand-placed flower patches — bright dots in the grass. Filtered like
// the trees so they never spawn on a road or plaza tile.
const FLOWERS_RAW = [
  [-44, 0,  -2], [-30, 0, -10], [-18, 0,  10],
  [ 30, 0,  -8], [ 22, 0,  10], [ 44, 0,   8],
  [-12, 0,  20], [ 14, 0,  22], [-22, 0, -22],
  [ -6, 0, -42], [ 24, 0,  30], [ -28, 0, 12],
  [ 38, 0,  -2], [ -42, 0, 20], [ 28, 0, -42],
  [ -10, 0, 38], [ 18, 0, -10], [ -6, 0, 14],
];

// Hand-placed grassy mounds. Each entry is [x, z, scale, hueShift, ry].
// Coordinates avoid roads/plazas — verified against isBlocked at module load.
const MOUNDS_RAW = [
  [-26, 0,  -8, 1.4,   3, 0.4],
  [ 22, 0,  -6, 1.2,  -4, 1.1],
  [-14, 0,  18, 1.5,   8, 2.2],
  [ 18, 0,  22, 1.1,  -7, -0.6],
  [-30, 0, -22, 1.6,   2, 0.9],
  [ 32, 0,  10, 1.3,   6, -1.3],
  [-44, 0,  10, 1.0,  -2, 0.2],
  [ 14, 0, -28, 1.4,   5, 1.7],
  [-10, 0,  46, 1.2,  -3, 0.5],
  [ 26, 0,  44, 1.0,   7, -0.8],
];

// Hand-placed bare-earth patches. Suggest desire-paths and worn ground
// between landmarks; size varies for natural irregularity.
const DIRT_RAW = [
  [-18, 0, -14, 1.4],
  [ 20, 0, -16, 1.1],
  [-22, 0,  10, 1.0],
  [ 12, 0,  10, 1.6],
  [ 28, 0,  24, 1.2],
  [-30, 0,  20, 1.3],
  [-12, 0, -34, 1.0],
  [ 14, 0,  34, 1.4],
  [-44, 0,  -2, 1.0],
  [ 44, 0,   2, 1.1],
];

// Apply the road / plaza / beach filter exactly once at module load
const TREES   = TREES_RAW.filter(([x, , z]) => !isBlocked(x, z));
const LAMPS   = LAMPS_RAW.filter(([x, , z]) => !isBlocked(x, z));
const FLOWERS = FLOWERS_RAW.filter(([x, , z]) => !isBlocked(x, z));
const MOUNDS  = MOUNDS_RAW.filter(([x, , z]) => !isBlocked(x, z));
const DIRT    = DIRT_RAW.filter(([x, , z]) => !isBlocked(x, z));

// Houses get a stricter test:
//  - 7 m clearance from any road centre-line (vs. 5.5 for trees), so a
//    ~3 m-footprint house never overhangs the curb.
//  - 4 m clearance from any already-placed tree, lamp, mound, or
//    Easter-egg position so houses don't end up wedged inside a bush.
const HOUSE_ROAD_CLEAR = 7;
const HOUSE_NEIGHBOUR_CLEAR = 4;
const NEIGHBOUR_POINTS = [
  ...TREES.map((t)   => [t[0],   t[2]]),
  ...LAMPS.map((l)   => [l[0],   l[2]]),
  ...MOUNDS.map((m)  => [m[0],   m[2]]),
  // Easter-egg positions hard-coded here (kept in sync with EasterEggs.js).
  // Avoids the hangar-on-top-of-bush failure mode the user reported.
  [-3.6, 6.4],   // raspberry pi
  [11,   49],    // router
  [-18, -10],    // shipping container
  [26,   12],    // dumbbell
];

function tooCloseToRoad(x, z, clear) {
  return ROAD_SEGMENTS.some(([[ax, az], [bx, bz]]) =>
    distToSeg(x, z, ax, az, bx, bz) < clear,
  );
}
function tooCloseToNeighbour(x, z) {
  return NEIGHBOUR_POINTS.some(
    ([nx, nz]) => Math.hypot(x - nx, z - nz) < HOUSE_NEIGHBOUR_CLEAR,
  );
}

const HOUSES = HOUSES_RAW.filter(({ pos: [x, , z] }) =>
  !tooCloseToRoad(x, z, HOUSE_ROAD_CLEAR) &&
  !isInPlaza(x, z) &&
  isInGrass(x, z) &&
  !tooCloseToNeighbour(x, z),
);

// ─────────────────────────────────────────────────────────────────────────────
// FIREFLIES — small instanced orbs that orbit around each lamppost
// All instances share one mesh; the per-instance matrix is rebuilt every
// frame from a phase + radius derived from the instance index.
// ─────────────────────────────────────────────────────────────────────────────
const FLIES_PER_LAMP = 6;

function Fireflies({ anchors }) {
  const ref     = useRef();
  const total   = anchors.length * FLIES_PER_LAMP;
  const dummy   = useMemo(() => new THREE.Object3D(), []);
  const tmpC    = useMemo(() => new THREE.Color(), []);
  const seedRef = useRef(null);

  // One-time per-instance random parameters (orbit radius, height, phase, hue)
  if (seedRef.current === null) {
    const rng = seededRng(0xface_b00c);
    seedRef.current = new Float32Array(total * 4);
    for (let i = 0; i < total; i++) {
      seedRef.current[i * 4 + 0] = 0.4 + rng() * 0.7;          // radius
      seedRef.current[i * 4 + 1] = 1.6 + rng() * 1.2;          // base height
      seedRef.current[i * 4 + 2] = rng() * Math.PI * 2;        // phase
      seedRef.current[i * 4 + 3] = 0.3 + rng() * 0.7;          // speed factor
    }
  }

  const geo = useMemo(() => new THREE.SphereGeometry(0.045, 8, 8), []);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0xffd97a,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        vertexColors: true,
      }),
    [],
  );

  // Init transparent grey so hidden particles never bloom black
  useEffect(() => {
    if (!ref.current) return;
    for (let i = 0; i < total; i++) {
      dummy.position.set(0, -999, 0);
      dummy.scale.setScalar(0.001);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
      ref.current.setColorAt(i, tmpC.set(0, 0, 0));
    }
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [dummy, total, tmpC]);

  useFrame((state) => {
    const inst = ref.current;
    if (!inst) return;
    const t = state.clock.getElapsedTime();
    const seed = seedRef.current;

    let i = 0;
    for (const [ax, , az] of anchors) {
      for (let k = 0; k < FLIES_PER_LAMP; k++, i++) {
        const r       = seed[i * 4 + 0];
        const baseY   = seed[i * 4 + 1];
        const phase   = seed[i * 4 + 2];
        const speed   = seed[i * 4 + 3];

        const angle = t * speed + phase;
        const wob   = Math.sin(t * 1.3 + phase) * 0.15;
        const x = ax + Math.cos(angle) * (r + wob);
        const y = baseY + Math.sin(t * 1.7 + phase) * 0.18;
        const z = az + Math.sin(angle) * (r + wob);

        // Pulse intensity for that "blink" feel
        const blink = 0.55 + Math.sin(t * 2.4 + phase * 1.7) * 0.45;

        dummy.position.set(x, y, z);
        dummy.scale.setScalar(0.7 + blink * 0.5);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);

        const c = blink * 0.95;
        inst.setColorAt(i, tmpC.set(c, c * 0.85, c * 0.4));
      }
    }

    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[geo, mat, total]}
      frustumCulled={false}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root export
// ─────────────────────────────────────────────────────────────────────────────
export default function Decorations({ dayRef, rainEnabled = false }) {
  return (
    <group>
      {/* Static-placement grass field with track-flatten via shader */}
      <GrassField />

      {/* Drifting cloud shadows on the meadow */}
      <CloudShadows dayRef={dayRef} />

      {/* CatmullRom wind streaks drifting through the air */}
      <WindStreaks />

      {/* Optional rain — currently always on at low density */}
      {rainEnabled && <RainLines />}

      {/* Grassy mounds — break up the otherwise pancake-flat meadow */}
      {MOUNDS.map((m, i) => (
        <GrassMound
          key={`mound-${i}`}
          position={[m[0], 0, m[2]]}
          scale={m[3]}
          hueShift={m[4]}
          ry={m[5]}
        />
      ))}

      {/* Bare-earth patches — desire-paths between landmarks */}
      {DIRT.map((d, i) => (
        <DirtPatch
          key={`dirt-${i}`}
          position={[d[0], 0, d[2]]}
          radius={d[3]}
          seed={i * 11 + 5}
        />
      ))}

      {/* Trees — alternate species so the woodland reads as varied. The hue
          shift jitters the canopy palette per slot so even two adjacent
          firs don't look identical. */}
      {TREES.map((p, i) => {
        const Species = TREE_SPECIES[i % TREE_SPECIES.length];
        const hueShift = ((i * 47) % 30) - 15;        // ±15° hue jitter
        const rotY     = ((i * 113) % 360) * Math.PI / 180;
        return (
          <Species
            key={`tr-${i}`}
            position={p}
            scale={0.85 + (i % 5) * 0.18}
            hueShift={hueShift}
            rotY={rotY}
          />
        );
      })}

      {/* Flower patches scattered across the meadow */}
      {FLOWERS.map((p, i) => (
        <FlowerPatch key={`fl-${i}`} position={p} seed={i * 13 + 3} />
      ))}

      {/* Lamps — alternated between street-pole and hanging-lantern variants */}
      {LAMPS.map((p, i) => {
        const Variant = LAMP_VARIANTS[i % LAMP_VARIANTS.length];
        return <Variant key={`lp-${i}`} position={p} />;
      })}

      {/* Fireflies orbiting each lamp */}
      <Fireflies anchors={LAMPS} />

      {/* Pastel houses with shape variants */}
      {HOUSES.map((h, i) => (
        <House
          key={`h-${i}`}
          position={h.pos}
          rotation={h.rot}
          paletteIdx={h.pi}
          scale={h.sc}
          variant={h.v}
        />
      ))}

      {/* Rocks */}
      {ROCKS.map((p, i) => (
        <Rock key={`rk-${i}`} position={p} seed={i + 7} />
      ))}
    </group>
  );
}
