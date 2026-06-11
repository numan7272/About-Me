/**
 * FlowField — GPU-Strömungsfeld fürs Pointer-Wischen (Wasser-Gefühl).
 *
 * Ping-Pong zwischen zwei kleinen RenderTargets (192²). Pro Frame:
 *   1. Feld liest sich selbst leicht versetzt (Pseudo-Advektion — die
 *      Strömung "treibt" mit sich selbst und wirkt dadurch flüssig)
 *   2. Dissipation (×0.955) lässt alles über ~1s verebben
 *   3. Pointer-Bewegung splattert ihre Velocity als Gauß-Fleck hinein
 *
 * Kein Pressure-Solve wie in echten Fluid-Sims — für den "über Wasser
 * streichen"-Look reicht Advektion + Zerfall, bei einem Bruchteil der
 * Kosten (2× 192²-Passes ≈ 0.1ms GPU).
 *
 * Das RG-Feld konsumiert der DistortPass im Renderer als UV-Offset.
 */

import * as THREE from "three";

const SIM_SIZE = 192;
const DISSIPATION = 0.955;
const SPLAT_RADIUS = 0.0032;     // im quadrierten UV-Raum (Gauß-Breite)
const VELOCITY_SCALE = 14;       // Pointer-Delta (UV/Frame) → Feldstärke

const SIM_FRAGMENT = /* glsl */ `
  uniform sampler2D tPrev;
  uniform vec2  uPointer;
  uniform vec2  uVelocity;
  uniform float uAspect;
  uniform float uHasInput;
  varying vec2 vUv;

  void main() {
    // Pseudo-Advektion: dort weiterlesen, woher die Strömung kommt
    vec2 flow = texture2D(tPrev, vUv).rg;
    vec2 f = texture2D(tPrev, vUv - flow * 0.004).rg * ${DISSIPATION.toFixed(3)};

    // Pointer-Splat
    vec2 d = vUv - uPointer;
    d.x *= uAspect;
    float splat = exp(-dot(d, d) / ${SPLAT_RADIUS.toFixed(4)}) * uHasInput;
    f += uVelocity * splat;

    f = clamp(f, vec2(-1.0), vec2(1.0));
    gl_FragColor = vec4(f, 0.0, 1.0);
  }
`;

const SIM_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export class FlowField {
  constructor(canvas) {
    this.canvas = canvas;

    const opts = {
      type: THREE.HalfFloatType,
      format: THREE.RGFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
    };
    this._rtA = new THREE.WebGLRenderTarget(SIM_SIZE, SIM_SIZE, opts);
    this._rtB = new THREE.WebGLRenderTarget(SIM_SIZE, SIM_SIZE, opts);

    this._scene = new THREE.Scene();
    this._camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this._material = new THREE.ShaderMaterial({
      vertexShader: SIM_VERTEX,
      fragmentShader: SIM_FRAGMENT,
      uniforms: {
        tPrev:     { value: null },
        uPointer:  { value: new THREE.Vector2(0.5, 0.5) },
        uVelocity: { value: new THREE.Vector2() },
        uAspect:   { value: 1 },
        uHasInput: { value: 0 },
      },
    });
    this._quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this._material);
    this._scene.add(this._quad);

    // Pointer-Tracking (Maus + Touch — pointermove deckt beides ab,
    // #game-canvas hat touch-action: none)
    this._pointer = new THREE.Vector2(0.5, 0.5);
    this._lastPointer = new THREE.Vector2(0.5, 0.5);
    this._velocity = new THREE.Vector2();
    this._hasInput = false;
    this._onMove = (e) => {
      const x = e.clientX / window.innerWidth;
      const y = 1 - e.clientY / window.innerHeight;
      if (this._hasInput) {
        this._velocity.set(
          (x - this._lastPointer.x) * VELOCITY_SCALE,
          (y - this._lastPointer.y) * VELOCITY_SCALE,
        );
      }
      this._pointer.set(x, y);
      this._lastPointer.set(x, y);
      this._hasInput = true;
    };
    window.addEventListener("pointermove", this._onMove, { passive: true });
  }

  /** Einen Sim-Schritt rechnen. Muss vor dem Composer-Render laufen. */
  update(renderer) {
    const u = this._material.uniforms;
    u.tPrev.value = this._rtA.texture;
    u.uPointer.value.copy(this._pointer);
    u.uVelocity.value.copy(this._velocity);
    u.uAspect.value = window.innerWidth / Math.max(1, window.innerHeight);
    u.uHasInput.value = this._hasInput ? 1 : 0;

    const prevRT = renderer.getRenderTarget();
    renderer.setRenderTarget(this._rtB);
    renderer.render(this._scene, this._camera);
    renderer.setRenderTarget(prevRT);

    // Ping-Pong tauschen
    const tmp = this._rtA;
    this._rtA = this._rtB;
    this._rtB = tmp;

    // Velocity zerfällt sofort — nur echte Bewegung splattert
    this._velocity.multiplyScalar(0.5);
  }

  get texture() {
    return this._rtA.texture;
  }

  destroy() {
    window.removeEventListener("pointermove", this._onMove);
    this._rtA.dispose();
    this._rtB.dispose();
    this._quad.geometry.dispose();
    this._material.dispose();
  }
}
