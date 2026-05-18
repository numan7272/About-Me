/**
 * Ocean — stilisiertes Cartoon-Wasser im Bruno-Simon-Stil.
 *
 * Dual-Renderer-Support:
 *   - WebGL:  klassisches THREE.ShaderMaterial mit GLSL (bewährter Pfad)
 *   - WebGPU: THREE.MeshBasicNodeMaterial mit TSL (Three Shading Language)
 *
 * Optisch sollen beide Pfade identisch sein. Die Material-Erzeugung schaut
 * `game.renderer.mode` an und wählt entsprechend. Wenn der Renderer noch
 * nicht initialisiert ist, wird der WebGL-Pfad genommen (kompatibel mit
 * MeshBasicNodeMaterial-Toleranz: NodeMaterial läuft auch unter WebGL).
 *
 * Konzept (beide Pfade identisch):
 *   1. Tiefen-Gradient: shallow → mid → deep (3 Farbstufen)
 *   2. Shoreline-Foam: zwei gescrollte FBM-Noise-Layer multipliziert
 *   3. Offshore-Caustics: dritter Noise-Layer
 *   4. Strand-Schaum-Linie an der Wasser-Sand-Kante
 *   5. Tag/Nacht-Anpassung via nightFactor
 */

import * as THREE from "three";

const SIZE = 2400;
// 60 statt 120 Segments — Wave-Amplitude ist so klein (0.025) dass man die
// halbierte Geometrie-Dichte optisch nicht erkennt. Halbiert Vertex-Last.
const SEGMENTS = 60;
const Y = -0.3;
const SHORE_RADIUS = 48;

// Farben — geteilt zwischen beiden Pfaden
const COLOR_DEEP    = 0x1a3b6a;
const COLOR_MID     = 0x1a6694;
const COLOR_SHALLOW = 0x6bd1d1;
const COLOR_FOAM    = 0xe8faff;

// ═══════════════════════════════════════════════════════════════════════════
// WebGL-Pfad: klassisches ShaderMaterial mit GLSL
// ═══════════════════════════════════════════════════════════════════════════

const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorldPos;

  void main() {
    vec3 pos = position;
    float w = sin(pos.x * 0.10 + uTime * 0.5) * 0.025
            + sin(pos.y * 0.13 - uTime * 0.4) * 0.020;
    pos.z += w;
    vec4 mPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = mPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * mPos;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform vec3  uColorDeep;
  uniform vec3  uColorMid;
  uniform vec3  uColorShallow;
  uniform vec3  uColorFoam;
  uniform float uShoreRadius;
  uniform float uNightFactor;
  varying vec3 vWorldPos;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i + vec2(0.0, 0.0));
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += a * vnoise(p);
      p *= 2.05;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 wxz = vWorldPos.xz;
    float distToCenter = length(wxz);
    float distToShore = distToCenter - uShoreRadius;

    float midMix  = smoothstep(0.0,   24.0,  distToShore);
    float deepMix = smoothstep(40.0,  180.0, distToShore);
    vec3 col = mix(uColorShallow, uColorMid,  midMix);
    col      = mix(col,           uColorDeep, deepMix);

    vec2 radialDir  = (distToCenter > 0.001) ? wxz / distToCenter : vec2(1.0, 0.0);
    vec2 tangentDir = vec2(-radialDir.y, radialDir.x);

    vec2 foamUv1 = wxz * 0.12 + tangentDir * uTime * 0.55;
    vec2 foamUv2 = wxz * 0.26 - tangentDir * uTime * 0.32;
    float n1 = fbm(foamUv1);
    float n2 = fbm(foamUv2);
    float foamNoise = n1 * n2 * 1.9;

    float shoreZone  = 1.0 - smoothstep(0.0, 14.0, abs(distToShore));
    float beachInner = 1.0 - smoothstep(-6.0, 0.0, distToShore);
    shoreZone = clamp(shoreZone + beachInner * 0.5, 0.0, 1.0);

    float shoreFoam = smoothstep(0.55, 0.82, foamNoise) * shoreZone;

    float edgeBand = 1.0 - smoothstep(0.0, 2.4, abs(distToShore));
    float coast    = dot(wxz, tangentDir);
    float pulse    = 0.78 + 0.22 * sin(coast * 0.55 - uTime * 1.6);
    float beachEdge = edgeBand * pulse;
    shoreFoam = max(shoreFoam, beachEdge);

    vec2 windDir = vec2(0.85, 0.53);
    vec2 caustUv = wxz * 0.09 + windDir * uTime * 0.18;
    float caustic = fbm(caustUv);
    caustic = smoothstep(0.62, 0.85, caustic) * deepMix * 0.08;

    float nightDim = 1.0 - uNightFactor * 0.72;
    col *= nightDim;
    float foamBright = 1.0 - uNightFactor * 0.55;

    col += vec3(caustic) * foamBright;
    col = mix(col, uColorFoam * foamBright, shoreFoam);

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ═══════════════════════════════════════════════════════════════════════════
// Material-Factory: WebGL vs WebGPU
// ═══════════════════════════════════════════════════════════════════════════

