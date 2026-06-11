/**
 * Renderer — WebGL- oder WebGPU-Setup mit Three.js.
 *
 * User wählt zwischen WebGL und WebGPU.
 *
 * WebGL-Pfad:
 *   - THREE.WebGLRenderer
 *   - Bloom via EffectComposer + UnrealBloomPass
 *   - Shader: klassisches ShaderMaterial (GLSL inline)
 *
 * WebGPU-Pfad:
 *   - THREE.WebGPURenderer aus 'three/webgpu'
 *   - Bloom via PostProcessing + bloom() aus 'three/tsl'
 *   - Shader: NodeMaterial + TSL (siehe Ocean.js / Grass.js Dual-Pfad)
 *
 * Settings-Toggle ("webgpu" / "webgl") via localStorage.
 */

import * as THREE from "three";

const STORAGE_KEY = "numan-portfolio-settings-v1";

function loadPreference() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.renderer === "webgl" || parsed.renderer === "webgpu") {
        return parsed.renderer;
      }
    }
  } catch (e) {}
  return "webgl";   // Default WebGL — robust für ShaderMaterial + Bloom
}

export class Renderer {
  constructor(game) {
    this.game = game;
    this.canvas = game.canvas;
    this.preference = loadPreference();
    this.mode = "loading";
    this.instance = null;
    this.composer = null;
    this.postProcessing = null;       // WebGPU-Bloom-Pipeline
    this._wgpuScenePass = null;
    this.ready = this._init();
  }

  async _init() {
    if (this.preference === "webgpu") {
      try {
        const { WebGPURenderer } = await import("three/webgpu");
        const r = new WebGPURenderer({
          canvas: this.canvas,
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        });
        await r.init();
        this._configure(r);
        this.instance = r;
        this.mode = "webgpu";
        await this._initWebGPUBloom();
        this._installDeviceLossHandler(r);
        console.log("[Renderer] WebGPU initialized with native bloom");
        return;
      } catch (e) {
        console.warn("[Renderer] WebGPU init failed, falling back to WebGL:", e?.message || e);
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          const p = raw ? JSON.parse(raw) : {};
          p.renderer = "webgl";
          localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
        } catch (_e) {}
      }
    }

