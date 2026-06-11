/**
 * BootReveal — 3D-Skeleton-Screen für den Lade-Moment.
 *
 * Während des Ladens existiert die Welt nur in einem kleinen Kreis um
 * den Bike-Spawn: ein Gras-Teppich (Grass-Shader mit mapRadius=4.4),
 * eine Plattform-Scheibe und das Bike. Außenrum liegt eine Blueprint-
 * Fläche (Architekten-Plane: Gitter + Kreuzchen, CanvasTexture). Der
 * Kreisrand ist ein leuchtender Ring, der als Fortschrittsbogen füllt
 * (geometry.drawRange — funktioniert unter WebGL und WebGPU identisch).
 *
 * Beim Start (reveal()):
 *   - Gras-Radius expandiert 4.4 → 46 (Back-Ease, leichter Overshoot)
 *   - Welt wird sichtbar, Gebäude poppen gestaffelt rein (Scale-Pop
 *     um ihren eigenen Ursprung)
 *   - Ring skaliert auf und blendet aus, Blueprint-Boden blendet aus
 *   - Fog + Himmel kehren zurück
 *
 * Kein custom Shader, keine Tween-Library — kleine eigene Tween-Liste.
 */

import * as THREE from "three";

const SPAWN = [-4.38, 0.12, 16.63];
const CIRCLE_R = 4.4;
const RING_COLOR = new THREE.Color(1.55, 1.22, 1.16);  // Peach, >1 → bloomt dezent
const BLUEPRINT_BG = 0x171219;

function easeBackOut(t, s = 1.4) {
  const u = t - 1;
  return 1 + u * u * ((s + 1) * u + s);
}
function easeCubicOut(t) {
  return 1 - Math.pow(1 - t, 3);
}

