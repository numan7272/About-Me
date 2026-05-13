/**
 * StationLabels3D — Sprite-Labels über jedem Gebäude.
 *
 * Vom HR-Recruiter-Audit als Kernanforderung identifiziert:
 *   "Stationen passieren ohne sichtbare Reaktion → wirkt kaputt."
 *   "3D-Schilder an jedem Gebäude, immer sichtbar."
 *
 * Implementation:
 *   - Pro Building ein THREE.Sprite mit Canvas-Texture
 *   - Canvas zeichnet einen kompakten Pill-Style-Label
 *     (Linie 1: Stationsname klein, Linie 2: Kurzbeschreibung größer)
 *   - Sprite skaliert mit Distanz (Bruno-Style):
 *       nah   → klein und transparent (Mesh ist sowieso sichtbar)
 *       mittel → maximal sichtbar
 *       weit  → noch sichtbar aber dezent
 *   - Wenn die aktuelle Walkthrough-Station auf das Building matched,
 *     pulsiert das Label (Highlight)
 */

import * as THREE from "three";
import { getStationsForLang } from "../../data/stations.js";

const LABEL_HEIGHT_OFFSET = 11.5;    // default-Höhe übers Dach
const LABEL_FRONT_OFFSET = 6.0;      // default-Abstand entlang frontWorld
const LABEL_BASE_SCALE = 6.0;        // World-Units Breite bei Default

// Pro-Station-Overrides — drei mögliche Override-Formen:
//   { height, front }       → relativ zu Building-Origin entlang frontWorld
//   { worldDelta: [x,y,z] } → addiert zur Default-Position
//   { worldPos:   [x,y,z] } → harte Absolutposition (ignoriert Default komplett)
//
// Diese Positionen sind aus den Building-Origins + Teleport-Punkten berechnet:
//   Label = Teleport-Punkt + 1m weiter weg vom Building, Y = Dachhöhe + 3m.
// Dadurch sitzt das Label IMMER vor dem Gebäude in der Luft und ist sichtbar
// wenn die Camera vom Teleport-Punkt aufs Gebäude blickt (zentrierte Walkthrough-View).
const POSITION_OVERRIDES = {
  haw:     { worldPos: [-25.24,  8.0, -24.78] },   // X -2 weiter links + Y -1 tiefer
  designa: { worldPos: [ 41.32,  8.0,  13.49] },
  yek:     { worldPos: [  0.80,  7.0,  40.11] },
  thg:     { worldPos: [-29.87,  8.0,  32.40] },   // X -2.5 gesamt nach links
  hq:      { worldPos: [ -3.79,  7.5,  15.82] },
};
const FADE_NEAR = 4;                 // unter dieser Distanz → fade aus
const FADE_FAR = 80;                 // über dieser Distanz → fade aus
const FADE_PEAK_NEAR = 12;           // unter dieser Distanz hat das Label volle Sichtbarkeit
const FADE_PEAK_FAR = 45;

// Canvas-Texture-Dimension — höher = schärfer, aber mehr GPU-Speicher
const TEX_W = 512;
const TEX_H = 192;

export class StationLabels3D {
  constructor(game, buildings) {
    this.game = game;
    this.scene = game.scene;
    this.buildings = buildings || [];
    this.labels = [];      // { id, sprite, material, building }
    this.activeStationId = null;

    this._tmpVec = new THREE.Vector3();

    this._buildLabels();
  }

  _buildLabels() {
    const lang = (typeof window !== "undefined" && window.__lang) || "de";
    const stations = getStationsForLang(lang);

    for (const b of this.buildings) {
      // building.id ist "HAW", "Designa", "Yek", "THG", "HQ"
      // Stationen-Keys sind klein: "haw", "designa", "yek", "thg", "hq"
      const key = b.id.toLowerCase();
      const station = stations[key];
      if (!station) continue;

      const tex = this._createLabelTexture(station);
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        opacity: 0.0,            // wird via update gefadet
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(LABEL_BASE_SCALE, LABEL_BASE_SCALE * (TEX_H / TEX_W), 1);

      // Position: horizontaler Offset entlang frontWorld (vor dem Gebäude)
      // und vertikaler Offset hoch übers Dach. So hängt der Text nie IM
      // Gebäude, sondern davor in der Luft.
      const fw = Array.isArray(b.frontWorld) ? b.frontWorld : [0, 0, 1];
      // Normalisieren, falls Frontvektor noch nicht normiert ist
      const flen = Math.hypot(fw[0], fw[2]) || 1;
      const fx = fw[0] / flen;
      const fz = fw[2] / flen;

      const override = POSITION_OVERRIDES[key] || {};
      let px, py, pz;
      if (Array.isArray(override.worldPos)) {
        // Absolute Welt-Position — ignoriert Building-Origin komplett
        px = override.worldPos[0];
        py = override.worldPos[1];
        pz = override.worldPos[2];
      } else {
        // Relativ zum Building-Origin entlang frontWorld
        const heightOff = override.height ?? LABEL_HEIGHT_OFFSET;
        const frontOff = override.front ?? LABEL_FRONT_OFFSET;
        px = b.position[0] + fx * frontOff;
        py = b.position[1] + heightOff;
        pz = b.position[2] + fz * frontOff;
        // Optional zusätzliches Welt-Delta drauf addieren (User-Fine-Tuning)
        if (Array.isArray(override.worldDelta)) {
          px += override.worldDelta[0] || 0;
          py += override.worldDelta[1] || 0;
          pz += override.worldDelta[2] || 0;
        }
      }
      sprite.position.set(px, py, pz);
      sprite.renderOrder = 5;
      this.scene.add(sprite);

      this.labels.push({
        id: key,
        building: b,
        sprite,
        material: mat,
        texture: tex,
        baseScale: LABEL_BASE_SCALE,
        station,
      });
    }
    console.log(`[StationLabels3D] ${this.labels.length} labels created`);
  }

