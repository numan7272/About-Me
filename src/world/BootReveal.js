/**
 * BootReveal — 3D-Skeleton-Screen mit radialem "Sturm"-Clip.
 *
 * Unter WebGL (Default-Renderer) wird in alle Welt-Materialien per
 * onBeforeCompile ein radialer Fragment-Discard injiziert: alles
 * außerhalb des Reveal-Kreises um den Spawn verschwindet — Gebäude,
 * Bäume und Straße werden an der Kreiskante ABGESCHNITTEN (der
 * Fortnite-Sturm-Effekt). Der Kreis ist so groß wie der In-World-
 * Joystick-Ring (~2.4m), das HQ ragt also angeschnitten hinein.
 *
 * Drumherum: Blueprint-Fläche (Gitter + Kreuzchen), der Kreisrand ist
 * ein dezent leuchtender Ring, der sich als Fortschrittsbogen füllt
 * (geometry.drawRange) und bei "bereit" pulsiert. Beim Start-Klick
 * expandiert der Clip-Radius über die ganze Insel, der Ring wächst
 * synchron mit und verblasst, das Blueprint blendet aus.
 *
 * Unter WebGPU (onBeforeCompile greift dort nicht) werden die Welt-
 * Materialien in NodeMaterials konvertiert und der Clip läuft als
 * opacityNode + alphaTest-Discard (TSL). Schlägt die Konvertierung
 * fehl: Fallback mit versteckter Welt + Gebäude-Scale-Pop.
 */

import * as THREE from "three";
import { BIKE_SPAWN } from "./spawn.js";

const SPAWN = [BIKE_SPAWN[0], 0.12, BIKE_SPAWN[2]];
const CIRCLE_R = 2.6;          // ≈ Joystick-Ring (2.4m) + schmaler Rand
const REVEAL_MAX = 130;        // Radius der die ganze Insel abdeckt
const RING_COLOR = new THREE.Color(1.28, 1.12, 0.86);   // Sand, dezent
const BLUEPRINT_BG = 0x0f1a19;

function easeCubicOut(t) {
  return 1 - Math.pow(1 - t, 3);
}
function easeCubicIn(t) {
  return t * t * t;
}
function easeBackOut(t, s = 1.5) {
  const u = t - 1;
  return 1 + u * u * ((s + 1) * u + s);
}