function buildBlueprintTexture() {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#241d2c";
  ctx.fillRect(0, 0, S, S);
  // Feines Gitter
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0.5, 0); ctx.lineTo(0.5, S);
  ctx.moveTo(0, 0.5); ctx.lineTo(S, 0.5);
  ctx.stroke();
  // Kreuzchen in der Zellmitte
  ctx.strokeStyle = "rgba(255,255,255,0.17)";
  ctx.lineWidth = 2;
  const m = S / 2, a = 7;
  ctx.beginPath();
  ctx.moveTo(m - a, m - a); ctx.lineTo(m + a, m + a);
  ctx.moveTo(m + a, m - a); ctx.lineTo(m - a, m + a);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(100, 100);   // 1 Zelle ≈ 4m bei 400m Plane
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
    this._savedFog = null;

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

    // ── Plattform-Scheibe im Kreis ──
    this._discMat = new THREE.MeshStandardMaterial({
      color: 0x2c3a20,
      roughness: 0.95,
      transparent: true,
    });
    this._disc = new THREE.Mesh(new THREE.CircleGeometry(CIRCLE_R, 48), this._discMat);
    this._disc.rotation.x = -Math.PI / 2;
    this._disc.position.set(SPAWN[0], 0.01, SPAWN[2]);
    this._disc.receiveShadow = true;
    this.scene.add(this._disc);

    // ── Leucht-Ring als Fortschrittsbogen ──
    // TorusGeometry-Indices laufen entlang der tubularen Segmente —
    // drawRange schneidet daraus einen sauberen Bogen.
    this._ringGeo = new THREE.TorusGeometry(CIRCLE_R + 0.12, 0.05, 8, 128);
    this._ringMat = new THREE.MeshBasicMaterial({
      color: RING_COLOR,
      toneMapped: false,
      transparent: true,
      fog: false,
    });
    this._ring = new THREE.Mesh(this._ringGeo, this._ringMat);
    this._ring.rotation.x = -Math.PI / 2;
    this._ring.position.set(SPAWN[0], 0.06, SPAWN[2]);
    this._ringIndexCount = this._ringGeo.index.count;
    this._ringGeo.setDrawRange(0, 0);
    this.scene.add(this._ring);

    // Welt-Teile verstecken sobald sie gebaut sind
    const res = this.game.world?.resources;
    res?.on?.("ready", () => {
      // World's eigener ready-Handler lief zuerst (Registrierungs-
      // Reihenfolge) — die Module existieren jetzt.
      this._applyWorldHidden();
    });

    // Fog aus (DayCycle überspringt fog-Updates wenn scene.fog null ist)
    this._savedFog = this.scene.fog;
    this.scene.fog = null;
  }

  /** Vom Game/Splash-Progress gefüttert (0..1). */
  setProgress(ratio) {
    this._progress = Math.max(this._progress, Math.min(1, ratio));
  }

  _worldPieces() {
    const w = this.game.world;
    const n = w?.nature;
    return [
      w?.island?.root,
      w?.ocean?.mesh,
      w?.sky?.mesh,
      w?.road?.group,
      w?.streetLamps?.group,
      n?.trunkMesh, n?.blobMesh, n?.leafMesh, n?.moteMesh,
      ...(w?.stationLabels?.labels?.map((l) => l.sprite) || []),
    ].filter(Boolean);
  }

  _applyWorldHidden() {
    if (!this.active || this._revealing) return;
    for (const obj of this._worldPieces()) obj.visible = false;
    // Gras nur im Kreis
    this.game.world?.grass?.material?.userData?.adapter?.setMapRadius?.(CIRCLE_R);
  }

  /** Start-Klick: Welt aufdecken. */
  reveal() {
    if (!this.active || this._revealing) return;
    this._revealing = true;

    const w = this.game.world;

    // Fog + Himmel zurück
    if (this._savedFog) this.scene.fog = this._savedFog;

    // Welt sichtbar
    for (const obj of this._worldPieces()) obj.visible = true;

    // Gebäude-Pop: jede *_Root-Node skaliert gestaffelt von 0 hoch
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
        apply: (v) => node.scale.setScalar(Math.max(0.001, v)),
        from: 0.001,
        to: 1,
      });
    });

    // Gras-Radius expandiert
    const grassAdapter = w?.grass?.material?.userData?.adapter;
    if (grassAdapter?.setMapRadius) {
      this._tweens.push({
        delay: 0.1,
        dur: 2.0,
        ease: easeBackOut,
        apply: (v) => grassAdapter.setMapRadius(v),
        from: CIRCLE_R,
        to: 46,
      });
    }

    // Ring: aufskalieren + ausblenden
    this._tweens.push({
      delay: 0,
      dur: 1.4,
      ease: easeCubicOut,
      apply: (v) => {
        this._ring.scale.setScalar(1 + v * 9);
        this._ringMat.opacity = 1 - v;
      },
      from: 0,
      to: 1,
    });

    // Blueprint-Boden + Scheibe ausblenden
    this._tweens.push({
      delay: 0.4,
      dur: 1.2,
      ease: easeCubicOut,
      apply: (v) => {
        this._floorMat.opacity = 1 - v;
        this._discMat.opacity = 1 - v;
      },
      from: 0,
      to: 1,
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
      // Versteckt halten (Module bauen teils async nach, z.B. Ocean/Sky)
      this._applyWorldHidden();

      // Background dunkel halten — DayCycle schreibt skyColorA pro Frame,
      // wir überschreiben danach (BootReveal.update läuft nach world.update)
      if (this.scene.background?.isColor) {
        this.scene.background.setHex(BLUEPRINT_BG);
      }

      // Fortschrittsbogen weich nachziehen + sanfter Puls wenn voll
      const target = this._progress;
      this._shown = (this._shown ?? 0) + ((target - (this._shown ?? 0)) * Math.min(1, dt * 4));
      this._ringGeo.setDrawRange(0, Math.floor(this._ringIndexCount * this._shown));
      if (this._progress >= 1) {
        const pulse = 0.85 + 0.15 * Math.sin((this.game.time?.elapsed || 0) * 2.6);
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
        tw.apply(tw.from + (tw.to - tw.from) * tw.ease(local));
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
