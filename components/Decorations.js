"use client";

import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";

import { isInGrass } from "@/lib/islandShape";
import { bikeState } from "@/lib/bikeStore";

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
// INFINITY GRASS  (Bruno-Simon-style follow-the-player grid)
//
// Instead of placing N blades at fixed world positions, we keep a fixed
// GRID × GRID array of instances and recompute every blade's *world*
// position in the vertex shader from a `uPlayerPos` uniform that's
// snapped to the tile size each frame. The grid effectively orbits the
// player, so density stays uniform under the camera while we render far
// fewer blades than a whole-island scatter would need. Blades whose
// computed world position falls outside the grass polygon (inside the
// shore) get their height squashed to zero, so the meadow stops at the
// coast naturally.
//
// Wind layer 1 — per-blade sine sway driven by a hash.
// Wind layer 2 — a "traveling gust" plane wave that moves along the
//               wind direction and ripples the whole field in unison.
// ─────────────────────────────────────────────────────────────────────────────

const GRASS_VERT = /* glsl */`
  attribute float aGridX;
  attribute float aGridZ;
  attribute float aHash;

  uniform float uTime;
  uniform vec3  uPlayerPos;
  uniform float uTileSize;
  uniform float uGridSize;
  uniform vec2  uWindDir;
  uniform float uWindStrength;
  uniform float uViewRadius;

  varying float vTip;
  varying float vFade;
  varying float vHash;

  // Simple deterministic hashes
  float hash11(float n) { return fract(sin(n) * 43758.5453); }
  vec2  hash22(float n) {
    return vec2(
      fract(sin(n * 12.9898) * 43758.5453),
      fract(sin(n * 78.233 ) * 43758.5453)
    );
  }

  // Mirrors lib/islandShape.js outerR + beachWidth so the grass fades
  // out at the inner-grass polygon boundary.
  float outerR(float a) {
    return 60.0
         + sin(a * 3.0  + 0.7) * 5.5
         + sin(a * 5.0  + 2.1) * 3.2
         + sin(a * 7.0  + 4.3) * 1.8
         + sin(a * 11.0 + 1.1) * 1.0;
  }
  float beachWidth(float a) {
    return 5.5 + sin(a * 4.0 + 1.3) * 1.6;
  }

  void main() {
    float halfGrid = uGridSize * 0.5;

    // Anchor world-space tile to the player position, quantised so the
    // grid only jumps once per tile crossing — blades stay rooted in
    // the world, they don't drift with the bike.
    float anchorX = floor(uPlayerPos.x / uTileSize) * uTileSize;
    float anchorZ = floor(uPlayerPos.z / uTileSize) * uTileSize;

    float tileWorldX = anchorX + (aGridX - halfGrid) * uTileSize;
    float tileWorldZ = anchorZ + (aGridZ - halfGrid) * uTileSize;

    // Per-blade jitter inside its tile so the grid doesn't read as a grid.
    vec2  j = (hash22(tileWorldX * 12.7 + tileWorldZ * 31.1) - 0.5) * uTileSize * 0.85;
    float worldX = tileWorldX + j.x;
    float worldZ = tileWorldZ + j.y;

    // Per-blade scale — plain hash of world position so the same world
    // location always produces the same blade size.
    float scale = 0.55 + hash11(worldX * 3.7 + worldZ * 11.3) * 0.85;

    // Polygon fade: drops blade height to 0 as r approaches the
    // inner-grass radius. Computed in shape-space (atan2(-z, x)).
    float r        = length(vec2(worldX, worldZ));
    float ang      = atan(-worldZ, worldX);
    float innerR   = outerR(ang) - beachWidth(ang);
    float polyFade = 1.0 - smoothstep(innerR - 1.5, innerR, r);

    // View-radius fade: blades far from the player vanish so we don't
    // pop blades into existence as the grid wraps.
    float vd = length(vec2(worldX, worldZ) - uPlayerPos.xz);
    float distFade = 1.0 - smoothstep(uViewRadius * 0.85, uViewRadius, vd);

    float fade = polyFade * distFade;

    // Local blade vertex (from the cone). Tip factor = 0 at root, 1 at tip.
    vec3 local = position;
    float tip = smoothstep(0.0, 1.0, (local.y + 0.001) / 1.05);

    // Wind layer 2 — traveling gust wave: a plane wave along uWindDir.
    float gustPhase = (worldX * uWindDir.x + worldZ * uWindDir.y) * 0.18 - uTime * 1.2;
    float gust      = sin(gustPhase) * 0.55 + 0.55;

    // Wind layer 1 — per-blade sway, hashed phase keeps neighbours out of
    // sync so the field doesn't move as one rigid sheet.
    float personal = sin(uTime * 1.7 + aHash * 6.2832) * 0.35;

    float sway = (gust + personal) * uWindStrength;

    local.x += sway * tip * uWindDir.x;
    local.z += sway * tip * uWindDir.y;

    // Apply height + width scale; height is multiplied by the fade
    // factor so the blade smoothly squashes flat at the coastline.
    local.x *= scale;
    local.z *= scale;
    local.y *= scale * fade;

    vec3 worldPos = vec3(worldX + local.x, local.y, worldZ + local.z);

    gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);

    vTip  = tip;
    vFade = fade;
    vHash = aHash;
  }
`;

