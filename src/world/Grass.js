/**
 * Grass — "Particle-Wave" Eigenkreation mit Dual-Renderer-Support.
 *
 *   WebGL:  klassisches ShaderMaterial mit GLSL (bewährter Pfad, ~250 Zeilen)
 *   WebGPU: MeshBasicNodeMaterial mit TSL (Three Shading Language)
 *
 * Konzept (beide Pfade):
 *   - InstancedBufferGeometry, 1 Quad pro Spot, ~48k Spots
 *   - Per-Instance: aCenter (vec2 World-XZ) + aHash (float)
 *   - Vertex-Shader: Camera-Billboard + Wind-Wedeln + Cull-Logik
 *   - Fragment: Procedural Blade-Mask (4 versetzte Halme/Quad) + Beleuchtung
 *   - Building/Road/Map-Edge-Cull via uniform-Arrays
 *   - Sun/Ambient + Nacht-Dim + Laternen-Hotspots
 */

import * as THREE from "three";

// ─── Geometrie-Parameter ───────────────────────────────────────────────────
const GRID = 220;
const SIZE = 110;
const COUNT = GRID * GRID;
const SPACING = SIZE / GRID;
const SPOT_SIZE = SPACING * 0.9;
const VIEW_RADIUS = 45;
const VIEW_FADE = 12;
const MAP_RADIUS = 46;
const MAP_FADE = 4;

// ─── Wind-Defaults ─────────────────────────────────────────────────────────
const WIND_DIR_X = 0.7;
const WIND_DIR_Z = 0.3;
const WIND_SPEED = 0.6;
const WIND_STRENGTH = 0.25;

// ═══════════════════════════════════════════════════════════════════════════
// WebGL-Pfad: klassisches ShaderMaterial mit GLSL
// ═══════════════════════════════════════════════════════════════════════════