    // WebGL-Pfad
    const r = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this._configure(r);
    this.instance = r;
    this.mode = "webgl";
    await this._initWebGLBloom();
    console.log("[Renderer] WebGL initialized with bloom");
  }

  _configure(r) {
    r.setPixelRatio(this.game.sizes.pixelRatio);
    r.setSize(this.game.sizes.width, this.game.sizes.height);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    if (r.shadowMap) {
      r.shadowMap.enabled = true;
      // PCFSoftShadowMap ist seit r184 deprecated (fiel intern eh auf PCF
      // zurück). Standard-PCF ist 4-tap, sieht unter unserer Insel-Iso
      // praktisch identisch aus und ist unter WebGPU deutlich billiger.
      r.shadowMap.type = THREE.PCFShadowMap;
    }
    r.setClearColor(0x1d1721);   // matches --ink token + theme-color in index.html

    // Manuelle renderOrder-Sortierung statt teurer Default-Sort.
    // Bei vielen statischen Objekten 0.2-1ms CPU/Frame gespart.
    r.sortObjects = false;
    if (r.setOpaqueSort) {
      r.setOpaqueSort((a, b) => a.renderOrder - b.renderOrder);
    }
    if (r.setTransparentSort) {
      r.setTransparentSort((a, b) => a.renderOrder - b.renderOrder);
    }
  }

  async _initWebGPUBloom() {
    try {
      const webgpu = await import("three/webgpu");
      const tsl = await import("three/tsl");
      // bloom() ist NICHT in three/tsl exportiert — kommt aus den Addons
      const bloomMod = await import("three/addons/tsl/display/BloomNode.js");
      // RenderPipeline ersetzt PostProcessing seit r183. Wir bevorzugen die
      // neue API, mit Fallback auf den alten Namen für ältere three-Builds.
      const Pipeline = webgpu.RenderPipeline || webgpu.PostProcessing;
      const { pass } = tsl;
      const { bloom } = bloomMod;

      this.postProcessing = new Pipeline(this.instance);

      // ScenePass + Bloom — Threshold hoch (1.0 = nur HDR-Werte), Strength
      // niedriger. Das reduziert die Bloom-Mip-Chain-Last drastisch:
      // weniger Pixel triggern den Bloom-Pass, da nur emissive Materials mit
      // Intensity > 1.0 überhaupt bloomen.
      const scenePass = pass(this.game.scene, this.game.cameraRig.camera);
      const bloomPass = bloom(scenePass, 0.35, 0.4, 1.0);

      this.postProcessing.outputNode = scenePass.add(bloomPass);
      this._wgpuScenePass = scenePass;
      this._wgpuBloom = bloomPass;
      console.log("[Renderer] WebGPU render pipeline ready (optimized)");
    } catch (e) {
      console.warn("[Renderer] WebGPU pipeline init failed:", e?.message || e);
      this.postProcessing = null;
    }
  }

  /**
   * Attach a device-loss watcher. On unexpected loss we surface a brutalist
   * recovery overlay and reload; on intentional destroy we stay silent.
   * Recovery via full re-init would require rebuilding scene + physics +
   * shaders, which for a portfolio site is more risk than reload.
   */
  _installDeviceLossHandler(r) {
    const device = r?.backend?.device;
    if (!device?.lost?.then) return;
    device.lost.then((info) => {
      if (this._deviceLossHandled) return;
      this._deviceLossHandled = true;
      const reason = info?.reason || "unknown";
      console.warn("[Renderer] WebGPU device lost:", reason, info?.message || "");
      if (reason !== "unknown") return;
      this._showDeviceLossOverlay();
    }).catch(() => {});
  }

  _showDeviceLossOverlay() {
    const lang = (typeof window !== "undefined" && window.__lang === "en") ? "en" : "de";
    const msg = lang === "en"
      ? "> gpu device lost. reloading"
      : "> gpu verloren. neu laden";
    const overlay = document.createElement("div");
    overlay.setAttribute("role", "alert");
    overlay.textContent = msg;
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--ink-solid, rgba(16, 18, 24, 0.92))",
      color: "var(--signal, #ff5a3c)",
      fontFamily: "var(--font-mono, ui-monospace, monospace)",
      fontSize: "14px",
      letterSpacing: "0.04em",
      zIndex: "999",
    });
    document.body.appendChild(overlay);
    setTimeout(() => location.reload(), 1200);
  }

  async _initWebGLBloom() {
    try {
      const { EffectComposer } = await import("three/examples/jsm/postprocessing/EffectComposer.js");
      const { RenderPass } = await import("three/examples/jsm/postprocessing/RenderPass.js");
      const { UnrealBloomPass } = await import("three/examples/jsm/postprocessing/UnrealBloomPass.js");
      const { ShaderPass } = await import("three/examples/jsm/postprocessing/ShaderPass.js");
      const { OutputPass } = await import("three/examples/jsm/postprocessing/OutputPass.js");

      this.composer = new EffectComposer(this.instance);
      this.composer.setSize(this.game.sizes.width, this.game.sizes.height);
      this.composer.setPixelRatio(this.game.sizes.pixelRatio);

      this.renderPass = new RenderPass(this.game.scene, this.game.cameraRig.camera);
      this.composer.addPass(this.renderPass);

      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(this.game.sizes.width, this.game.sizes.height),
        0.55, 0.6, 0.85,
      );
      this.composer.addPass(this.bloomPass);

      // ── Pointer-Flow-Distortion ──
      // Wischen über den Screen verzerrt das Bild wie Wasser: ein kleines
      // GPU-Strömungsfeld (FlowField) verschiebt die UVs, starke Strömung
      // trennt die Farbkanäle minimal. Aus bei reduced-motion + Graphics low.
      const reduced = typeof window !== "undefined"
        && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      let lowGfx = false;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        lowGfx = !!raw && JSON.parse(raw).graphics === "low";
      } catch (e) {}
      if (!reduced && !lowGfx) {
        const { FlowField } = await import("./FlowField.js");
        this.flowField = new FlowField(this.canvas);
        this.distortPass = new ShaderPass({
          uniforms: {
            tDiffuse:  { value: null },
            tFlow:     { value: null },
            uStrength: { value: 0.045 },
          },
          vertexShader: /* glsl */ `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: /* glsl */ `
            uniform sampler2D tDiffuse;
            uniform sampler2D tFlow;
            uniform float uStrength;
            varying vec2 vUv;
            void main() {
              vec2 flow = texture2D(tFlow, vUv).rg;
              vec2 off = flow * uStrength;
              // Chromatische Trennung skaliert mit Strömungsstärke —
              // gibt dem Schlieren-Moment den "Linsen"-Charakter
              float ca = length(flow) * 0.35;
              vec3 col;
              col.r = texture2D(tDiffuse, vUv - off * (1.0 + ca)).r;
              col.g = texture2D(tDiffuse, vUv - off).g;
              col.b = texture2D(tDiffuse, vUv - off * (1.0 - ca)).b;
              gl_FragColor = vec4(col, 1.0);
            }
          `,
        });
        this.composer.addPass(this.distortPass);
      }

      const outputPass = new OutputPass();
      this.composer.addPass(outputPass);
    } catch (e) {
      console.warn("[Renderer] bloom init failed:", e?.message);
      this.composer = null;
    }
  }

  onResize(width, height) {
    if (!this.instance) return;
    this.instance.setSize(width, height);
    this.instance.setPixelRatio(this.game.sizes.pixelRatio);
    if (this.composer) {
      this.composer.setSize(width, height);
    }
    if (this.bloomPass) {
      this.bloomPass.setSize(width, height);
    }
    // WebGPU-PostProcessing zieht die Größe automatisch aus dem Renderer
    // — kein expliziter setSize-Call nötig.
  }

  /**
   * Bloom intensity day-night aware. Bei Tag dimmen wir bloom auf 0.20
   * (sonst blenden Bike-Chrome + Laternen aus), bei Nacht hoch auf den
   * Default damit Laternen + Headlight bloomen. Per nightFactor lerp.
   */
  _updateBloomForDayCycle() {
    const nf = this.game?.world?.dayCycle?.live?.nightFactor;
    if (typeof nf !== "number") return;
    // Nur bei relevanter Änderung schreiben — vermeidet per-Frame
    // Uniform-Updates (unter WebGPU potenziell Pipeline-Refresh).
    if (this._lastBloomNf !== undefined && Math.abs(nf - this._lastBloomNf) < 0.003) return;
    this._lastBloomNf = nf;
    if (this.mode === "webgl" && this.bloomPass) {
      // WebGL UnrealBloom: 0.18 Tag → 0.55 Nacht
      this.bloomPass.strength = 0.18 + nf * 0.37;
    } else if (this.mode === "webgpu" && this._wgpuBloom) {
      // WebGPU TSL bloom: 0.18 Tag → 0.45 Nacht (etwas niedriger weil
      // TSL bloom auf Linear-Space wirkt und stärker durchschlägt)
      if (this._wgpuBloom.strength?.value !== undefined) {
        this._wgpuBloom.strength.value = 0.18 + nf * 0.27;
      }
    }
  }

  render(scene, camera) {
    if (!this.instance) return;

    this._updateBloomForDayCycle();

    // WebGL + EffectComposer-Pfad
    if (this.composer && this.mode === "webgl") {
      if (this.renderPass) {
        this.renderPass.scene = scene;
        this.renderPass.camera = camera;
      }
      // Strömungsfeld VOR dem Composer ticken — der DistortPass liest
      // die frische Textur im selben Frame
      if (this.flowField && this.distortPass) {
        this.flowField.update(this.instance);
        this.distortPass.uniforms.tFlow.value = this.flowField.texture;
      }
      this.composer.render();
      return;
    }

    // WebGPU + PostProcessing-Pfad
    if (this.postProcessing && this.mode === "webgpu") {
      // ScenePass-Scene/Camera werden beim Bloom-Setup einmalig gesetzt —
      // KEIN Re-Assign pro Frame, das könnte sonst die WebGPU-Pipeline
      // dirty-flaggen und neu kompilieren.
      this.postProcessing.render();
      return;
    }

    // Fallback: direkter Render ohne Bloom
    this.instance.render(scene, camera);
  }

  destroy() {
    // WebGL EffectComposer holds passes + render targets — dispose them
    // explicitly before the renderer goes away.
    try {
      this.composer?.passes?.forEach?.((p) => p?.dispose?.());
      this.composer?.renderTarget1?.dispose?.();
      this.composer?.renderTarget2?.dispose?.();
    } catch (e) {
      console.warn("[Renderer] composer dispose failed:", e?.message);
    }
    this.composer = null;
    this.renderPass = null;
    this.bloomPass = null;
    this.flowField?.destroy?.();
    this.flowField = null;
    this.distortPass = null;

    // WebGPU RenderPipeline. dispose() exists on newer builds.
    try { this.postProcessing?.dispose?.(); } catch (e) {
      console.warn("[Renderer] postProcessing dispose failed:", e?.message);
    }
    this.postProcessing = null;
    this._wgpuScenePass = null;

    this.instance?.dispose?.();
    this.instance = null;
  }
}