const GRASS_FRAG = /* glsl */`
  precision highp float;

  uniform vec3  uTipColorA;
  uniform vec3  uTipColorB;
  uniform vec3  uRootColorA;
  uniform vec3  uRootColorB;
  uniform float uDayWeight;     // 1.0 day → 0.0 night

  varying float vTip;
  varying float vFade;
  varying float vHash;

  void main() {
    // Discard nearly-flat blades early — saves overdraw at the coast.
    if (vFade < 0.04) discard;

    float jitter = 0.5 + 0.5 * sin(vHash * 17.71);
    vec3 root = mix(uRootColorA, uRootColorB, jitter);
    vec3 tip  = mix(uTipColorA,  uTipColorB,  jitter);

    vec3 col = mix(root, tip, vTip);
    col *= mix(0.55, 1.0, vTip);              // base AO

    // Night-shift: cool the palette down as day weight drops.
    col = mix(col * vec3(0.18, 0.24, 0.42), col, uDayWeight);

    gl_FragColor = vec4(col, 1.0);
  }
`;

// Grid resolution and tile size. 80×80 = 6400 blades — high density right
// under the camera, and they're shader-positioned so we only update one
// uniform per frame instead of touching 6400 instance matrices.
const GRASS_GRID  = 80;
const GRASS_TILE  = 0.32;
const GRASS_COUNT = GRASS_GRID * GRASS_GRID;
const GRASS_VIEW  = (GRASS_GRID * GRASS_TILE) * 0.48;   // visible radius

function GrassField({ dayRef }) {
  const meshRef = useRef();
  const matRef  = useRef();
  const timeRef = useRef(0);
  const tmpVec  = useMemo(() => new THREE.Vector3(), []);

  // Per-instance attributes — fixed for the lifetime of the mesh.
  const { gridX, gridZ, hashes } = useMemo(() => {
    const rng = seededRng(0x5eed_b1ade);
    const gx = new Float32Array(GRASS_COUNT);
    const gz = new Float32Array(GRASS_COUNT);
    const hs = new Float32Array(GRASS_COUNT);
    let i = 0;
    for (let z = 0; z < GRASS_GRID; z++) {
      for (let x = 0; x < GRASS_GRID; x++) {
        gx[i] = x;
        gz[i] = z;
        hs[i] = rng();
        i++;
      }
    }
    return { gridX: gx, gridZ: gz, hashes: hs };
  }, []);

  useEffect(() => {
    if (!meshRef.current) return;
    // All instance matrices are identity — the shader does the layout.
    const ident = new THREE.Matrix4();
    for (let i = 0; i < GRASS_COUNT; i++) meshRef.current.setMatrixAt(i, ident);
    meshRef.current.instanceMatrix.needsUpdate = true;

    const geom = meshRef.current.geometry;
    geom.setAttribute("aGridX", new THREE.InstancedBufferAttribute(gridX, 1));
    geom.setAttribute("aGridZ", new THREE.InstancedBufferAttribute(gridZ, 1));
    geom.setAttribute("aHash",  new THREE.InstancedBufferAttribute(hashes, 1));
  }, [gridX, gridZ, hashes]);

  useFrame((_, delta) => {
    timeRef.current += delta;
    const m = matRef.current;
    if (!m) return;
    m.uniforms.uTime.value = timeRef.current;
    m.uniforms.uPlayerPos.value.set(bikeState.x, 0, bikeState.z);
    if (dayRef?.current) {
      m.uniforms.uDayWeight.value = dayRef.current.dayWeight ?? 1;
    }
  });

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader:   GRASS_VERT,
        fragmentShader: GRASS_FRAG,
        uniforms: {
          uTime:          { value: 0 },
          uPlayerPos:     { value: new THREE.Vector3() },
          uTileSize:      { value: GRASS_TILE },
          uGridSize:      { value: GRASS_GRID },
          uViewRadius:    { value: GRASS_VIEW },
          uWindDir:       { value: new THREE.Vector2(0.65, 0.76) },
          uWindStrength:  { value: 0.18 },
          uTipColorA:     { value: new THREE.Color(0.46, 0.84, 0.26) },
          uTipColorB:     { value: new THREE.Color(0.74, 0.92, 0.32) },
          uRootColorA:    { value: new THREE.Color(0.07, 0.26, 0.10) },
          uRootColorB:    { value: new THREE.Color(0.12, 0.34, 0.14) },
          uDayWeight:     { value: 1.0 },
        },
        side: THREE.DoubleSide,
      }),
    [],
  );

  useEffect(() => { matRef.current = material; }, [material]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, GRASS_COUNT]}
      frustumCulled={false}
    >
      {/* Tapered pyramid blade — 4-vert geometry: 3 base verts + 1 tip.
          Each blade is essentially a low-poly pyramid with a sharp tip. */}
      <coneGeometry args={[0.05, 1.05, 3]} />
      <primitive object={material} attach="material" />
    </instancedMesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WIND STREAKS — drifting white traces in the air around the player.