const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform vec2  uViewCenter;
  uniform float uViewRadius;
  uniform float uViewFade;
  uniform float uTerrainY;
  uniform vec3  uBikePos;
  uniform vec2  uWindDir;
  uniform float uWindSpeed;
  uniform float uWindStrength;

  uniform vec3 uBuildings[5];
  uniform vec2 uRoad[64];
  uniform float uRoadRadiusSq;
  uniform float uMapRadius;
  uniform float uMapFade;

  attribute vec2 aCenter;
  attribute float aHash;

  varying vec2  vQuadUv;
  varying float vHash;
  varying float vDistance;
  varying float vTrailWeight;
  varying float vCulled;
  varying vec2  vWorldXZ;

  void main() {
    vec3 pos = position;
    vQuadUv = pos.xy;
    vHash = aHash;
    vWorldXZ = aCenter;

    vec3 quadWorld = vec3(aCenter.x, uTerrainY, aCenter.y);

    vec2 toView = aCenter - uViewCenter;
    float distView = length(toView);
    vDistance = distView;
    float vis = 1.0 - smoothstep(uViewRadius - uViewFade, uViewRadius, distView);
    float lodScale = mix(0.65, 1.0, vis);

    vec3 right = vec3(modelViewMatrix[0][0], 0.0, modelViewMatrix[2][0]);
    right = normalize(right);
    vec3 up = vec3(0.0, 1.0, 0.0);

    float spotSize = float(${SPOT_SIZE}) * lodScale;

    vec3 offset = right * pos.x * spotSize
                + up    * (pos.y + 0.5) * spotSize;

    vec3 worldPos = quadWorld + offset;

    float windPhase = dot(aCenter, uWindDir) * 0.08 + uTime * uWindSpeed;
    float bend = sin(windPhase) * 0.6
               + sin(windPhase * 1.7 + aHash * 6.28) * 0.18;
    float bendStrength = pos.y + 0.5;
    worldPos.x += uWindDir.x * bend * bendStrength * spotSize * uWindStrength;
    worldPos.z += uWindDir.y * bend * bendStrength * spotSize * uWindStrength;

    float bikeDist = length(aCenter - uBikePos.xz);
    vTrailWeight = 1.0 - smoothstep(0.0, 4.0, bikeDist);

    vCulled = 0.0;
    if (vis < 0.01) vCulled = 1.0;

    for (int i = 0; i < 5; i++) {
      vec3 b = uBuildings[i];
      float dx = b.x - aCenter.x;
      float dz = b.y - aCenter.y;
      if (dx * dx + dz * dz < b.z) vCulled = 1.0;
    }
    for (int i = 0; i < 64; i++) {
      vec2 r = uRoad[i];
      float dx = r.x - aCenter.x;
      float dz = r.y - aCenter.y;
      if (dx * dx + dz * dz < uRoadRadiusSq) vCulled = 1.0;
    }

    float mapDist = length(aCenter);
    if (mapDist > uMapRadius) vCulled = 1.0;

    if (vCulled > 0.5) {
      worldPos.y -= spotSize * 3.0;
    }

    gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uSunIntensity;
  uniform vec3  uAmbient;
  uniform float uNightFactor;
  uniform int   uLampCount;
  uniform vec3  uLampPos[12];
  uniform float uLampRange;

  varying vec2  vQuadUv;
  varying float vHash;
  varying float vDistance;
  varying float vTrailWeight;
  varying float vCulled;
  varying vec2  vWorldXZ;

  float singleBlade(vec2 uv, float centerX, float curveDir, float widthBase, float heightLimit) {
    float y = uv.y + 0.5;
    if (y < 0.0 || y > heightLimit) return 0.0;
    float yn = y / heightLimit;
    float curveOffset = centerX + sin(yn * 3.14159 * 0.5) * 0.06 * curveDir;
    float widthAtY = widthBase * (1.0 - smoothstep(0.0, 1.0, yn) * 0.85);
    float tipRound = 1.0 - smoothstep(0.85, 1.0, yn);
    widthAtY *= mix(1.0, tipRound, smoothstep(0.7, 1.0, yn));
    float dx = abs(uv.x - curveOffset);
    return (1.0 - smoothstep(0.0, widthAtY, dx)) * step(dx, widthAtY * 1.5);
  }

  float bladeMask(vec2 uv, float hash) {
    float h2 = fract(hash * 7.31);
    float h3 = fract(hash * 13.79);
    float h4 = fract(hash * 21.13);
    float m1 = singleBlade(uv, 0.0,                     1.0,                0.085, 0.95);
    float m2 = singleBlade(uv, -0.13 - h2 * 0.04,      -0.6 + h2 * 0.6,    0.065, 0.72);
    float m3 = singleBlade(uv,  0.12 + h3 * 0.05,       0.6 - h3 * 0.6,    0.065, 0.78);
    float m4 = singleBlade(uv, -0.04 + h4 * 0.08,      (h4 - 0.5) * 1.4,   0.05,  0.55);
    return max(max(m1, m2), max(m3, m4));
  }

  void main() {
    if (vCulled > 0.5) discard;
    float alpha = bladeMask(vQuadUv, vHash);
    if (alpha < 0.5) discard;

    float vRel = (vQuadUv.y + 0.5);
    vec3 colDark  = vec3(0.16, 0.26, 0.09);
    vec3 colLight = vec3(0.36, 0.54, 0.20);
    vec3 base = mix(colDark, colLight, vRel);
    base *= mix(0.85, 1.15, vHash);

    vec3 trailTint = vec3(0.62, 0.48, 0.18);
    base = mix(base, mix(base, trailTint, 0.4), vTrailWeight);

    float distFade = 1.0 - smoothstep(20.0, 30.0, vDistance);
    base = mix(vec3(0.20, 0.32, 0.12), base, distFade);

    vec3 lighting = uAmbient + vec3(uSunIntensity * 0.55);
    float nightDim = 1.0 - uNightFactor * 0.88;
    lighting *= nightDim;

    if (uLampCount > 0 && uNightFactor > 0.05) {
      vec3 lampWarm = vec3(1.0, 0.78, 0.42);
      float lampAdd = 0.0;
      vec2 wxz = vWorldXZ;
      for (int i = 0; i < 12; i++) {
        if (i >= uLampCount) break;
        vec2 lxz = uLampPos[i].xz;
        float d = length(wxz - lxz);
        float falloff = 1.0 - smoothstep(0.0, uLampRange, d);
        lampAdd += falloff * falloff * 0.65;
      }
      lampAdd = min(lampAdd, 1.4);
      lighting += lampWarm * lampAdd * uNightFactor;
    }

    vec3 col = base * lighting;
    gl_FragColor = vec4(col, 1.0);
  }
`;

// ═══════════════════════════════════════════════════════════════════════════
// Geometrie-Builder — gleich für beide Pfade
// ═══════════════════════════════════════════════════════════════════════════

function buildGrassGeometry(buildings, roadCurve) {
  const baseGeo = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = baseGeo.index;
  geo.attributes.position = baseGeo.attributes.position;
  geo.attributes.uv = baseGeo.attributes.uv;

  // Pre-compute Cull-Daten: Building-Radii, Road-Punkte.
  // Die Cull-Berechnung läuft jetzt EINMALIG hier statt pro Vertex pro Frame.
  // Ergebnis pro Halm: aCulled = 1 wenn permanent versteckt, 0 wenn sichtbar.
  const RADII = { HQ: 8, HAW: 11, Yek: 8, THG: 15, Designa: 10 };
  const buildingChecks = [];
  for (let i = 0; i < 5; i++) {
    const b = buildings?.[i];
    if (b) {
      const r = RADII[b.id] ?? 7;
      buildingChecks.push({ x: b.position[0], z: b.position[2], r2: r * r });
    }
  }
  const roadPoints = [];
  if (roadCurve) {
    const s = roadCurve.getSpacedPoints(63);
    for (let i = 0; i < 64; i++) roadPoints.push({ x: s[i].x, z: s[i].z });
  }
  const ROAD_R2 = 3.0 * 3.0;
  const MAP_R2 = MAP_RADIUS * MAP_RADIUS;

  const centers = new Float32Array(COUNT * 2);
  const hashes  = new Float32Array(COUNT);
  const culled  = new Float32Array(COUNT);

  let idx = 0;
  let cullCount = 0;
  for (let iX = 0; iX < GRID; iX++) {
    const fragmentX = (iX / GRID - 0.5) * SIZE + SPACING * 0.5;
    for (let iZ = 0; iZ < GRID; iZ++) {
      const fragmentZ = (iZ / GRID - 0.5) * SIZE + SPACING * 0.5;
      const cx = fragmentX + (Math.random() - 0.5) * SPACING * 0.7;
      const cz = fragmentZ + (Math.random() - 0.5) * SPACING * 0.7;
      centers[idx * 2 + 0] = cx;
      centers[idx * 2 + 1] = cz;
      hashes[idx] = Math.random();

      // Cull-Check
      let isCulled = 0;

      // Map-Radius (außerhalb Insel)
      if (cx * cx + cz * cz > MAP_R2) isCulled = 1;

      // Building-Check
      if (!isCulled) {
        for (let bi = 0; bi < buildingChecks.length; bi++) {
          const b = buildingChecks[bi];
          const dx = b.x - cx;
          const dz = b.z - cz;
          if (dx * dx + dz * dz < b.r2) { isCulled = 1; break; }
        }
      }

      // Road-Check
      if (!isCulled) {
        for (let ri = 0; ri < roadPoints.length; ri++) {
          const r = roadPoints[ri];
          const dx = r.x - cx;
          const dz = r.z - cz;
          if (dx * dx + dz * dz < ROAD_R2) { isCulled = 1; break; }
        }
      }

      culled[idx] = isCulled;
      if (isCulled) cullCount++;
      idx++;
    }
  }

  geo.setAttribute("aCenter", new THREE.InstancedBufferAttribute(centers, 2));
  geo.setAttribute("aHash",   new THREE.InstancedBufferAttribute(hashes, 1));
  geo.setAttribute("aCulled", new THREE.InstancedBufferAttribute(culled, 1));
  geo.instanceCount = COUNT;
  console.log(`[Grass] geometry built — ${COUNT} quads (${cullCount} pre-culled, ${COUNT - cullCount} visible)`);
  return geo;
}

// ═══════════════════════════════════════════════════════════════════════════
// WebGL-Material-Factory
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

function buildGrassMaterialGLSL(buildings, roadCurve) {
  const buildingsArr = buildBuildingArr(buildings);
  const roadArr = buildRoadArr(roadCurve);

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    side: THREE.DoubleSide,
    transparent: false,
    uniforms: {
      uTime:         { value: 0 },
      uViewCenter:   { value: new THREE.Vector2() },
      uViewRadius:   { value: VIEW_RADIUS },
      uViewFade:     { value: VIEW_FADE },
      uTerrainY:     { value: 0.3 },
      uBikePos:      { value: new THREE.Vector3() },
      uWindDir:      { value: new THREE.Vector2(WIND_DIR_X, WIND_DIR_Z).normalize() },
      uWindSpeed:    { value: WIND_SPEED },
      uWindStrength: { value: WIND_STRENGTH },
      uBuildings:    { value: buildingsArr },
      uRoad:         { value: roadArr },
      uRoadRadiusSq: { value: 3.0 * 3.0 },
      uMapRadius:    { value: MAP_RADIUS },
      uMapFade:      { value: MAP_FADE },
      uSunIntensity: { value: 1.0 },
      uAmbient:      { value: new THREE.Color(0x445566) },
      uNightFactor:  { value: 0.0 },
      uLampCount:    { value: 0 },
      uLampPos:      { value: Array.from({ length: 12 }, () => new THREE.Vector3()) },
      uLampRange:    { value: 7.0 },
    },
  });

  // Adapter — gemeinsame API zwischen GLSL- und TSL-Material.
  material.userData.adapter = {
    setTime:        (t) => { material.uniforms.uTime.value = t; },
    setViewCenter:  (cx, cz) => material.uniforms.uViewCenter.value.set(cx, cz),
    setViewRadius:  (v) => { material.uniforms.uViewRadius.value = v; },
    setMapRadius:   (v) => { material.uniforms.uMapRadius.value = v; },
    setTerrainY:    (v) => { material.uniforms.uTerrainY.value = v; },
    setBikePos:     (x, z) => material.uniforms.uBikePos.value.set(x, 0, z),
    setWind:        (dir, speed, strength) => {
      material.uniforms.uWindDir.value.copy(dir);
      material.uniforms.uWindSpeed.value = speed;
      material.uniforms.uWindStrength.value = strength;
    },
    setSun:         (intensity, ambientColor, ambientIntensity) => {
      material.uniforms.uSunIntensity.value = intensity;
      material.uniforms.uAmbient.value.copy(ambientColor).multiplyScalar(ambientIntensity);
    },
    setNightFactor: (n) => { material.uniforms.uNightFactor.value = n; },
    setLamps:       (positions) => {
      const arr = material.uniforms.uLampPos.value;
      const n = Math.min(positions.length, 12);
      for (let i = 0; i < n; i++) arr[i].copy(positions[i]);
      material.uniforms.uLampCount.value = n;
    },
  };

  return material;
}

// ═══════════════════════════════════════════════════════════════════════════
// WebGPU/TSL-Material-Factory
// ═══════════════════════════════════════════════════════════════════════════

async function buildGrassMaterialTSL() {
  const webgpu = await import("three/webgpu");
  const tsl = await import("three/tsl");
  const {
    Fn, If, Loop, uniform, uniformArray, attribute, varying,
    vec2, vec3, vec4, float,
    sin, dot, mix, smoothstep, clamp, max, min, abs, length, fract, normalize, step,
    positionLocal, cameraPosition,
    Discard,
  } = tsl;
  const { MeshBasicNodeMaterial } = webgpu;

  // ─── Uniforms ───
  const uTime         = uniform(0);
  const uViewCenter   = uniform(new THREE.Vector2());
  const uViewRadius   = uniform(VIEW_RADIUS);
  const uViewFade     = uniform(VIEW_FADE);
  const uTerrainY     = uniform(0.3);
  const uBikePos      = uniform(new THREE.Vector3());
  const uWindDir      = uniform(new THREE.Vector2(WIND_DIR_X, WIND_DIR_Z).normalize());
  const uWindSpeed    = uniform(WIND_SPEED);
  const uWindStrength = uniform(WIND_STRENGTH);
  const uMapRadius    = uniform(MAP_RADIUS);
  const uSunIntensity = uniform(1.0);
  const uAmbient      = uniform(new THREE.Color(0x445566));
  const uNightFactor  = uniform(0);
  const uLampRange    = uniform(7.0);
  const uLampCount    = uniform(0);

  // Lamp-Positions als uniformArray. Default-Positionen weit weg damit
  // ungenutzte Slots im (jetzt voll-unrolled) Lamp-Loop automatisch durch
  // den falloff-Clamp aus dem Beleuchtungs-Ergebnis fallen.
  const FAR_AWAY = 99999;
  const lampArr = Array.from({ length: 12 }, () =>
    new THREE.Vector3(FAR_AWAY, FAR_AWAY, FAR_AWAY),
  );
  const uLampPos = uniformArray(lampArr, "vec3");

  // ─── Material ───
  const material = new MeshBasicNodeMaterial({
    side: THREE.DoubleSide,
    transparent: false,
  });

  // Varying: Quad-UV (positionLocal) → Fragment
  // TSL's positionLocal im Fragment ist NICHT zuverlässig — wir nutzen
  // explizites varying() um es vom Vertex zum Fragment zu bringen.
  const vQuadUv = varying(vec2(0, 0), "vQuadUv");

  // ─── positionNode mit Camera-Billboard + Wind + Cull ───
  material.positionNode = Fn(() => {
    const aCenter = attribute("aCenter", "vec2");
    const aHash   = attribute("aHash",   "float");
    const local   = positionLocal.toVar();

    // Varying setzen
    vQuadUv.assign(vec2(local.x, local.y));

    // Welt-Anker am Boden
    const anchorWorld = vec3(aCenter.x, uTerrainY, aCenter.y).toVar();

    // View-Distance + LOD-Scale
    const distView = length(aCenter.sub(uViewCenter));
    const vis = float(1).sub(smoothstep(uViewRadius.sub(uViewFade), uViewRadius, distView));
    const lodScale = mix(float(0.65), float(1.0), vis);
    const sz = float(SPOT_SIZE).mul(lodScale).toVar();

    // Camera-Billboard
    const toCam = cameraPosition.sub(anchorWorld);
    const camHor = normalize(vec3(toCam.x, 0, toCam.z));
    const right = vec3(camHor.z, 0, camHor.x.negate());
    const up = vec3(0, 1, 0);

    const offset = right.mul(local.x).mul(sz)
      .add(up.mul(local.y.add(0.5)).mul(sz));

    const worldPos = anchorWorld.add(offset).toVar();

    // ─── Wind-Wedeln ───
    // Wind-Welle wandert in Windrichtung über die Welt, mit Phasen-Variation
    // pro Quad damit es nicht synchron aussieht. Nur die Spitze (positives y)
    // wird ausgelenkt — Wurzel bleibt stehen.
    const windPhase = dot(aCenter, uWindDir).mul(0.08).add(uTime.mul(uWindSpeed));
    const bend = sin(windPhase).mul(0.6)
      .add(sin(windPhase.mul(1.7).add(aHash.mul(6.28))).mul(0.18));
    const bendStrength = local.y.add(0.5);   // 0 unten, 1 oben
    worldPos.x.addAssign(uWindDir.x.mul(bend).mul(bendStrength).mul(sz).mul(uWindStrength));
    worldPos.z.addAssign(uWindDir.y.mul(bend).mul(bendStrength).mul(sz).mul(uWindStrength));

    // ─── Cull-Logik (pre-computed) ───
    // aCulled wurde beim Geometry-Build EINMALIG berechnet — kein per-Frame
    // Loop mehr. Spart 18M Distance-Tests/Frame.
    const aCulled = attribute("aCulled", "float");
    const culled = aCulled.toVar();

    // Nur View-Radius bleibt dynamisch (Camera bewegt sich)
    If(vis.lessThan(0.01), () => { culled.assign(1); });

    If(culled.greaterThan(0.5), () => {
      worldPos.y.subAssign(float(20));
    });

    return worldPos;
  })();

  // ─── Blade-Mask ───
  // 3 versetzte S-Kurven-Halme pro Quad. Jeder Halm:
  //   - center-X via Hash variiert
  //   - heightLimit via Hash variiert (kleiner-mittel-höher)
  //   - S-Krümmung via Hash-Direction
  //   - Smooth-Ramp statt harter Kante
  const singleBlade = Fn(([uvIn, cx, curveDir, heightLimit]) => {
    const y01 = uvIn.y.add(0.5);   // 0..1

    // y muss < heightLimit sein, sonst kein Halm
    const yMask = step(y01, heightLimit);

    // Normalisierte Y innerhalb des Halms (0..1)
    const yn = y01.div(heightLimit);

    // S-Krümmung
    const curveOff = sin(yn.mul(3.14159).mul(0.5)).mul(0.06).mul(curveDir);

    // Halm-Breite — linear runter von 0.07 (unten) zu 0.012 (oben)
    const widthAtY = float(0.07).sub(yn.mul(0.058));

    // Distance zum Halm-Center
    const dx = abs(uvIn.x.sub(cx).sub(curveOff));

    // Soft-Kontur — konstante Edges 0..1, Skalierung über dx-widthAtY
    // Wenn dx < widthAtY → inside=1 (im Halm)
    // Wenn dx > widthAtY → smooth fade zu 0 über 0.01 World-Units
    const inside = float(1).sub(smoothstep(0, 0.012, dx.sub(widthAtY)));

    return inside.mul(yMask);
  });

  const bladeMask = Fn(([uvIn, hash]) => {
    const h2 = fract(hash.mul(7.31));
    const h3 = fract(hash.mul(13.79));

    // 3 Halme mit unterschiedlicher Höhe und Position
    const m1 = singleBlade(uvIn, float(0.0),                       float(1.0),                  float(0.95));   // Mittlerer hoher Halm
    const m2 = singleBlade(uvIn, h2.mul(0.08).sub(0.14),           h2.mul(1.2).sub(0.6),        float(0.72));   // Links niedriger
    const m3 = singleBlade(uvIn, h3.mul(0.08).add(0.06),           h3.mul(-1.2).add(0.6),       float(0.78));   // Rechts mittelhoch

    return max(max(m1, m2), m3);
  });

  material.colorNode = Fn(() => {
    const aCenter = attribute("aCenter", "vec2");
    const aHash   = attribute("aHash",   "float");

    // Quad-UV aus varying lesen (positionLocal funktioniert im Fragment nicht)
    const uvLocal = vQuadUv;

    // Blade-Mask — discarden wenn außerhalb des Halms
    const alpha = bladeMask(uvLocal, aHash);
    If(alpha.lessThan(0.5), () => { Discard(); });

    // Farbgradient vertikal
    const y01 = uvLocal.y.add(0.5);
    const colDark  = vec3(0.16, 0.26, 0.09);
    const colLight = vec3(0.36, 0.54, 0.20);
    const base = mix(colDark, colLight, y01).toVar();

    // Per-Instance-Variation
    base.mulAssign(mix(float(0.85), float(1.15), aHash));

    // Trail-Memory
    const bikeDist = length(aCenter.sub(vec2(uBikePos.x, uBikePos.z)));
    const trailW = float(1).sub(smoothstep(0, 4.0, bikeDist));
    const trailTint = vec3(0.62, 0.48, 0.18);
    base.assign(mix(base, mix(base, trailTint, 0.4), trailW));

    // Distance-Fade zum View-Center
    const distView = length(aCenter.sub(uViewCenter));
    const distFade = float(1).sub(smoothstep(20.0, 30.0, distView));
    base.assign(mix(vec3(0.20, 0.32, 0.12), base, distFade));

    // Beleuchtung: Ambient + Sun + Nacht-Dim
    const sunTerm = uSunIntensity.mul(0.55);
    const lighting = uAmbient.add(vec3(sunTerm, sunTerm, sunTerm)).toVar();
    const nightDim = float(1).sub(uNightFactor.mul(0.88));
    lighting.mulAssign(nightDim);

    // Lampen-Hotspots — optimiert:
    // 1) Loop fest unrolled über alle 12 Slots (kein dyn-If pro Iteration)
    // 2) lengthSq() statt length() → kein sqrt
    // 3) Ungenutzte Slots haben Lamp-Position weit weg (uLampPos default 9999),
    //    fallen automatisch raus über falloff
    const lampAdd = float(0).toVar();
    const rangeSq = uLampRange.mul(uLampRange);
    Loop({ start: 0, end: 12, type: "int" }, ({ i }) => {
      const lp = uLampPos.element(i);
      const lxz = vec2(lp.x, lp.z);
      const diff = aCenter.sub(lxz);
      const dSq = diff.dot(diff);
      const falloff = clamp(float(1).sub(dSq.div(rangeSq)), 0, 1);
      lampAdd.addAssign(falloff.mul(falloff).mul(0.65));
    });
    const lampClamped = min(lampAdd, float(1.4));
    const lampWarm = vec3(1.0, 0.78, 0.42);
    lighting.addAssign(lampWarm.mul(lampClamped).mul(uNightFactor));

    const col = base.mul(lighting);
    return vec4(col, 1);
  })();

  // ─── Adapter ───
  material.userData.adapter = {
    setTime:        (t) => { uTime.value = t; },
    setViewCenter:  (cx, cz) => uViewCenter.value.set(cx, cz),
    setViewRadius:  (v) => { uViewRadius.value = v; },
    setMapRadius:   (v) => { uMapRadius.value = v; },
    setTerrainY:    (v) => { uTerrainY.value = v; },
    setBikePos:     (x, z) => uBikePos.value.set(x, 0, z),
    setWind:        (dir, speed, strength) => {
      uWindDir.value.copy(dir);
      uWindSpeed.value = speed;
      uWindStrength.value = strength;
    },
    setSun:         (intensity, ambientColor, ambientIntensity) => {
      uSunIntensity.value = intensity;
      uAmbient.value.copy(ambientColor).multiplyScalar(ambientIntensity);
    },
    setNightFactor: (n) => { uNightFactor.value = n; },
    setLamps:       (positions) => {
      const n = Math.min(positions.length, 12);
      for (let i = 0; i < n; i++) lampArr[i].copy(positions[i]);
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

    this.geometry = buildGrassGeometry(this.buildings, this.roadCurve);

    this._raycaster = new THREE.Raycaster();
    this._raycaster.firstHitOnly = true;
    this._downDir = new THREE.Vector3(0, -1, 0);
    this._tmpOrigin = new THREE.Vector3();
    this._lampPosCached = false;
    this._lampPosScratch = Array.from({ length: 12 }, () => new THREE.Vector3());

    this._buildMaterialAndMesh();
  }

  async _buildMaterialAndMesh() {
    if (this.game?.renderer?.ready?.then) {
      try { await this.game.renderer.ready; } catch (e) {}
    }
    const mode = this.game?.renderer?.mode || "webgl";

    try {
      if (mode === "webgpu") {
        this.material = await buildGrassMaterialTSL();
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
    // BoundingSphere setzen statt frustumCulled=false. Grass deckt eine
    // begrenzte Fläche (SIZE Meter Radius) — wenn die Camera weg-schaut,
    // soll der Driver die ganze Submission skippen können. Unter WebGPU
    // spart das BindGroup-Setup pro Frame deutlich.
    this.geometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, 0, 0),
      SIZE * 0.75,
    );
    this.mesh.frustumCulled = true;
    // Grass cast't keine Shadows (würde mit dem Discard-Pattern eh nicht
    // funktionieren) — verhindert dass die 48k Instances im Shadow-Pass
    // landen. Größter WebGPU-Speedup.
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.scene.add(this.mesh);

    console.log(`[Grass] Particle-Wave (${mode}): ${COUNT} quads, global wind`);
    this._setupDebug();
  }

  _setupDebug() {
    const debug = this.game?.debug;
    if (!debug?.active || !this.material) return;
    const f = debug.addFolder({ title: "Grass", expanded: false });
    this._debugState = {
      viewRadius: VIEW_RADIUS,
      mapRadius: MAP_RADIUS,
      visible: true,
    };
    f.addBinding(this._debugState, "viewRadius", { min: 10, max: 80, step: 1 })
      .on("change", (ev) => {
        this.material.userData.adapter?.setViewRadius?.(ev.value);
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
    let bx = 0, bz = 0;
    if (player?.body) {
      const t = player.body.translation();
      bx = t.x; bz = t.z;
    }
    a.setBikePos(bx, bz);

    // View-Center
    const target = this.game.cameraRig?.controls?.target;
    let cx = 0, cz = 0;
    if (target) {
      cx = target.x; cz = target.z;
      a.setViewCenter(cx, cz);
    }

    // Terrain-Y
    if (this.terrainMesh) {
      this._tmpOrigin.set(cx, 50, cz);
      this._raycaster.set(this._tmpOrigin, this._downDir);
      const hits = this._raycaster.intersectObject(this.terrainMesh, true);
      if (hits.length > 0) a.setTerrainY(hits[0].point.y);
    }

    // Sun + nightFactor
    const dc = this.game.world?.dayCycle?.live;
    if (dc) {
      a.setSun(dc.sunIntensity, dc.ambientColor, dc.ambientIntensity);
      a.setNightFactor(dc.nightFactor ?? 0);
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
    if (this.mesh) this.scene?.remove?.(this.mesh);
    this.geometry?.dispose?.();
    this.material?.dispose?.();
  }
}
