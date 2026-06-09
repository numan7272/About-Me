/**
 * SkyDome — Gradient-Himmel statt flacher Background-Farbe.
 *
 * Dual-Renderer-Support (gleiches Muster wie Ocean.js):
 *   - WebGL:  THREE.ShaderMaterial mit GLSL
 *   - WebGPU: THREE.MeshBasicNodeMaterial mit TSL
 *
 * Konzept (beide Pfade identisch):
 *   1. Vertikaler Gradient: Horizont (skyColorA) → Zenit (skyColorB)
 *   2. Sonnen-Disc + weicher Halo in Richtung DayCycle.sunPosition
 *   3. Sternenfeld bei Nacht (hash-basiert, leichtes Twinkeln)
 *
 * Die Kuppel folgt der Kamera (frustumCulled=false, depthWrite=false,
 * renderOrder -100) — sie liegt damit immer hinter der Szene und clippt
 * nie an der Far-Plane (Radius 240 < camera.far 300).
 *
 * Farben kommen pro Frame aus DayCycle.live — skyColorB wurde dort bisher
 * berechnet aber nie benutzt (Background war flat skyColorA).
 */

import * as THREE from "three";

const RADIUS = 240;

// ═══════════════════════════════════════════════════════════════════════════
// WebGL-Pfad: GLSL
// ═══════════════════════════════════════════════════════════════════════════