//
// Bruno-Simon-style "white wind lines" effect: thin elongated quads,
// additive blended, drift on a constant wind vector and wrap around
// the play area. We update only ~28 instance matrices per frame; the
// streaks follow the player so they're always visible without rendering
// a sky-full of geometry.
// ─────────────────────────────────────────────────────────────────────────────
const STREAK_COUNT = 28;
const STREAK_RADIUS = 32;       // wrap distance from player
const STREAK_SPEED  = 4.5;      // m/s along wind direction

function WindStreaks() {
  const ref     = useRef();
  const dummy   = useMemo(() => new THREE.Object3D(), []);
  const wind    = useMemo(() => new THREE.Vector2(0.65, 0.76).normalize(), []);

  // Per-streak random params: lateral offset, height, length, alpha,
  // initial along-wind position. Pre-baked so we just add time.
  const seeds = useMemo(() => {
    const rng = seededRng(0xc0fee_b00);
    const arr = [];
    for (let i = 0; i < STREAK_COUNT; i++) {
      arr.push({
        lateral: (rng() - 0.5) * STREAK_RADIUS * 1.6,
        height:  1.5 + rng() * 5.5,
        length:  3.0 + rng() * 4.5,
        alpha:   0.18 + rng() * 0.18,
        offset:  rng() * STREAK_RADIUS * 2,
      });
    }
    return arr;
  }, []);

  const geom = useMemo(() => new THREE.PlaneGeometry(1, 0.06), []);
  const mat  = useMemo(() => new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    side: THREE.DoubleSide,
  }), []);

  // Wind angle in world XZ plane — rotates the strip's long axis
  const angle = useMemo(() => Math.atan2(wind.x, wind.y), [wind]);
  // Right-perpendicular to wind, used for the lateral offset
  const lateralX = useMemo(() => -wind.y, [wind]);
  const lateralZ = useMemo(() =>  wind.x, [wind]);

  useFrame((state) => {
    const inst = ref.current;
    if (!inst) return;
    const t = state.clock.getElapsedTime();
    for (let i = 0; i < STREAK_COUNT; i++) {
      const s = seeds[i];
      // Position along the wind direction wraps every 2*RADIUS metres
      const along = ((s.offset + t * STREAK_SPEED) % (STREAK_RADIUS * 2)) - STREAK_RADIUS;
      const x = bikeState.x + wind.x * along + lateralX * s.lateral;
      const z = bikeState.z + wind.y * along + lateralZ * s.lateral;
      dummy.position.set(x, s.height, z);
      dummy.rotation.set(0, angle, 0);
      dummy.scale.set(s.length, 1, 1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[geom, mat, STREAK_COUNT]}
      frustumCulled={false}
      renderOrder={2}
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
export default function Decorations({ dayRef }) {
  return (
    <group>
      {/* Bruno-Simon-style infinity grass — follows the player */}
      <GrassField dayRef={dayRef} />

      {/* Drifting cloud shadows on the meadow */}
      <CloudShadows dayRef={dayRef} />

      {/* White wind streaks drifting through the air */}
      <WindStreaks />

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
