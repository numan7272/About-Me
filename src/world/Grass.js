/**
 * Grass — Dreiecks-Halme mit Kamera-Wrap, Dual-Renderer-Support.
 *
 *   WebGL:  ShaderMaterial mit GLSL
 *   WebGPU: MeshBasicNodeMaterial mit TSL
 *
 * Technik (beide Pfade identisch):
 *   - 1 Dreieck pro Halm (Tip + 2 Basis-Ecken), KEIN Quad + Fragment-Discard
 *     mehr. Der Fragment-Shader gibt nur noch die interpolierte Vertex-Farbe
 *     aus — die gesamte Arbeit (Form, Wind, Licht, Cull) passiert pro Vertex.
 *   - Das Halm-Feld ist eine TILE×TILE-Kachel, die per Modulo-Wrap an der
 *     Kamera klebt: konstante Dichte um den Spieler, egal wo er fährt,
 *     ohne Instanz-Verwaltung oder Re-Upload.
 *   - Farbe als Vertex-Gradient: Basis dunkel, Spitze hell. Per-Halm-Hash
 *     + Patch-Noise geben Flecken-Variation wie auf einer echten Wiese.
 *   - Halme drehen sich zur Kamera (Billboard pro Halm, nicht pro Feld).
 *   - Cull (Insel-Rand, Buildings, Road) läuft im Vertex-Shader — die
 *     Kachel bewegt sich, Pre-Compute ist nicht mehr möglich. Versteckte
 *     Halme kollabieren zu Null-Flächen-Dreiecken (kostenfrei im Raster).
 *   - Manueller Fog am Halm (Scene-Fog greift nicht in ShaderMaterial) —
 *     sonst stehen bei Nacht ungefoggte Halme im gefoggten Terrain.
 */

import * as THREE from "three";

// ─── Feld-Parameter ────────────────────────────────────────────────────────
const TILE = 80;                  // Kachel-Kantenlänge (m), zentriert auf Kamera
const GRID_HIGH = 230;            // 52.9k Halme (Graphics: high)
const GRID_LOW  = 150;            // 22.5k Halme (Graphics: low)
const MAP_RADIUS = 46;
const BLADE_WIDTH  = 0.09;
const BLADE_HEIGHT = 0.7;

// ─── Wind-Defaults ─────────────────────────────────────────────────────────
const WIND_DIR_X = 0.7;
const WIND_DIR_Z = 0.3;
const WIND_SPEED = 0.6;
const WIND_STRENGTH = 0.25;

// Farben — Basis dunkel, Spitze hell (geteilt zwischen beiden Pfaden)
const COL_DARK  = [0.13, 0.23, 0.08];
const COL_LIGHT = [0.42, 0.60, 0.22];
const TRAIL_TINT = [0.62, 0.48, 0.18];

function pickGrid() {
  try {
    const raw = localStorage.getItem("numan-portfolio-settings-v1");
    if (raw && JSON.parse(raw).graphics === "low") return GRID_LOW;
  } catch (e) {}
  return GRID_HIGH;
}

// ═══════════════════════════════════════════════════════════════════════════
// WebGL-Pfad: GLSL
// ═══════════════════════════════════════════════════════════════════════════