const VERTEX_SHADER = /* glsl */ `
  varying vec3 vDir;

  void main() {
    // Richtung vom Kuppel-Zentrum zum Vertex — Kuppel ist an der Kamera
    // zentriert, also ist die Local-Position direkt die Blickrichtung.
    vDir = position;
    vec4 mPos = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * mPos;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3  uHorizonColor;
  uniform vec3  uZenithColor;
  uniform vec3  uSunColor;
  uniform vec3  uSunDirection;
  uniform float uSunIntensity;
  uniform float uNightFactor;
  uniform float uTime;
  varying vec3 vDir;

  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    vec3 dir = normalize(vDir);

    // 1) Vertikaler Gradient — Horizont nach Zenit. Unterhalb des Horizonts
    //    bleibt die Horizontfarbe stehen (Ocean deckt das eh ab).
    float h = clamp(dir.y, 0.0, 1.0);
    float grad = pow(smoothstep(0.0, 0.55, h), 0.85);
    vec3 col = mix(uHorizonColor, uZenithColor, grad);

    // 2) Sonne — harte Disc + zwei weiche Halo-Schichten
    float sunDot = max(dot(dir, uSunDirection), 0.0);
    float disc  = smoothstep(0.9994, 0.9998, sunDot);
    float halo1 = pow(sunDot, 220.0) * 0.55;
    float halo2 = pow(sunDot, 18.0)  * 0.18;
    float sunVis = clamp(uSunIntensity, 0.0, 1.3);
    col += uSunColor * (disc * 1.4 + halo1 + halo2) * sunVis;

    // 3) Sterne bei Nacht — Zellen-Grid über Azimut/Elevation, pro Zelle
    //    max. 1 Stern mit zufälligem Offset + Twinkle.
    if (uNightFactor > 0.02) {
      vec2 sphUv = vec2(atan(dir.z, dir.x), asin(clamp(dir.y, -1.0, 1.0)));
      vec2 grid = sphUv * vec2(28.0, 36.0);
      vec2 cell = floor(grid);
      float rnd = hash21(cell);
      vec2 starPos = vec2(hash21(cell + 7.31), hash21(cell + 13.7)) - 0.5;
      vec2 f = fract(grid) - 0.5 - starPos * 0.55;
      float star = smoothstep(0.10, 0.02, length(f)) * step(0.80, rnd);
      float twinkle = 0.65 + 0.35 * sin(uTime * (1.5 + 3.0 * rnd) + rnd * 43.0);
      // Nur oberhalb des Horizonts, nahe Zenit am hellsten
      float skyMask = smoothstep(0.03, 0.30, dir.y);
      col += vec3(0.82, 0.88, 1.0) * star * twinkle * skyMask * uNightFactor;
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

function buildSkyMaterialGLSL() {
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      uHorizonColor: { value: new THREE.Color(0xa8d8ff) },
      uZenithColor:  { value: new THREE.Color(0x4a8fd4) },
      uSunColor:     { value: new THREE.Color(0xfff4d6) },
      uSunDirection: { value: new THREE.Vector3(0.5, 0.7, 0.4).normalize() },
      uSunIntensity: { value: 1.0 },
      uNightFactor:  { value: 0.0 },
      uTime:         { value: 0 },
    },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const u = material.uniforms;
  material.userData.setHorizonColor = (c) => u.uHorizonColor.value.copy(c);
  material.userData.setZenithColor  = (c) => u.uZenithColor.value.copy(c);
  material.userData.setSunColor     = (c) => u.uSunColor.value.copy(c);
  material.userData.setSunDirection = (v) => u.uSunDirection.value.copy(v);
  material.userData.setSunIntensity = (x) => { u.uSunIntensity.value = x; };
  material.userData.setNightFactor  = (x) => { u.uNightFactor.value = x; };
  material.userData.setTime         = (t) => { u.uTime.value = t; };
  return material;
}

// ═══════════════════════════════════════════════════════════════════════════
// WebGPU-Pfad: TSL
// ═══════════════════════════════════════════════════════════════════════════

async function buildSkyMaterialTSL() {
  const webgpuMod = await import("three/webgpu");
  const tslMod = await import("three/tsl");
  const {
    Fn, uniform, vec2, vec3, vec4, float,
    sin, dot, floor, fract, mix, smoothstep, clamp, max, length, step,
    pow, normalize, atan, asin,
    positionLocal,
  } = tslMod;
  const { MeshBasicNodeMaterial } = webgpuMod;

  const uHorizonColor = uniform(new THREE.Color(0xa8d8ff));
  const uZenithColor  = uniform(new THREE.Color(0x4a8fd4));
  const uSunColor     = uniform(new THREE.Color(0xfff4d6));
  const uSunDirection = uniform(new THREE.Vector3(0.5, 0.7, 0.4).normalize());
  const uSunIntensity = uniform(1.0);
  const uNightFactor  = uniform(0.0);
  const uTime         = uniform(0);

  const hash21 = Fn(([p]) => {
    return fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));
  });

  const material = new MeshBasicNodeMaterial();
  material.side = THREE.BackSide;
  material.depthWrite = false;
  material.fog = false;

  material.colorNode = Fn(() => {
    const dir = normalize(positionLocal);

    // 1) Gradient Horizont → Zenit
    const h = clamp(dir.y, 0.0, 1.0);
    const grad = pow(smoothstep(0.0, 0.55, h), 0.85);
    const col = mix(uHorizonColor, uZenithColor, grad).toVar();

    // 2) Sonne — Disc + Halos
    const sunDot = max(dot(dir, uSunDirection), 0.0);
    const disc  = smoothstep(0.9994, 0.9998, sunDot);
    const halo1 = pow(sunDot, 220.0).mul(0.55);
    const halo2 = pow(sunDot, 18.0).mul(0.18);
    const sunVis = clamp(uSunIntensity, 0.0, 1.3);
    col.addAssign(uSunColor.mul(disc.mul(1.4).add(halo1).add(halo2)).mul(sunVis));

    // 3) Sterne — gleiche Zellen-Logik wie GLSL-Pfad (ohne Branch; das
    //    Sternenfeld wird über uNightFactor weggeblendet).
    const sphUv = vec2(atan(dir.z, dir.x), asin(clamp(dir.y, -1.0, 1.0)));
    const grid = sphUv.mul(vec2(28.0, 36.0));
    const cell = floor(grid);
    const rnd = hash21(cell);
    const starPos = vec2(hash21(cell.add(7.31)), hash21(cell.add(13.7))).sub(0.5);
    const f = fract(grid).sub(0.5).sub(starPos.mul(0.55));
    const star = smoothstep(0.10, 0.02, length(f)).mul(step(0.80, rnd));
    const twinkle = float(0.65).add(sin(uTime.mul(rnd.mul(3.0).add(1.5)).add(rnd.mul(43.0))).mul(0.35));
    const skyMask = smoothstep(0.03, 0.30, dir.y);
    col.addAssign(vec3(0.82, 0.88, 1.0).mul(star).mul(twinkle).mul(skyMask).mul(uNightFactor));

    return vec4(col, 1);
  })();

  material.userData.setHorizonColor = (c) => uHorizonColor.value.copy(c);
  material.userData.setZenithColor  = (c) => uZenithColor.value.copy(c);
  material.userData.setSunColor     = (c) => uSunColor.value.copy(c);
  material.userData.setSunDirection = (v) => uSunDirection.value.copy(v);
  material.userData.setSunIntensity = (x) => { uSunIntensity.value = x; };
  material.userData.setNightFactor  = (x) => { uNightFactor.value = x; };
  material.userData.setTime         = (t) => { uTime.value = t; };
  return material;
}

// ═══════════════════════════════════════════════════════════════════════════
// SkyDome-Klasse
// ═══════════════════════════════════════════════════════════════════════════

export class SkyDome {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;

    // Niedrige Segment-Dichte reicht — der Gradient läuft im Fragment-Shader.
    this.geometry = new THREE.SphereGeometry(RADIUS, 32, 20);
    this._sunDir = new THREE.Vector3(0.5, 0.7, 0.4).normalize();

    this._buildMaterialAndMesh();
  }

  async _buildMaterialAndMesh() {
    // Erst auf den Renderer warten — `mode` ist sonst noch "loading".
    if (this.game?.renderer?.ready?.then) {
      try { await this.game.renderer.ready; } catch (e) {}
    }
    const mode = this.game?.renderer?.mode || "webgl";
    try {
      this.material = mode === "webgpu"
        ? await buildSkyMaterialTSL()
        : buildSkyMaterialGLSL();
    } catch (e) {
      console.error("[SkyDome] material build failed:", e);
      if (mode === "webgpu") return;   // flat scene.background bleibt Fallback
      this.material = buildSkyMaterialGLSL();
    }

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.renderOrder = -100;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.scene.add(this.mesh);
    console.log(`[SkyDome] material built (${mode})`);
  }

  update() {
    if (!this.mesh || !this.material) return;

    // Kuppel folgt der Kamera — bleibt immer innerhalb der Far-Plane.
    const cam = this.game.cameraRig?.camera;
    if (cam) this.mesh.position.copy(cam.position);

    const ud = this.material.userData;
    ud.setTime?.(this.game.time?.elapsed || 0);

    const live = this.game.world?.dayCycle?.live;
    if (!live) return;
    ud.setHorizonColor?.(live.skyColorA);
    ud.setZenithColor?.(live.skyColorB);
    ud.setSunColor?.(live.sunColor);
    ud.setSunIntensity?.(live.sunIntensity);
    ud.setNightFactor?.(live.nightFactor);
    this._sunDir.set(
      live.sunPosition[0],
      live.sunPosition[1],
      live.sunPosition[2],
    ).normalize();
    ud.setSunDirection?.(this._sunDir);
  }

  destroy() {
    if (this.mesh) this.scene?.remove?.(this.mesh);
    this.geometry?.dispose?.();
    this.material?.dispose?.();
  }
}
