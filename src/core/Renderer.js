/**
 * Renderer — WebGL- oder WebGPU-Setup mit Three.js.
 *
 * Wie Bruno Simon's folio-2025: User wählt zwischen WebGL und WebGPU.
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
      // PCFSoft kostet unter WebGPU mehrere Sample-Reads pro Pixel.
      // Standard-PCF ist 4-tap, sieht unter unserer Insel-Iso fast identisch aus.
      r.shadowMap.type = this.preference === "webgpu"
        ? THREE.PCFShadowMap
        : THREE.PCFSoftShadowMap;
    }
    r.setClearColor(0x04060e);

    // Bruno-Pattern: manuelle renderOrder-Sortierung statt teurer Default-Sort.
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
      const { PostProcessing } = webgpu;
      const { pass } = tsl;
      const { bloom } = bloomMod;

      this.postProcessing = new PostProcessing(this.instance);

      // ScenePass + Bloom — Threshold hoch (1.0 = nur HDR-Werte), Strength
      // niedriger. Das reduziert die Bloom-Mip-Chain-Last drastisch:
      // weniger Pixel triggern den Bloom-Pass, da nur emissive Materials mit
      // Intensity > 1.0 überhaupt bloomen.
      const scenePass = pass(this.game.scene, this.game.cameraRig.camera);
      const bloomPass = bloom(scenePass, 0.35, 0.4, 1.0);

      this.postProcessing.outputNode = scenePass.add(bloomPass);
      this._wgpuScenePass = scenePass;
      console.log("[Renderer] WebGPU bloom pipeline ready (optimized)");
    } catch (e) {
      console.warn("[Renderer] WebGPU bloom init failed:", e?.message || e);
      this.postProcessing = null;
    }
  }

  async _initWebGLBloom() {
    try {
      const { EffectComposer } = await import("three/examples/jsm/postprocessing/EffectComposer.js");
      const { RenderPass } = await import("three/examples/jsm/postprocessing/RenderPass.js");
      const { UnrealBloomPass } = await import("three/examples/jsm/postprocessing/UnrealBloomPass.js");
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

  render(scene, camera) {
    if (!this.instance) return;

    // WebGL + EffectComposer-Pfad
    if (this.composer && this.mode === "webgl") {
      if (this.renderPass) {
        this.renderPass.scene = scene;
        this.renderPass.camera = camera;
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
    this.instance?.dispose?.();
  }
}