const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform vec2  uViewCenter;
  uniform float uTerrainY;
  uniform vec3  uBikePos;
  uniform vec2  uWindDir;
  uniform float uWindSpeed;
  uniform float uWindStrength;
  uniform float uBladeWidth;
  uniform float uBladeHeight;

  uniform vec3  uBuildings[5];
  uniform vec2  uRoad[64];
  uniform float uRoadRadiusSq;
  uniform float uMapRadius;

  uniform vec2  uPressPos;
  uniform float uPressStrength;
  uniform vec2  uPressVel;

  uniform float uSunIntensity;
  uniform vec3  uAmbient;
  uniform float uNightFactor;
  uniform int   uLampCount;
  uniform vec3  uLampPos[12];
  uniform float uLampRange;

  uniform vec3  uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;

  attribute float aHash;

  varying vec3 vColor;

  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  void main() {
    // position.xy = Halm-Zentrum in Kachel-Koordinaten, position.z = Ecke
    // (0 = Spitze, 1 = Basis rechts, 2 = Basis links)
    vec2 local = position.xy;
    float corner = position.z;

    // ── Kachel-Wrap um den View-Center ──
    const float HALF = ${(TILE / 2).toFixed(1)};
    vec2 rel = mod(local - uViewCenter + HALF, ${TILE.toFixed(1)}) - HALF;
    vec2 blade = uViewCenter + rel;

    // ── Cull: Insel-Rand, Buildings, Road ──
    float hidden = 0.0;
    if (dot(blade, blade) > uMapRadius * uMapRadius) hidden = 1.0;
    for (int i = 0; i < 5; i++) {
      vec2 d = uBuildings[i].xy - blade;
      if (dot(d, d) < uBuildings[i].z) hidden = 1.0;
    }
    for (int i = 0; i < 64; i++) {
      vec2 d = uRoad[i] - blade;
      if (dot(d, d) < uRoadRadiusSq) hidden = 1.0;
    }

    // ── Form ──
    float tip = 1.0 - step(0.5, corner);             // Ecke 0 = Spitze
    float sideSign = mix(1.0, -1.0, step(1.5, corner));

    float patchN = vnoise(blade * 0.16);
    float h = uBladeHeight * (0.55 + 0.9 * aHash) * (0.62 + 0.76 * patchN);

    // Kachel-Rand: Halme sanft auf 0 schrumpfen statt harter Kante
    float edge = max(abs(rel.x), abs(rel.y)) / HALF;
    h *= 1.0 - smoothstep(0.78, 1.0, edge);

    // Druckpunkt (Cursor/Finger auf dem Boden): Halme ducken sich
    vec2 away = blade - uPressPos;
    float awayDist = length(away);
    float press = (1.0 - smoothstep(0.0, 2.4, awayDist)) * uPressStrength;
    h *= 1.0 - press * 0.5;

    // ── Kamera-Billboard pro Halm ──
    vec2 toCam = cameraPosition.xz - blade;
    float toCamLen = max(length(toCam), 0.001);
    vec2 right = vec2(-toCam.y, toCam.x) / toCamLen;

    vec2 offsetXZ = right * sideSign * uBladeWidth * (1.0 - tip);

    // ── Wind — nur die Spitze schwingt, Basis bleibt verwurzelt ──
    float phase = dot(blade, uWindDir) * 0.35 + uTime * uWindSpeed * 2.0;
    float sway = (sin(phase) + sin(phase * 1.7 + aHash * 6.2831) * 0.4)
               * uWindStrength * h * tip;
    offsetXZ += uWindDir * sway;

    // ... und legen sich in Strich-Richtung um (gekaemmt), mit leichtem
    // radialem Anteil damit auch ein stehender Finger Wirkung zeigt
    vec2 pressDir = (away / max(awayDist, 0.001)) * 0.35 + uPressVel * 0.75;
    offsetXZ += pressDir * press * 0.55 * tip;

    vec3 world = vec3(blade.x + offsetXZ.x,
                      uTerrainY + tip * h,
                      blade.y + offsetXZ.y);

    // Versteckte Halme: alle 3 Ecken auf denselben Punkt → Null-Fläche
    if (hidden > 0.5) world = vec3(0.0, -50.0, 0.0);

    // ── Farbe (per Vertex — Fragment gibt nur noch vColor aus) ──
    vec3 base = mix(vec3(${COL_DARK.join(",")}), vec3(${COL_LIGHT.join(",")}), tip);
    base *= 0.82 + 0.36 * aHash;
    base *= 0.80 + 0.40 * patchN;

    // Trail: plattgefahrenes Gras hinter dem Bike färbt sich strohig
    float bikeDist = length(blade - uBikePos.xz);
    float trail = 1.0 - smoothstep(0.0, 4.0, bikeDist);
    base = mix(base, mix(base, vec3(${TRAIL_TINT.join(",")}), 0.4), trail);

    vec3 lighting = uAmbient + vec3(uSunIntensity * 0.55);
    lighting *= 1.0 - uNightFactor * 0.88;

    if (uLampCount > 0 && uNightFactor > 0.05) {
      float lampAdd = 0.0;
      for (int i = 0; i < 12; i++) {
        if (i >= uLampCount) break;
        float d = length(blade - uLampPos[i].xz);
        float falloff = 1.0 - smoothstep(0.0, uLampRange, d);
        lampAdd += falloff * falloff * 0.65;
      }
      lighting += vec3(1.0, 0.78, 0.42) * min(lampAdd, 1.4) * uNightFactor;
    }

    vColor = base * lighting;

    // Manueller Fog — Halme müssen mit dem gefoggten Terrain verschmelzen
    float fogF = smoothstep(uFogNear, uFogFar, distance(world, cameraPosition));
    vColor = mix(vColor, uFogColor, fogF);

    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor, 1.0);
  }