async function buildOceanMaterial(rendererMode) {
  if (rendererMode === "webgpu") {
    return buildOceanMaterialTSL();
  }
  return buildOceanMaterialGLSL();
}

function buildOceanMaterialGLSL() {
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      uTime:         { value: 0 },
      uColorDeep:    { value: new THREE.Color(COLOR_DEEP) },
      uColorMid:     { value: new THREE.Color(COLOR_MID) },
      uColorShallow: { value: new THREE.Color(COLOR_SHALLOW) },
      uColorFoam:    { value: new THREE.Color(COLOR_FOAM) },
      uShoreRadius:  { value: SHORE_RADIUS },
      uNightFactor:  { value: 0.0 },
    },
  });
  // Adapter für update(): uniforms direkt schreibbar (gleicher Pfad wie vorher)
  material.userData.setTime = (t) => { material.uniforms.uTime.value = t; };
  material.userData.setNightFactor = (n) => { material.uniforms.uNightFactor.value = n; };
  return material;
}

async function buildOceanMaterialTSL() {
  // Dynamic import damit der WebGL-Pfad keinen NodeMaterial-Code lädt
  const webgpuMod = await import("three/webgpu");
  const tslMod = await import("three/tsl");
  const {
    Fn, uniform, vec2, vec3, vec4, float,
    sin, dot, floor, fract, mix, smoothstep, clamp, max, abs, length,
    positionLocal, modelWorldMatrix,
  } = tslMod;
  const { MeshBasicNodeMaterial } = webgpuMod;

  // Uniforms — Live-Refs, schreibbar von außen
  const uTime         = uniform(0);
  const uNightFactor  = uniform(0);
  const uColorDeep    = uniform(new THREE.Color(COLOR_DEEP));
  const uColorMid     = uniform(new THREE.Color(COLOR_MID));
  const uColorShallow = uniform(new THREE.Color(COLOR_SHALLOW));
  const uColorFoam    = uniform(new THREE.Color(COLOR_FOAM));
  const uShoreRadius  = uniform(SHORE_RADIUS);

  // ─── Noise-Helpers als TSL-Functions ───
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

  const fbm = Fn(([p]) => {
    const pp = p.toVar();
    const v  = float(0).toVar();
    const a  = float(0.5).toVar();
    // 3 Oktaven unrolled (TSL-Loops auf float-Counter sind unhandlich)
    v.addAssign(vnoise(pp).mul(a)); pp.mulAssign(2.05); a.mulAssign(0.5);
    v.addAssign(vnoise(pp).mul(a)); pp.mulAssign(2.05); a.mulAssign(0.5);
    v.addAssign(vnoise(pp).mul(a));
    return v;
  });

  // Cheaper FBM für Caustics — nur 2 Oktaven. Caustics sind subtil (max 8%
  // Brightness), kein Detail-Verlust sichtbar.
  const fbm2 = Fn(([p]) => {
    const pp = p.toVar();
    const v  = vnoise(pp).mul(0.5).toVar();
    pp.mulAssign(2.05);
    v.addAssign(vnoise(pp).mul(0.25));
    return v;
  });

  // ─── Material ───
  const material = new MeshBasicNodeMaterial();

  // Varying für vWorldPos (in WebGL haben wir das selbst gemacht — hier nutzen
  // wir worldPosition aus TSL über positionWorld). TSL bietet `positionWorld`
  // direkt — wir nehmen es im colorNode.

  // positionNode: dezentes Wedeln (analog VERTEX_SHADER)
  material.positionNode = Fn(() => {
    const p = positionLocal.toVar();
    const w = sin(p.x.mul(0.10).add(uTime.mul(0.5))).mul(0.025)
        .add(sin(p.y.mul(0.13).sub(uTime.mul(0.4))).mul(0.020));
    p.z.addAssign(w);
    return p;
  })();

  // colorNode: kompletter Fragment-Shader
  material.colorNode = Fn(() => {
    // worldPosition aus der gemodifizierten Local-Position rekonstruieren.
    // Die Plane ist rotiert (rotation.x = -PI/2), also XZ-Welt liegt in
    // Plane-XY. Wir lesen positionLocal als 2D-Surface-Koordinate.
    // Achtung: modelWorldMatrix berücksichtigt die rotation/position. Wir
    // multiplizieren positionLocal damit um wxz zu bekommen.
    const wp = modelWorldMatrix.mul(vec4(positionLocal, 1)).xyz;
    const wxz = vec2(wp.x, wp.z);

    const distToCenter = length(wxz);
    const distToShore = distToCenter.sub(uShoreRadius);

    // Tiefen-Gradient
    const midMix  = smoothstep(0.0,  24.0,  distToShore);
    const deepMix = smoothstep(40.0, 180.0, distToShore);
    const col     = mix(uColorShallow, uColorMid,  midMix).toVar();
    col.assign(mix(col, uColorDeep, deepMix));

    // Radial- und Tangential-Vektor
    const safeDist = max(distToCenter, float(0.001));
    const radialDir  = wxz.div(safeDist);
    const tangentDir = vec2(radialDir.y.negate(), radialDir.x);

    // Foam — zwei gescrollte FBM-Layer
    const foamUv1 = wxz.mul(0.12).add(tangentDir.mul(uTime).mul(0.55));
    const foamUv2 = wxz.mul(0.26).sub(tangentDir.mul(uTime).mul(0.32));
    const n1 = fbm(foamUv1);
    const n2 = fbm(foamUv2);
    const foamNoise = n1.mul(n2).mul(1.9);

    // Strand-Zone
    const shoreZoneBase = float(1).sub(smoothstep(0.0, 14.0, abs(distToShore)));
    const beachInner    = float(1).sub(smoothstep(-6.0, 0.0, distToShore));
    const shoreZone     = clamp(shoreZoneBase.add(beachInner.mul(0.5)), 0, 1);

    const shoreFoamSoft = smoothstep(0.55, 0.82, foamNoise).mul(shoreZone);

    // Strand-Schaum-Kante
    const edgeBand = float(1).sub(smoothstep(0.0, 2.4, abs(distToShore)));
    const coast    = dot(wxz, tangentDir);
    const pulse    = float(0.78).add(sin(coast.mul(0.55).sub(uTime.mul(1.6))).mul(0.22));
    const beachEdge = edgeBand.mul(pulse);
    const shoreFoam = max(shoreFoamSoft, beachEdge);

    // Offshore-Caustics (mit cheaper fbm2 für weniger ALU-Last)
    const windDir = vec2(0.85, 0.53);
    const caustUv = wxz.mul(0.09).add(windDir.mul(uTime).mul(0.18));
    const causticBase = fbm2(caustUv);
    const caustic = smoothstep(0.62, 0.85, causticBase).mul(deepMix).mul(0.08);

    // Tag/Nacht
    const nightDim   = float(1).sub(uNightFactor.mul(0.72));
    const foamBright = float(1).sub(uNightFactor.mul(0.55));
    col.mulAssign(nightDim);

    // Compositing
    col.addAssign(vec3(caustic, caustic, caustic).mul(foamBright));
    const finalCol = mix(col, uColorFoam.mul(foamBright), shoreFoam);

    return vec4(finalCol, 1);
  })();

  // Adapter für update()
  material.userData.setTime = (t) => { uTime.value = t; };
  material.userData.setNightFactor = (n) => { uNightFactor.value = n; };

  return material;
}