function buildBlueprintTexture() {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#182723";
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0.5, 0); ctx.lineTo(0.5, S);
  ctx.moveTo(0, 0.5); ctx.lineTo(S, 0.5);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.17)";
  ctx.lineWidth = 2;
  const m = S / 2, a = 7;
  ctx.beginPath();
  ctx.moveTo(m - a, m - a); ctx.lineTo(m + a, m + a);
  ctx.moveTo(m + a, m - a); ctx.lineTo(m - a, m + a);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(100, 100);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class BootReveal {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.active = true;
    this._progress = 0;
    this._revealing = false;
    this._tweens = [];
    this._clipMode = false;     // true = WebGL-Sturm-Clip aktiv

    // Geteilte Uniforms für alle injizierten Materialien — EIN Update
    // trifft die ganze Welt.
    this._uRevealR  = { value: CIRCLE_R };
    this._uRevealC  = { value: new THREE.Vector2(SPAWN[0], SPAWN[2]) };
    this._uRevealOn = { value: 1 };

    // ── Blueprint-Boden ──
    this._floorTex = buildBlueprintTexture();
    this._floorMat = new THREE.MeshBasicMaterial({
      map: this._floorTex,
      fog: false,
      transparent: true,
    });
    this._floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), this._floorMat);
    this._floor.rotation.x = -Math.PI / 2;
    this._floor.position.y = -0.04;
    this._floor.renderOrder = -50;
    this.scene.add(this._floor);

    // ── Plattform-Scheibe (nur WebGPU-Fallback nötig — unter WebGL ist
    // das echte Terrain im Kreis sichtbar) ──
    this._discMat = new THREE.MeshStandardMaterial({
      color: 0x2c3a20,
      roughness: 0.95,
      transparent: true,
    });
    this._disc = new THREE.Mesh(new THREE.CircleGeometry(CIRCLE_R, 48), this._discMat);
    this._disc.rotation.x = -Math.PI / 2;
    this._disc.position.set(SPAWN[0], 0.01, SPAWN[2]);
    this._disc.receiveShadow = true;
    this._disc.visible = false;
    this.scene.add(this._disc);

    // ── Leucht-Ring (Fortschrittsbogen via drawRange) ──
    this._ringGeo = new THREE.TorusGeometry(CIRCLE_R + 0.08, 0.035, 8, 128);
    this._ringMat = new THREE.MeshBasicMaterial({
      color: RING_COLOR,
      toneMapped: false,
      transparent: true,
      fog: false,
    });
    this._ring = new THREE.Mesh(this._ringGeo, this._ringMat);
    this._ring.rotation.x = -Math.PI / 2;
    this._ring.position.set(SPAWN[0], 0.07, SPAWN[2]);
    this._ringIndexCount = this._ringGeo.index.count;
    this._ringGeo.setDrawRange(0, 0);
    // Bei count=0 unsichtbar lassen — WebGPU validiert sonst den leeren
    // Draw-Call ("Draw with an index count of 0 is unusual").
    this._ring.visible = false;
    this.scene.add(this._ring);

    // Welt-Setup sobald gebaut (World registriert seinen ready-Handler
    // zuerst — die Module existieren wenn wir dran sind)
    this.game.world?.resources?.on?.("ready", () => this._setupStage());

    // Fog aus während des Boots
    this._savedFog = this.scene.fog;
    this.scene.fog = null;
  }

  /** Vom Game/Splash-Progress gefüttert (0..1). */
  setProgress(ratio) {
    this._progress = Math.max(this._progress, Math.min(1, ratio));
  }

  /** Radialer Fragment-Clip per onBeforeCompile (nur WebGL). */
  _injectClip(mat) {
    if (!mat || mat.userData._revealClipped) return;
    mat.userData._revealClipped = true;
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (shader, renderer) => {
      prev?.(shader, renderer);
      shader.uniforms.uRevealR = this._uRevealR;
      shader.uniforms.uRevealC = this._uRevealC;
      shader.uniforms.uRevealOn = this._uRevealOn;
      const anchorsOk =
        shader.vertexShader.includes("#include <common>")
        && shader.vertexShader.includes("#include <project_vertex>")
        && shader.fragmentShader.includes("#include <common>")
        && shader.fragmentShader.includes("#include <clipping_planes_fragment>");
      if (!anchorsOk) return;   // lieber ungeclippt sichtbar als kaputt

      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vRevealW;")
        .replace("#include <project_vertex>",
          "#include <project_vertex>\n  vRevealW = (modelMatrix * vec4(transformed, 1.0)).xz;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>",
          "#include <common>\nvarying vec2 vRevealW;\nuniform float uRevealR;\nuniform vec2 uRevealC;\nuniform float uRevealOn;")
        .replace("#include <clipping_planes_fragment>",
          "#include <clipping_planes_fragment>\n  if (uRevealOn > 0.5 && distance(vRevealW, uRevealC) > uRevealR) discard;");
    };
    mat.needsUpdate = true;
  }

  _collectClipMaterials() {
    const w = this.game.world;
    const mats = new Set();
    const grab = (root) => {
      root?.traverse?.((o) => {
        if (!o.isMesh) return;
        const list = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of list) if (m) mats.add(m);
      });
    };
    grab(w?.island?.root);
    grab(w?.road?.group);
    grab(w?.streetLamps?.group);
    grab(w?.harbor?.group);
    for (const m of [w?.nature?.trunkMesh, w?.nature?.blobMesh, w?.nature?.leafMesh]) {
      if (m?.material) mats.add(m.material);
    }
    return mats;
  }

  /** Bühne aufbauen, sobald die Welt-Module existieren. */
  async _setupStage() {
    if (!this.active || this._revealing) return;

    // KRITISCH: erst auf den Renderer warten. Während eines (langsamen
    // oder fehlschlagenden) WebGPU-Versuchs ist mode noch "loading" —
    // wer da den Node-Pfad wählt, tauscht Materialien ein, die der
    // spätere WebGL-Fallback nicht rendern kann (unsichtbare Welt).
    if (this.game.renderer?.ready?.then) {
      try { await this.game.renderer.ready; } catch (e) {}
    }
    if (!this.active || this._revealing) return;

    if (this.game.renderer?.mode === "webgl") {
      // Sturm-Clip: Welt bleibt sichtbar, alles außerhalb des Kreises
      // wird im Fragment-Shader weggeschnitten — das HQ ragt angeschnitten
      // in den Kreis wie bei einem echten Reveal.
      this._clipMode = true;
      for (const m of this._collectClipMaterials()) this._injectClip(m);
    } else {
      // WebGPU: gleicher Effekt über NodeMaterial-Konvertierung
      this._clipMode = await this._setupNodeClip();
      if (this._clipMode) {
        // Während des async Setups hat der Update-Loop die Welt schon
        // per Fallback-Liste versteckt — wieder zeigen, der Clip
        // übernimmt ab jetzt das Schneiden.
        for (const obj of this._fallbackHidden()) obj.visible = true;
      } else {
        this._disc.visible = true;
      }
    }
    this._applyBootState();
  }

  /**
   * WebGPU-Variante des Sturm-Clips: jedes Welt-Material wird in das
   * passende NodeMaterial konvertiert (copy() übernimmt Maps/Farben/
   * PBR-Werte) und bekommt einen opacityNode, der außerhalb des Kreises
   * 0 liefert — der eingebaute alphaTest discarded die Fragmente.
   */
  async _setupNodeClip() {
    try {
      const webgpu = await import("three/webgpu");
      const tsl = await import("three/tsl");
      const { uniform, float, select, distance, positionWorld } = tsl;

      this._uRNode = uniform(CIRCLE_R);
      this._uCNode = uniform(new THREE.Vector2(SPAWN[0], SPAWN[2]));
      this._uOnNode = uniform(1);

      const opacityNode = select(
        this._uOnNode.greaterThan(0.5)
          .and(distance(positionWorld.xz, this._uCNode).greaterThan(this._uRNode)),
        float(0),
        float(1),
      );

      const pickClass = (m) => {
        if (m.isMeshPhysicalMaterial) return webgpu.MeshPhysicalNodeMaterial;
        if (m.isMeshStandardMaterial) return webgpu.MeshStandardNodeMaterial;
        if (m.isMeshBasicMaterial)    return webgpu.MeshBasicNodeMaterial;
        if (m.isMeshPhongMaterial)    return webgpu.MeshPhongNodeMaterial;
        if (m.isMeshLambertMaterial)  return webgpu.MeshLambertNodeMaterial;
        return null;
      };

      const cache = new Map();
      const conv = (m) => {
        if (!m) return m;
        if (cache.has(m)) return cache.get(m);
        const Cls = pickClass(m);
        if (!Cls) return m;
        const nm = new Cls();
        nm.copy(m);
        // copy() von einem Nicht-Node-Material hinterlässt die Node-Slots
        // als undefined statt null — der TSL-Builder prüft auf !== null
        // und crasht dann ("isOutputStructNode of undefined"). Slots
        // generisch reparieren bevor wir unsere setzen.
        for (const k in nm) {
          if (k.endsWith("Node") && nm[k] === undefined) nm[k] = null;
        }
        // ACHTUNG: NodeMaterial.copy() überträgt nur Node-Slots plus die
        // Material-Basis-Props (blending, side, opacity …) — color, map,
        // roughness, metalness etc. bleiben auf Default (alles weiß!).
        // Oberflächen-Props deshalb generisch vom Quellmaterial nachziehen.
        for (const k in m) {
          if (k === "uuid" || k === "type" || k.endsWith("Node")) continue;
          const v = m[k];
          if (typeof v === "function") continue;
          try { nm[k] = v; } catch (_) { /* read-only Props überspringen */ }
        }
        nm.opacityNode = opacityNode;
        // Beides setzen: alphaTestNode (TSL-Slot) UND die klassische
        // Number-Property — letztere aktiviert den Alpha-Test-Zweig
        // im Material-Builder zuverlässig.
        nm.alphaTestNode = float(0.5);
        nm.alphaTest = 0.5;
        cache.set(m, nm);
        return nm;
      };
      const swap = (root) => {
        root?.traverse?.((o) => {
          if (!o.isMesh) return;
          o.material = Array.isArray(o.material)
            ? o.material.map(conv)
            : conv(o.material);
        });
      };

      const w = this.game.world;
      swap(w?.island?.root);
      swap(w?.road?.group);
      swap(w?.streetLamps?.group);
      swap(w?.harbor?.group);
      for (const mesh of [w?.nature?.trunkMesh, w?.nature?.blobMesh, w?.nature?.leafMesh]) {
        if (mesh?.material) mesh.material = conv(mesh.material);
      }
      console.log("[BootReveal] WebGPU node-clip aktiv (" + cache.size + " Materialien)");
      return true;
    } catch (e) {
      console.warn("[BootReveal] WebGPU node-clip fehlgeschlagen, Fallback:", e?.message);
      return false;
    }
  }

  _alwaysHidden() {
    const w = this.game.world;
    return [
      w?.ocean?.mesh,
      w?.sky?.mesh,
      w?.nature?.moteMesh,
      ...(w?.stationLabels?.labels?.map((l) => l.sprite) || []),
    ].filter(Boolean);
  }

  _fallbackHidden() {
    const w = this.game.world;
    const n = w?.nature;
    return [
      w?.island?.root,
      w?.road?.group,
      w?.streetLamps?.group,
      w?.harbor?.group,
      n?.trunkMesh, n?.blobMesh, n?.leafMesh,
    ].filter(Boolean);
  }

  _applyBootState() {
    if (!this.active || this._revealing) return;
    for (const obj of this._alwaysHidden()) obj.visible = false;
    if (!this._clipMode) {
      for (const obj of this._fallbackHidden()) obj.visible = false;
    }
    // Gras nur im Spawn-Kreis
    const a = this.game.world?.grass?.material?.userData?.adapter;
    a?.setMapCenter?.(SPAWN[0], SPAWN[2]);
    a?.setMapRadius?.(CIRCLE_R);
  }

  /** Start-Klick: Sturm zieht auf, Welt erscheint. */
  reveal() {
    if (!this.active || this._revealing) return;
    this._revealing = true;

    // Sicherheitsnetz: sollte irgendein Pfad hängen (Tween, Async-Race,
    // Treiber), wird der Clip nach 8s hart deaktiviert.
    setTimeout(() => {
      this._uRevealOn.value = 0;
      if (this._uOnNode) this._uOnNode.value = 0;
      const ga = this.game.world?.grass?.material?.userData?.adapter;
      ga?.setMapRadius?.(46);
      ga?.setMapCenter?.(0, 0);
      for (const obj of this._alwaysHidden()) obj.visible = true;
      for (const obj of this._fallbackHidden()) obj.visible = true;
    }, 8000);

    const w = this.game.world;
    if (this._savedFog) this.scene.fog = this._savedFog;
    for (const obj of this._alwaysHidden()) obj.visible = true;

    const grassAdapter = w?.grass?.material?.userData?.adapter;

    if (this._clipMode) {
      // Clip-Radius über die Insel expandieren — Ring wächst synchron mit
      this._tweens.push({
        delay: 0.05,
        dur: 2.1,
        ease: easeCubicIn,
        from: CIRCLE_R,
        to: REVEAL_MAX,
        apply: (v, t) => {
          this._uRevealR.value = v;
          if (this._uRNode) this._uRNode.value = v;
          this._ring.scale.setScalar(v / (CIRCLE_R + 0.08));
          this._ringMat.opacity = 1 - easeCubicOut(t);
          // Gras synchron zum Sturm freigeben (Cull-Kreis = Clip-Kreis,
          // gedeckelt auf den Insel-Radius)
          const gr = Math.min(46, v);
          grassAdapter?.setMapRadius?.(gr);
          const blend = Math.min(1, (v - CIRCLE_R) / 40);
          grassAdapter?.setMapCenter?.(SPAWN[0] * (1 - blend), SPAWN[2] * (1 - blend));
        },
        onDone: () => {
          this._uRevealOn.value = 0;
          if (this._uOnNode) this._uOnNode.value = 0;
          grassAdapter?.setMapRadius?.(46);
          grassAdapter?.setMapCenter?.(0, 0);
        },
      });
    } else {
      // Fallback: Welt einblenden + Gebäude-Pop
      for (const obj of this._fallbackHidden()) obj.visible = true;
      const roots = [];
      w?.island?.root?.traverse?.((o) => {
        if (o.name?.endsWith("_Root")) roots.push(o);
      });
      roots.forEach((node, i) => {
        node.scale.setScalar(0.001);
        this._tweens.push({
          delay: 0.25 + i * 0.12,
          dur: 0.55,
          ease: (t) => easeBackOut(t, 1.7),
          from: 0.001,
          to: 1,
          apply: (v) => node.scale.setScalar(Math.max(0.001, v)),
        });
      });
      this._tweens.push({
        delay: 0.1,
        dur: 2.0,
        ease: easeBackOut,
        from: CIRCLE_R,
        to: 46,
        apply: (v, t) => {
          grassAdapter?.setMapRadius?.(v);
          const blend = Math.min(1, t * 1.4);
          grassAdapter?.setMapCenter?.(SPAWN[0] * (1 - blend), SPAWN[2] * (1 - blend));
        },
      });
      this._tweens.push({
        delay: 0,
        dur: 1.4,
        ease: easeCubicOut,
        from: 0,
        to: 1,
        apply: (v) => {
          this._ring.scale.setScalar(1 + v * 9);
          this._ringMat.opacity = 1 - v;
        },
      });
    }

    // Blueprint-Boden + Scheibe ausblenden
    this._tweens.push({
      delay: 0.35,
      dur: 1.3,
      ease: easeCubicOut,
      from: 0,
      to: 1,
      apply: (v) => {
        this._floorMat.opacity = 1 - v;
        this._discMat.opacity = 1 - v;
      },
      onDone: () => this._teardown(),
    });
  }

  _teardown() {
    this.active = false;
    this.scene.remove(this._floor, this._disc, this._ring);
    this._floor.geometry.dispose();
    this._floorMat.dispose();
    this._floorTex.dispose();
    this._disc.geometry.dispose();
    this._discMat.dispose();
    this._ringGeo.dispose();
    this._ringMat.dispose();
  }

  update() {
    if (!this.active) return;
    const dt = this.game.time?.delta || 0.016;

    if (!this._revealing) {
      this._applyBootState();

      // Background dunkel halten (läuft NACH world.update → übersteuert
      // den DayCycle-Write)
      if (this.scene.background?.isColor) {
        this.scene.background.setHex(BLUEPRINT_BG);
      }

      // Fortschrittsbogen weich nachziehen, Puls wenn bereit
      const target = this._progress;
      this._shown = (this._shown ?? 0) + ((target - (this._shown ?? 0)) * Math.min(1, dt * 4));
      const ringCount = Math.floor(this._ringIndexCount * this._shown);
      this._ringGeo.setDrawRange(0, ringCount);
      this._ring.visible = ringCount > 0;
      if (this._progress >= 1) {
        const pulse = 0.8 + 0.2 * Math.sin((this.game.time?.elapsed || 0) * 2.6);
        this._ringMat.opacity = pulse;
      }
      return;
    }

    // Tweens abarbeiten
    for (let i = this._tweens.length - 1; i >= 0; i--) {
      const tw = this._tweens[i];
      tw.t = (tw.t ?? 0) + dt;
      const local = Math.min(1, Math.max(0, (tw.t - tw.delay) / tw.dur));
      if (local > 0) {
        tw.apply(tw.from + (tw.to - tw.from) * tw.ease(local), local);
      }
      if (local >= 1) {
        this._tweens.splice(i, 1);
        tw.onDone?.();
      }
    }
  }

  destroy() {
    if (this.active) this._teardown();
  }
}