`;

// ═══════════════════════════════════════════════════════════════════════════
// Geometrie-Builder — gleich für beide Pfade
// ═══════════════════════════════════════════════════════════════════════════

function buildGrassGeometry(grid) {
  const count = grid * grid;
  const spacing = TILE / grid;
  const positions = new Float32Array(count * 3 * 3);   // 3 Verts × (cx, cz, corner)
  const hashes = new Float32Array(count * 3);

  let v = 0;
  for (let iX = 0; iX < grid; iX++) {
    const fx = (iX / grid - 0.5) * TILE + spacing * 0.5;
    for (let iZ = 0; iZ < grid; iZ++) {
      const fz = (iZ / grid - 0.5) * TILE + spacing * 0.5;
      const cx = fx + (Math.random() - 0.5) * spacing;
      const cz = fz + (Math.random() - 0.5) * spacing;
      const hash = Math.random();
      for (let c = 0; c < 3; c++) {
        positions[v * 3 + 0] = cx;
        positions[v * 3 + 1] = cz;
        positions[v * 3 + 2] = c;
        hashes[v] = hash;
        v++;
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aHash", new THREE.BufferAttribute(hashes, 1));
  // Kachel folgt der Kamera — Frustum-Cull der Gesamt-Mesh ist sinnlos,
  // BoundingSphere nur für three-Interna gesetzt.
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), MAP_RADIUS + TILE);
  console.log(`[Grass] geometry built — ${count} blades (${count * 3} verts, tile ${TILE}m)`);
  return geo;
}

// ═══════════════════════════════════════════════════════════════════════════
// Uniform-Helfer
// ═══════════════════════════════════════════════════════════════════════════

function buildBuildingArr(buildings) {
  const RADII = { HQ: 8, HAW: 11, Yek: 8, THG: 15, Designa: 10 };
  const arr = [];
  for (let i = 0; i < 5; i++) {
    const b = buildings[i];
    if (b) {
      const r = RADII[b.id] ?? 7;
      arr.push(new THREE.Vector3(b.position[0], b.position[2], r * r));
    } else {
      arr.push(new THREE.Vector3(9999, 9999, 1));
    }
  }
  return arr;
}

function buildRoadArr(roadCurve) {
  const arr = [];
  if (roadCurve) {
    const s = roadCurve.getSpacedPoints(63);
    for (let i = 0; i < 64; i++) arr.push(new THREE.Vector2(s[i].x, s[i].z));
  } else {
    for (let i = 0; i < 64; i++) arr.push(new THREE.Vector2(9999, 9999));
  }
  return arr;
}

// ═══════════════════════════════════════════════════════════════════════════
// WebGL-Material-Factory
// ═══════════════════════════════════════════════════════════════════════════

function buildGrassMaterialGLSL(buildings, roadCurve) {
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    side: THREE.DoubleSide,
    transparent: false,
    uniforms: {
      uTime:         { value: 0 },
      uViewCenter:   { value: new THREE.Vector2() },
      uTerrainY:     { value: 0.3 },
      uBikePos:      { value: new THREE.Vector3() },
      uWindDir:      { value: new THREE.Vector2(WIND_DIR_X, WIND_DIR_Z).normalize() },
      uWindSpeed:    { value: WIND_SPEED },
      uWindStrength: { value: WIND_STRENGTH },
      uBladeWidth:   { value: BLADE_WIDTH },
      uBladeHeight:  { value: BLADE_HEIGHT },
      uBuildings:    { value: buildBuildingArr(buildings) },
      uRoad:         { value: buildRoadArr(roadCurve) },
      uRoadRadiusSq: { value: 3.0 * 3.0 },
      uMapRadius:    { value: MAP_RADIUS },
      uPressPos:     { value: new THREE.Vector2(9999, 9999) },
      uPressStrength:{ value: 0 },
      uPressVel:     { value: new THREE.Vector2() },
      uSunIntensity: { value: 1.0 },
      uAmbient:      { value: new THREE.Color(0x445566) },
      uNightFactor:  { value: 0.0 },
      uLampCount:    { value: 0 },
      uLampPos:      { value: Array.from({ length: 12 }, () => new THREE.Vector3()) },
      uLampRange:    { value: 7.0 },
      uFogColor:     { value: new THREE.Color(0xa8d8ff) },
      uFogNear:      { value: 60 },
      uFogFar:       { value: 200 },
    },
  });

  // Adapter — gemeinsame API zwischen GLSL- und TSL-Material.
  const u = material.uniforms;
  material.userData.adapter = {
    setTime:        (t) => { u.uTime.value = t; },
    setViewCenter:  (cx, cz) => u.uViewCenter.value.set(cx, cz),
    setMapRadius:   (v) => { u.uMapRadius.value = v; },
    setTerrainY:    (v) => { u.uTerrainY.value = v; },
    setBikePos:     (x, z) => u.uBikePos.value.set(x, 0, z),
    setBladeHeight: (v) => { u.uBladeHeight.value = v; },
    setBladeWidth:  (v) => { u.uBladeWidth.value = v; },
    setWind:        (dir, speed, strength) => {
      u.uWindDir.value.copy(dir);
      u.uWindSpeed.value = speed;
      u.uWindStrength.value = strength;
    },
    setSun:         (intensity, ambientColor, ambientIntensity) => {
      u.uSunIntensity.value = intensity;
      u.uAmbient.value.copy(ambientColor).multiplyScalar(ambientIntensity);
    },
    setNightFactor: (n) => { u.uNightFactor.value = n; },
    setPress:       (x, z, st, vx, vz) => {
      u.uPressPos.value.set(x, z);
      u.uPressStrength.value = st;
      u.uPressVel.value.set(vx || 0, vz || 0);
    },
    setFog:         (color, near, far) => {
      u.uFogColor.value.copy(color);
      u.uFogNear.value = near;
      u.uFogFar.value = far;
    },
    setLamps:       (positions) => {
      const arr = u.uLampPos.value;
      const n = Math.min(positions.length, 12);
      for (let i = 0; i < n; i++) arr[i].copy(positions[i]);
      u.uLampCount.value = n;
    },
  };

  return material;
}

// ═══════════════════════════════════════════════════════════════════════════
// WebGPU/TSL-Material-Factory
// ═══════════════════════════════════════════════════════════════════════════

async function buildGrassMaterialTSL(buildings, roadCurve) {
  const webgpu = await import("three/webgpu");
  const tsl = await import("three/tsl");
  const {
    Fn, If, Loop, uniform, uniformArray, attribute, varying,
    vec2, vec3, vec4, float,
    sin, dot, mix, smoothstep, max, length, fract, floor, step, distance,
    positionLocal, cameraPosition, Break,
  } = tsl;
  const { MeshBasicNodeMaterial } = webgpu;

  const uTime         = uniform(0);
  const uViewCenter   = uniform(new THREE.Vector2());
  const uTerrainY     = uniform(0.3);
  const uBikePos      = uniform(new THREE.Vector3());
  const uWindDir      = uniform(new THREE.Vector2(WIND_DIR_X, WIND_DIR_Z).normalize());
  const uWindSpeed    = uniform(WIND_SPEED);
  const uWindStrength = uniform(WIND_STRENGTH);
  const uBladeWidth   = uniform(BLADE_WIDTH);
  const uBladeHeight  = uniform(BLADE_HEIGHT);
  const uMapRadius    = uniform(MAP_RADIUS);
  const uRoadRadiusSq = uniform(3.0 * 3.0);
  const uPressPos     = uniform(new THREE.Vector2(9999, 9999));
  const uPressStrength = uniform(0);
  const uPressVel     = uniform(new THREE.Vector2());
  const uSunIntensity = uniform(1.0);
  const uAmbient      = uniform(new THREE.Color(0x445566));
  const uNightFactor  = uniform(0.0);
  const uLampCount    = uniform(0);
  const uLampRange    = uniform(7.0);
  const uFogColor     = uniform(new THREE.Color(0xa8d8ff));
  const uFogNear      = uniform(60);
  const uFogFar       = uniform(200);

  const buildingArr = uniformArray(buildBuildingArr(buildings));
  const roadArr     = uniformArray(buildRoadArr(roadCurve));
  // JS-seitige Referenz behalten — setLamps mutiert die Vector3 in place,
  // uniformArray pickt die Werte beim nächsten Upload auf.
  const lampValues  = Array.from({ length: 12 }, () => new THREE.Vector3());
  const lampArr     = uniformArray(lampValues);

  const hash21 = Fn(([p]) => {
    return fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));
  });
  const vnoise = Fn(([p]) => {
    const i = floor(p);
    const f = fract(p);
    const u = f.mul(f).mul(float(3).sub(f.mul(2)));
    const a = hash21(i);
    const b = hash21(i.add(vec2(1, 0)));
    const c = hash21(i.add(vec2(0, 1)));
    const d = hash21(i.add(vec2(1, 1)));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  });

  const material = new MeshBasicNodeMaterial();
  material.side = THREE.DoubleSide;
  material.fog = false;

  const vColor = varying(vec3());

  material.positionNode = Fn(() => {
    const local = positionLocal.xy;
    const corner = positionLocal.z;
    const aHash = attribute("aHash");

    // Kachel-Wrap
    const HALF = float(TILE / 2);
    const rel = local.sub(uViewCenter).add(HALF).mod(TILE).sub(HALF);
    const blade = uViewCenter.add(rel);

    // Cull
    const hidden = float(0).toVar();
    If(dot(blade, blade).greaterThan(uMapRadius.mul(uMapRadius)), () => {
      hidden.assign(1);
    });
    Loop({ start: 0, end: 5, type: "int" }, ({ i }) => {
      const b = buildingArr.element(i);
      const d = b.xy.sub(blade);
      If(dot(d, d).lessThan(b.z), () => { hidden.assign(1); });
    });
    Loop({ start: 0, end: 64, type: "int" }, ({ i }) => {
      const d = roadArr.element(i).sub(blade);
      If(dot(d, d).lessThan(uRoadRadiusSq), () => { hidden.assign(1); });
    });

    // Form
    const tip = float(1).sub(step(0.5, corner));
    const sideSign = mix(float(1), float(-1), step(1.5, corner));

    const patch = vnoise(blade.mul(0.16));
    const h = uBladeHeight
      .mul(aHash.mul(0.9).add(0.55))
      .mul(patch.mul(0.76).add(0.62))
      .toVar();

    const edge = max(rel.x.abs(), rel.y.abs()).div(HALF);
    h.mulAssign(float(1).sub(smoothstep(0.78, 1.0, edge)));

    // Druckpunkt: ducken + radial ausweichen (Spiegel des GLSL-Pfads)
    const away = blade.sub(uPressPos);
    const awayDist = length(away);
    const press = float(1).sub(smoothstep(0.0, 2.4, awayDist)).mul(uPressStrength);
    h.mulAssign(float(1).sub(press.mul(0.5)));

    // Kamera-Billboard
    const toCam = cameraPosition.xz.sub(blade);
    const toCamLen = max(length(toCam), 0.001);
    const right = vec2(toCam.y.negate(), toCam.x).div(toCamLen);

    const offsetXZ = right.mul(sideSign).mul(uBladeWidth).mul(float(1).sub(tip)).toVar();

    // Wind (nur Spitze)
    const phase = dot(blade, uWindDir).mul(0.35).add(uTime.mul(uWindSpeed).mul(2.0));
    const sway = sin(phase)
      .add(sin(phase.mul(1.7).add(aHash.mul(6.2831))).mul(0.4))
      .mul(uWindStrength).mul(h).mul(tip);
    offsetXZ.addAssign(uWindDir.mul(sway));
    const pressDir = away.div(max(awayDist, 0.001)).mul(0.35).add(uPressVel.mul(0.75));
    offsetXZ.addAssign(pressDir.mul(press).mul(0.55).mul(tip));

    const world = vec3(
      blade.x.add(offsetXZ.x),
      uTerrainY.add(tip.mul(h)),
      blade.y.add(offsetXZ.y),
    ).toVar();
    If(hidden.greaterThan(0.5), () => {
      world.assign(vec3(0, -50, 0));
    });

    // Farbe per Vertex
    const base = mix(vec3(...COL_DARK), vec3(...COL_LIGHT), tip).toVar();
    base.mulAssign(aHash.mul(0.36).add(0.82));
    base.mulAssign(patch.mul(0.40).add(0.80));

    const bikeDist = length(blade.sub(uBikePos.xz));
    const trail = float(1).sub(smoothstep(0.0, 4.0, bikeDist));
    base.assign(mix(base, mix(base, vec3(...TRAIL_TINT), 0.4), trail));

    const lighting = uAmbient.add(vec3(uSunIntensity.mul(0.55))).toVar();
    lighting.mulAssign(float(1).sub(uNightFactor.mul(0.88)));

    If(uNightFactor.greaterThan(0.05), () => {
      const lampAdd = float(0).toVar();
      Loop({ start: 0, end: 12, type: "int" }, ({ i }) => {
        If(i.toFloat().greaterThanEqual(uLampCount), () => { Break(); });
        const d = length(blade.sub(lampArr.element(i).xz));
        const falloff = float(1).sub(smoothstep(0.0, uLampRange, d));
        lampAdd.addAssign(falloff.mul(falloff).mul(0.65));
      });
      lighting.addAssign(vec3(1.0, 0.78, 0.42).mul(lampAdd.min(1.4)).mul(uNightFactor));
    });

    vColor.assign(base.mul(lighting));

    // Manueller Fog
    const fogF = smoothstep(uFogNear, uFogFar, distance(world, cameraPosition));
    vColor.assign(mix(vColor, uFogColor, fogF));

    return world;
  })();

  material.colorNode = Fn(() => {
    return vec4(vColor, 1);
  })();

  material.userData.adapter = {
    setTime:        (t) => { uTime.value = t; },
    setViewCenter:  (cx, cz) => uViewCenter.value.set(cx, cz),
    setMapRadius:   (v) => { uMapRadius.value = v; },
    setTerrainY:    (v) => { uTerrainY.value = v; },
    setBikePos:     (x, z) => uBikePos.value.set(x, 0, z),
    setBladeHeight: (v) => { uBladeHeight.value = v; },
    setBladeWidth:  (v) => { uBladeWidth.value = v; },
    setWind:        (dir, speed, strength) => {
      uWindDir.value.copy(dir);
      uWindSpeed.value = speed;
      uWindStrength.value = strength;
    },
    setSun:         (intensity, ambientColor, ambientIntensity) => {
      uAmbient.value.copy(ambientColor).multiplyScalar(ambientIntensity);
      uSunIntensity.value = intensity;
    },
    setNightFactor: (n) => { uNightFactor.value = n; },
    setPress:       (x, z, st, vx, vz) => {
      uPressPos.value.set(x, z);
      uPressStrength.value = st;
      uPressVel.value.set(vx || 0, vz || 0);
    },
    setFog:         (color, near, far) => {
      uFogColor.value.copy(color);
      uFogNear.value = near;
      uFogFar.value = far;
    },
    setLamps:       (positions) => {
      const n = Math.min(positions.length, 12);
      for (let i = 0; i < n; i++) lampValues[i].copy(positions[i]);
      uLampCount.value = n;
    },
  };

  return material;
}

// ═══════════════════════════════════════════════════════════════════════════
// Grass-Klasse
// ═══════════════════════════════════════════════════════════════════════════

export class Grass {
  constructor(game, terrainMesh, buildings, roadCurve) {
    this.game = game;
    this.scene = game.scene;
    this.terrainMesh = terrainMesh;
    this.buildings = buildings || [];
    this.roadCurve = roadCurve || null;

    // Dichte hängt am Graphics-Setting (greift beim nächsten Load —
    // Pixel-Ratio/Schatten schalten live, die Halm-Zahl nicht).
    this.geometry = buildGrassGeometry(pickGrid());

    this._raycaster = new THREE.Raycaster();
    this._raycaster.firstHitOnly = true;
    this._downDir = new THREE.Vector3(0, -1, 0);
    this._tmpOrigin = new THREE.Vector3();
    this._lampPosCached = false;
    this._lampPosScratch = Array.from({ length: 12 }, () => new THREE.Vector3());
    this._lastTerrainSample = new THREE.Vector2(Infinity, Infinity);
    this._lastTerrainY = 0.3;

    // ── Druckpunkt: Cursor/Finger biegt das Gras ──
    // Pointer-NDC tracken, in update() auf die Boden-Ebene projizieren
    // (reine Mathematik, kein Mesh-Raycast). Stärke schwingt weich ein
    // und klingt nach der letzten Bewegung wieder ab.
    this._pointerNdc = new THREE.Vector2(0, 0);
    this._pointerMovedAt = 0;
    this._pressStrength = 0;
    this._pressLast = new THREE.Vector2(9999, 9999);
    this._pressVel = new THREE.Vector2();
    this._unproj = new THREE.Vector3();
    this._reducedMotion = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    this._onPointerMove = (e) => {
      this._pointerNdc.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1,
      );
      this._pointerMovedAt = performance.now();
    };
    if (!this._reducedMotion) {
      window.addEventListener("pointermove", this._onPointerMove, { passive: true });
    }

    this._buildMaterialAndMesh();
  }

  async _buildMaterialAndMesh() {
    if (this.game?.renderer?.ready?.then) {
      try { await this.game.renderer.ready; } catch (e) {}
    }
    const mode = this.game?.renderer?.mode || "webgl";

    try {
      if (mode === "webgpu") {
        this.material = await buildGrassMaterialTSL(this.buildings, this.roadCurve);
      } else {
        this.material = buildGrassMaterialGLSL(this.buildings, this.roadCurve);
      }
    } catch (e) {
      console.error("[Grass] material build failed:", e);
      if (mode === "webgpu") {
        // Kein sinnvoller WebGPU-Fallback — Preference auf WebGL umstellen
        try {
          const KEY = "numan-portfolio-settings-v1";
          const raw = localStorage.getItem(KEY);
          const p = raw ? JSON.parse(raw) : {};
          p.renderer = "webgl";
          localStorage.setItem(KEY, JSON.stringify(p));
        } catch (_e) {}
        return;
      }
      this.material = buildGrassMaterialGLSL(this.buildings, this.roadCurve);
    }

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    // Kachel klebt an der Kamera — Frustum-Cull würde nur falsch greifen.
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.scene.add(this.mesh);

    console.log(`[Grass] triangle blades (${mode}), tile follows camera`);
    this._setupDebug();
  }

  _setupDebug() {
    const debug = this.game?.debug;
    if (!debug?.active || !this.material) return;
    const f = debug.addFolder({ title: "Grass", expanded: false });
    this._debugState = {
      bladeHeight: BLADE_HEIGHT,
      bladeWidth: BLADE_WIDTH,
      mapRadius: MAP_RADIUS,
      visible: true,
    };
    f.addBinding(this._debugState, "bladeHeight", { min: 0.2, max: 2, step: 0.01 })
      .on("change", (ev) => {
        this.material.userData.adapter?.setBladeHeight?.(ev.value);
      });
    f.addBinding(this._debugState, "bladeWidth", { min: 0.02, max: 0.4, step: 0.005 })
      .on("change", (ev) => {
        this.material.userData.adapter?.setBladeWidth?.(ev.value);
      });
    f.addBinding(this._debugState, "mapRadius", { min: 20, max: 80, step: 1 })
      .on("change", (ev) => {
        this.material.userData.adapter?.setMapRadius?.(ev.value);
      });
    f.addBinding(this._debugState, "visible")
      .on("change", (ev) => {
        if (this.mesh) this.mesh.visible = ev.value;
      });
  }

  update() {
    if (!this.material) return;
    const a = this.material.userData.adapter;
    if (!a) return;

    a.setTime(this.game.time.elapsed);

    // Wind-Singleton
    const wind = this.game.world?.wind;
    if (wind) {
      a.setWind(wind.direction, wind.speed, wind.strength);
    }

    // Bike-Position
    const player = this.game.world?.player;
    if (player?.body) {
      const t = player.body.translation();
      a.setBikePos(t.x, t.z);
    }

    // View-Center — Kachel folgt dem Kamera-Target
    const target = this.game.cameraRig?.controls?.target;
    let cx = 0, cz = 0;
    if (target) {
      cx = target.x; cz = target.z;
      a.setViewCenter(cx, cz);
    }

    // Terrain-Y — Raycast nur wenn die Kamera >2m gewandert ist
    if (this.terrainMesh) {
      const moved = Math.hypot(
        cx - this._lastTerrainSample.x,
        cz - this._lastTerrainSample.y,
      );
      if (moved > 2) {
        this._tmpOrigin.set(cx, 50, cz);
        this._raycaster.set(this._tmpOrigin, this._downDir);
        const hits = this._raycaster.intersectObject(this.terrainMesh, true);
        if (hits.length > 0) {
          this._lastTerrainY = hits[0].point.y;
          a.setTerrainY(this._lastTerrainY);
        }
        this._lastTerrainSample.set(cx, cz);
      }
    }

    // ── Druckpunkt aktualisieren ──
    // Pointer-Ray gegen die Gras-Ebene (y = terrainY) schneiden — eine
    // Division statt Mesh-Raycast. Stärke: 1 solange der Pointer sich in
    // den letzten 800ms bewegt hat, danach weicher Abfall.
    if (!this._reducedMotion && a.setPress) {
      const cam = this.game.cameraRig?.camera;
      const dt = this.game.time?.delta || 0.016;
      const fresh = (performance.now() - this._pointerMovedAt) < 800;
      const target = fresh ? 1 : 0;
      this._pressStrength += (target - this._pressStrength) * Math.min(1, dt * 6);
      if (cam && this._pressStrength > 0.01) {
        this._unproj.set(this._pointerNdc.x, this._pointerNdc.y, 0.5)
          .unproject(cam)
          .sub(cam.position)
          .normalize();
        const dy = this._unproj.y;
        if (dy < -0.05) {
          const t = (this._lastTerrainY - cam.position.y) / dy;
          if (t > 0 && t < 150) {
            const px = cam.position.x + this._unproj.x * t;
            const pz = cam.position.z + this._unproj.z * t;
            // Strich-Richtung: Bewegung des Bodenpunkts, geglaettet und
            // auf Einheitslaenge gedeckelt (sonst peitscht ein schneller
            // Wisch die Halme flach)
            if (this._pressLast.x < 9000) {
              const ivx = (px - this._pressLast.x) / Math.max(dt, 0.001) * 0.12;
              const ivz = (pz - this._pressLast.y) / Math.max(dt, 0.001) * 0.12;
              this._pressVel.x += (ivx - this._pressVel.x) * Math.min(1, dt * 10);
              this._pressVel.y += (ivz - this._pressVel.y) * Math.min(1, dt * 10);
              const m = this._pressVel.length();
              if (m > 1) this._pressVel.multiplyScalar(1 / m);
            }
            this._pressLast.set(px, pz);
            a.setPress(px, pz, this._pressStrength, this._pressVel.x, this._pressVel.y);
          }
        }
      } else {
        this._pressLast.set(9999, 9999);
        this._pressVel.multiplyScalar(0.9);
        a.setPress(9999, 9999, 0);
      }
    }

    // Sun + nightFactor + Fog
    const dc = this.game.world?.dayCycle?.live;
    if (dc) {
      a.setSun(dc.sunIntensity, dc.ambientColor, dc.ambientIntensity);
      a.setNightFactor(dc.nightFactor ?? 0);
      a.setFog(dc.fogColor, dc.fogNear, dc.fogFar);
    }

    // Laternen (einmalig cachen)
    const placements = this.game.world?.streetLamps?.placements;
    if (placements?.length && !this._lampPosCached) {
      const n = Math.min(placements.length, 12);
      for (let i = 0; i < n; i++) {
        const p = placements[i].position;
        this._lampPosScratch[i].set(p[0], p[1] + 3.68, p[2]);
      }
      a.setLamps(this._lampPosScratch.slice(0, n));
      this._lampPosCached = true;
    }
  }

  destroy() {
    window.removeEventListener("pointermove", this._onPointerMove);
    if (this.mesh) this.scene?.remove?.(this.mesh);
    this.geometry?.dispose?.();
    this.material?.dispose?.();
  }
}