// ═══════════════════════════════════════════════════════════════════════════
// Ocean-Klasse
// ═══════════════════════════════════════════════════════════════════════════

export class Ocean {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;

    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
    this.geometry = geo;

    // Material asynchron erzeugen — WebGPU braucht dynamic import von three/tsl.
    // Solange das läuft, gibt es kein Mesh in der Szene. Bei WebGL ist die
    // Factory synchron (returnt sofort).
    this._buildMaterialAndMesh();
  }

  async _buildMaterialAndMesh() {
    // Wichtig: erst auf den Renderer warten — sonst ist `mode` noch "loading"
    // und wir bauen das falsche Material (GLSL unter WebGPU = nicht kompatibel).
    if (this.game?.renderer?.ready?.then) {
      try { await this.game.renderer.ready; } catch (e) {}
    }
    const mode = this.game?.renderer?.mode || "webgl";
    try {
      this.material = await buildOceanMaterial(mode);
    } catch (e) {
      console.error("[Ocean] TSL material build failed:", e);
      if (mode === "webgpu") {
        // Unter WebGPU rendert ShaderMaterial nicht — wir warnen und schalten
        // den User-Preference auf WebGL für den nächsten Reload um. Diese
        // Session bleibt sichtbar mit leerem Wasser.
        console.warn("[Ocean] No usable fallback under WebGPU. Switching preference to WebGL for next reload.");
        try {
          const KEY = "numan-portfolio-settings-v1";
          const raw = localStorage.getItem(KEY);
          const p = raw ? JSON.parse(raw) : {};
          p.renderer = "webgl";
          localStorage.setItem(KEY, JSON.stringify(p));
        } catch (_e) {}
        return;
      }
      // WebGL-Fallback ist OK — wir nutzen das alte GLSL-Material
      this.material = buildOceanMaterialGLSL();
    }

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = Y;
    this.mesh.renderOrder = -10;
    // Ocean ist eine 2400m große Plane — niemals im Shadow-Pass nötig
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.scene.add(this.mesh);
    console.log(`[Ocean] material built (${mode})`);
  }

  update() {
    if (!this.material) return;
    const t = this.game.time?.elapsed || 0;
    this.material.userData.setTime?.(t);

    const dc = this.game.world?.dayCycle?.live;
    if (dc) {
      this.material.userData.setNightFactor?.(dc.nightFactor ?? 0);
    }
  }

  destroy() {
    if (this.mesh) this.scene?.remove?.(this.mesh);
    this.geometry?.dispose?.();
    this.material?.dispose?.();
  }
}
