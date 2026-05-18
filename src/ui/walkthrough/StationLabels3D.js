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

// Canvas-Texture-Dimension. Höhere W:H Ratio jetzt (Landscape), damit mehr
// Platz für den italic-mono Title bei kleinerer Vertikal-Höhe in der 3D-Welt.
const TEX_W = 768;
const TEX_H = 240;

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

  /**
   * Editorial-paper Label. Bewusst NICHT brutalist-HUD wie der Rest der UI —
   * diese Labels sind in der 3D-Welt verankert (Architektur-Wayfinding) und
   * sollen sich wie Papier auf Schwarz anfühlen, nicht wie HUD-Glas.
   *
   *   ┌─────────────────────────────────────────┐
   *   │  // hq        ────────────  laufend     │   small mono caps
   *   │                                          │
   *   │  Was ich gerade baue.                   │   italic mono display
   *   │                                          │
   *   └─────────────────────────────────────────┘
   *    ^ 4px station-accent left edge (subtle identity)
   */
  _createLabelTexture(station) {
    const c = document.createElement("canvas");
    c.width = TEX_W;
    c.height = TEX_H;
    const ctx = c.getContext("2d");
    const dpr = 1;   // canvas ist schon high-res, Sprite scaliert es runter

    const PAD = 28;
    const ACCENT_W = 5;

    // Warm cream paper. Bewusst leicht transparent damit die 3D-Szene
    // dahinter durchschimmert und das Label als "Schwebe-Schild" wirkt,
    // nicht als opaker Aufkleber.
    ctx.fillStyle = "rgba(244, 238, 224, 0.93)";
    ctx.fillRect(0, 0, TEX_W, TEX_H);

    // Station-Accent als 4-5px Streifen links (Identity ohne dass das ganze
    // Label die Farbe trägt — viel ruhiger als der alte Cyan-Border-Pill).
    ctx.fillStyle = station.accent || station.color || "#1a1816";
    ctx.fillRect(0, 0, ACCENT_W, TEX_H);

    // Hairline-Doppelregel unter dem Header (subtle Editorial-Geste).
    ctx.strokeStyle = "rgba(26, 22, 18, 0.30)";
    ctx.lineWidth = 1 * dpr;
    ctx.beginPath();
    ctx.moveTo(PAD + 20, PAD + 38);
    ctx.lineTo(TEX_W - PAD, PAD + 38);
    ctx.stroke();

    // Header-Zeile: links "// id", rechts "timeframe", beides klein-mono.
    ctx.font = '500 22px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillStyle = "rgba(40, 32, 24, 0.62)";
    ctx.textBaseline = "alphabetic";

    ctx.textAlign = "left";
    ctx.fillText(`// ${(station.id || "").toLowerCase()}`, PAD + 20, PAD + 28);

    const tf = (station.timeframe || "").replace(/\s+/g, " ").trim();
    if (tf) {
      ctx.textAlign = "right";
      ctx.fillText(tf, TEX_W - PAD, PAD + 28);
    }

    // Title — italic mono display. Italic-Mono ist selten genug um nicht
    // sofort als "Editorial-Magazin"-Reflex zu lesen.
    const titleStr = station.title || "";
    let size = 52;
    const maxW = TEX_W - (PAD + 20) - PAD;
    do {
      ctx.font = `italic 500 ${size}px "JetBrains Mono", ui-monospace, monospace`;
      if (ctx.measureText(titleStr).width <= maxW) break;
      size -= 2;
    } while (size > 26);

    ctx.fillStyle = "rgba(20, 16, 12, 0.94)";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    // Vertikal grob mittig im verbleibenden Raum unter der Rule
    const titleY = PAD + 38 + (TEX_H - PAD - (PAD + 38)) * 0.62;
    ctx.fillText(titleStr, PAD + 20, titleY);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
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