  _createLabelTexture(station) {
    const c = document.createElement("canvas");
    c.width = TEX_W;
    c.height = TEX_H;
    const ctx = c.getContext("2d");

    // ── Hintergrund Pill ──
    const padding = 18;
    const radius = (TEX_H - padding * 2) * 0.45;
    ctx.fillStyle = "rgba(10, 18, 32, 0.85)";
    ctx.strokeStyle = station.accent || station.color || "rgba(255,255,255,0.5)";
    ctx.lineWidth = 4;
    this._roundedRect(
      ctx, padding, padding, TEX_W - padding * 2, TEX_H - padding * 2, radius,
    );
    ctx.fill();
    ctx.stroke();

    // ── Subtitle (Linie 1, klein, oben) ──
    ctx.font = "600 22px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = station.color || "#7ec8ff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      (station.subtitle || "").toUpperCase(),
      TEX_W / 2,
      padding + 44,
    );

    // ── Title (Linie 2, groß) ──
    ctx.font = "700 38px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "rgba(245, 250, 255, 0.96)";
    const titleY = TEX_H / 2 + 16;
    this._fitText(ctx, station.title || "", TEX_W - padding * 2 - 20, 38, titleY);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }

  _roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  _fitText(ctx, text, maxWidth, defaultSize, y) {
    let size = defaultSize;
    ctx.font = `700 ${size}px system-ui, -apple-system, sans-serif`;
    while (ctx.measureText(text).width > maxWidth && size > 18) {
      size -= 2;
      ctx.font = `700 ${size}px system-ui, -apple-system, sans-serif`;
    }
    ctx.fillText(text, TEX_W / 2, y);
  }

  /** Markiert eine Station als "aktiv" (durch Walkthrough) — pulsiert dann */
  setActiveStation(stationId) {
    this.activeStationId = stationId;
  }

  update() {
    const camera = this.game?.cameraRig?.camera;
    if (!camera) return;
    const time = this.game.time?.elapsed || 0;

    for (const l of this.labels) {
      this._tmpVec.copy(l.sprite.position);
      const dist = this._tmpVec.distanceTo(camera.position);

      // Fade-Curve: 0 unter FADE_NEAR, peak zwischen FADE_PEAK_NEAR und
      // FADE_PEAK_FAR, dann fade-out bis FADE_FAR
      let opacity;
      if (dist < FADE_NEAR) {
        opacity = 0;
      } else if (dist < FADE_PEAK_NEAR) {
        opacity = (dist - FADE_NEAR) / (FADE_PEAK_NEAR - FADE_NEAR);
      } else if (dist <= FADE_PEAK_FAR) {
        opacity = 1.0;
      } else if (dist < FADE_FAR) {
        opacity = 1.0 - (dist - FADE_PEAK_FAR) / (FADE_FAR - FADE_PEAK_FAR);
      } else {
        opacity = 0;
      }

      // Aktive Station: leichter Puls + nie ganz transparent
      if (l.id === this.activeStationId) {
        const pulse = 0.85 + Math.sin(time * 3.5) * 0.15;
        opacity = Math.max(opacity, 0.7) * pulse;
        l.sprite.scale.set(
          l.baseScale * (1.0 + Math.sin(time * 3.5) * 0.04),
          l.baseScale * (TEX_H / TEX_W) * (1.0 + Math.sin(time * 3.5) * 0.04),
          1,
        );
      } else {
        l.sprite.scale.set(l.baseScale, l.baseScale * (TEX_H / TEX_W), 1);
      }
      l.material.opacity = opacity;
    }
  }

  /** Sprache hat sich geändert → alle Texturen neu zeichnen */
  refresh() {
    const lang = (typeof window !== "undefined" && window.__lang) || "de";
    const stations = getStationsForLang(lang);
    for (const l of this.labels) {
      const station = stations[l.id];
      if (!station) continue;
      l.texture?.dispose?.();
      const tex = this._createLabelTexture(station);
      l.material.map = tex;
      l.texture = tex;
      l.station = station;
    }
  }

  destroy() {
    for (const l of this.labels) {
      this.scene?.remove?.(l.sprite);
      l.material?.dispose?.();
      l.texture?.dispose?.();
    }
    this.labels = [];
  }
}
