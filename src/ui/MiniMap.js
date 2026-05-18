/**
 * MiniMap — Canvas-basierte Insel-Übersicht oben rechts.
 *
 * Zeigt:
 *   - Insel-Outline (Kreis als Approximation)
 *   - Road-Curve als dunkler Pfad
 *   - 5 Buildings als farbige Punkte mit Labels
 *   - Bike als pulsierender weißer Dot mit Heading-Pfeil
 *
 * Canvas-Größe: 200x200px, Welt-Range: ±60m vom Center.
 */

import { TELEPORT_POINTS } from "../data/stations.js";

const SIZE = 200;
const WORLD_RANGE = 60;           // ±60m wird auf Canvas gemappt

// Brutalist-Mono palette. Map ist Telemetrie — Buildings unterscheiden sich
// über Position + Label, nicht über Regenbogen. Aktive Tour-Station kann
// optional in --signal eingefärbt werden.
const PAPER       = "oklch(94% 0.015 75)";
const PAPER_MUTED = "oklch(72% 0.02 75)";
const PAPER_DIM   = "oklch(55% 0.02 70)";
const INK_SOFT    = "oklch(20% 0.02 250)";
const SIGNAL      = "oklch(72% 0.22 25)";

export class MiniMap {
  constructor(game) {
    this.game = game;

    // Wrapper — auf Mobile kleiner (130px statt 200px). Rechteckig,
    // hairline-border, kein blur, brutalist register.
    const isMobile = window.matchMedia?.("(max-width: 600px)")?.matches;
    const mapSize = isMobile ? 130 : SIZE;
    this._renderSize = mapSize;
    this.root = document.createElement("div");
    this.root.className = "hud-bracket";
    Object.assign(this.root.style, {
      position: "fixed",
      top: isMobile ? "70px" : "84px",
      right: isMobile ? "12px" : "20px",
      width: `${mapSize}px`,
      height: `${mapSize}px`,
      overflow: "hidden",
      background: "var(--ink-solid)",
      color: "var(--paper)",
      pointerEvents: "auto",
      cursor: "pointer",
      zIndex: "11",
      transition: "width 280ms var(--ease), height 280ms var(--ease)",
    });
    const cornerTr = document.createElement("span");
    cornerTr.className = "hud-bracket-tr";
    const cornerBl = document.createElement("span");
    cornerBl.className = "hud-bracket-bl";
    this.root.append(cornerTr, cornerBl);

    // Canvas
    this.canvas = document.createElement("canvas");
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    Object.assign(this.canvas.style, {
      width: "100%",
      height: "100%",
      display: "block",
    });
    this.root.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");

    document.body.appendChild(this.root);

    // Cached Static-Layer (Insel + Road + Buildings — ändert sich nicht)
    this._staticCacheReady = false;
    this._staticCanvas = document.createElement("canvas");
    this._staticCanvas.width = SIZE;
    this._staticCanvas.height = SIZE;
    this._staticCtx = this._staticCanvas.getContext("2d");

    // Throttling — Canvas-Update nur alle 100ms
    this._lastUpdate = 0;

    // Click-Handler: zum nächsten Building teleportieren
    this._onClick = (e) => this._handleClick(e);
    this.canvas.addEventListener("click", this._onClick);

    // ── Toggle-Button (Map zuklappen) ──
    // Auf Mobile auto-collapsed, auf Desktop initial offen.
    this._mapSize = mapSize;
    this._mapTop = isMobile ? 70 : 84;
    this._mapRight = isMobile ? 12 : 20;
    this._collapsed = false;
    this._buildToggleButton(isMobile);
  }

  _buildToggleButton(isMobile) {
    this.toggleBtn = document.createElement("button");
    this.toggleBtn.type = "button";
    this.toggleBtn.setAttribute("aria-label", "collapse map");
    this.toggleBtn.textContent = "[−]";
    Object.assign(this.toggleBtn.style, {
      position: "fixed",
      top: `${this._mapTop - 4}px`,
      right: `${this._mapRight - 4}px`,
      padding: "4px 6px",
      border: "0",
      background: "transparent",
      color: "var(--paper-muted)",
      fontFamily: "var(--font-mono)",
      fontSize: "11px",
      lineHeight: "1",
      cursor: "pointer",
      zIndex: "12",
      transition: "color 180ms var(--ease)",
    });
    this.toggleBtn.addEventListener("mouseenter", () => {
      this.toggleBtn.style.color = "var(--signal)";
    });
    this.toggleBtn.addEventListener("mouseleave", () => {
      this.toggleBtn.style.color = "var(--paper-muted)";
    });
    this.toggleBtn.addEventListener("click", () => this.toggleCollapsed());
    document.body.appendChild(this.toggleBtn);

    // Auf Mobile auto-collapse initial — User klappt manuell auf wenn er die
    // Karte braucht. Spart Screen-Estate.
    if (isMobile) {
      // Erst nach kurzer Verzögerung damit die Karte initial 1× sichtbar war
      setTimeout(() => this.setCollapsed(true), 1500);
    }
  }

  setCollapsed(collapsed) {
    this._collapsed = collapsed;
    if (collapsed) {
      this.root.style.width = "44px";
      this.root.style.height = "44px";
      this.root.style.pointerEvents = "auto";
      this.canvas.style.opacity = "0.0";
      this.toggleBtn.textContent = "[ + ]";
      this.toggleBtn.setAttribute("aria-label", "expand map");
      this.toggleBtn.style.top = `${this._mapTop + 14}px`;
      this.toggleBtn.style.right = `${this._mapRight + 12}px`;
      this.root.style.cursor = "pointer";
    } else {
      this.root.style.width = `${this._mapSize}px`;
      this.root.style.height = `${this._mapSize}px`;
      this.canvas.style.opacity = "1.0";
      this.toggleBtn.textContent = "[−]";
      this.toggleBtn.setAttribute("aria-label", "collapse map");
      this.toggleBtn.style.top = `${this._mapTop - 4}px`;
      this.toggleBtn.style.right = `${this._mapRight - 4}px`;
    }
  }

  toggleCollapsed() {
    this.setCollapsed(!this._collapsed);
  }

  /**
   * Click auf MiniMap → finde nächstes Building zur Click-Welt-Position →
   * teleportiere Bike zum vom User vermessenen TELEPORT_POINT dieser Station.
   * Die exakten Koordinaten kommen aus stations.js (vom User per Konsole
   * abgelesen, indem er hingefahren ist).
   */
  _handleClick(e) {
    // Wenn Karte zugeklappt ist, Click → aufklappen statt teleportieren
    if (this._collapsed) {
      this.setCollapsed(false);
      return;
    }

    const island = this.game.world?.island;
    const player = this.game.world?.player;
    if (!island || !player?.body) return;

    // Click-Koords relativ zum Canvas
    const rect = this.canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (SIZE / rect.width);
    const cy = (e.clientY - rect.top) * (SIZE / rect.height);

    // Canvas-Pixel → Welt-Koords
    const wx = (cx / SIZE) * (2 * WORLD_RANGE) - WORLD_RANGE;
    const wz = (cy / SIZE) * (2 * WORLD_RANGE) - WORLD_RANGE;

    // Nächstes Building suchen (max 18m Distanz)
    let nearest = null;
    let nearestDist = 18 * 18;
    for (const b of island.buildings) {
      const [bx, , bz] = b.position;
      const d2 = (bx - wx) ** 2 + (bz - wz) ** 2;
      if (d2 < nearestDist) {
        nearestDist = d2;
        nearest = b;
      }
    }
    if (!nearest) return;

    // building.id ist "HAW", "Designa", "Yek", "THG", "HQ" — Stations-Keys
    // sind klein. TELEPORT_POINTS hat die vom User vermessenen Bike-Spawn-
    // Koordinaten. Fallback: 5m vor dem Building entlang frontWorld.
    const key = String(nearest.id || "").toLowerCase();
    const tp = TELEPORT_POINTS[key];

    let targetX, targetY, targetZ;
    if (tp) {
      targetX = tp[0];
      targetY = tp[1] + 0.8;        // leicht angehoben damit Bike sauber fällt
      targetZ = tp[2];
    } else {
      // Fallback (sollte nie greifen, da alle 5 Buildings in TELEPORT_POINTS sind)
      const [bx, , bz] = nearest.position;
      const fw = nearest.frontWorld || [0, 0, 1];
      const DIST = 5;
      targetX = bx + fw[0] * DIST;
      targetZ = bz + fw[2] * DIST;
      const groundY = island._sampleTerrainY
        ? island._sampleTerrainY(targetX, targetZ)
        : 0.3;
      targetY = groundY + 1.0;
    }

    // Yaw: Bike soll zum Building schauen — Richtungsvektor vom Spawn-Punkt
    // ZUM Building. Bike-Forward in Three = +Z, also atan2(-dx, -dz) damit
    // +Z des Bikes Richtung Building zeigt.
    const [bx, , bz] = nearest.position;
    const dx = bx - targetX;
    const dz = bz - targetZ;
    const yaw = Math.atan2(dx, dz);    // direkt: 0=+Z, also Bike schaut auf Building
    const half = yaw / 2;

    player.body.setTranslation({ x: targetX, y: targetY, z: targetZ }, true);
    player.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    player.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    player.body.setRotation(
      { x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) },
      true,
    );

    // Camera-Snap zurück hinter Bike + laufenden Fly cancellen
    if (this.game.cameraRig) {
      this.game.cameraRig.cancelFly?.();
      this.game.cameraRig.followMode = true;
    }

    console.log(`[MiniMap] teleported to ${nearest.id} at`, [targetX, targetY, targetZ]);
  }

  /** Welt-Koords → Canvas-Pixel */
  _w2c(x, z) {
    const cx = (x + WORLD_RANGE) / (2 * WORLD_RANGE) * SIZE;
    const cy = (z + WORLD_RANGE) / (2 * WORLD_RANGE) * SIZE;
    return [cx, cy];
  }

  /** Baut Static-Layer einmalig (Insel + Road + Buildings) */
  _buildStaticLayer() {
    const ctx = this._staticCtx;
    const island = this.game.world?.island;
    const road = this.game.world?.road;
    if (!island || !road?.curve) return false;

    ctx.clearRect(0, 0, SIZE, SIZE);

    // 1) Insel-Outline (Hairline-Kreis als Approximation)
    ctx.strokeStyle = INK_SOFT;
    ctx.fillStyle = INK_SOFT;
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = PAPER_DIM;
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE * 0.42, 0, Math.PI * 2);
    ctx.stroke();

    // 2) Road-Curve als dünner Mono-Pfad
    const curve = road.curve;
    const pts = curve.getSpacedPoints(80);
    ctx.strokeStyle = PAPER_MUTED;
    ctx.lineWidth = 1.2;
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const [cx, cy] = this._w2c(pts[i].x, pts[i].z);
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.closePath();
    ctx.stroke();

    // 3) Buildings als 1x4 px crosshair + Mono-Label. Alle gleich, keine Farb-Hierarchie.
    ctx.font = "9px ui-monospace, 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    for (const b of island.buildings) {
      const [bx, , bz] = b.position;
      const [cx, cy] = this._w2c(bx, bz);

      // Crosshair statt Punkt
      ctx.strokeStyle = PAPER;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy);
      ctx.lineTo(cx + 4, cy);
      ctx.moveTo(cx, cy - 4);
      ctx.lineTo(cx, cy + 4);
      ctx.stroke();

      // Label klein-mono
      ctx.fillStyle = PAPER_MUTED;
      ctx.fillText((b.id || "").toLowerCase(), cx, cy - 8);
    }

    return true;
  }

  update() {
    const now = performance.now();
    if (now - this._lastUpdate < 100) return;
    this._lastUpdate = now;

    // Static-Layer einmalig bauen sobald Insel + Road bereit sind
    if (!this._staticCacheReady) {
      this._staticCacheReady = this._buildStaticLayer();
      if (!this._staticCacheReady) return;
    }

    const ctx = this.ctx;
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Static-Layer drauf kopieren
    ctx.drawImage(this._staticCanvas, 0, 0);

    // Bike-Punkt
    const player = this.game.world?.player;
    if (!player?.body) return;
    const t = player.body.translation();
    const r = player.body.rotation();
    const [bx, by] = this._w2c(t.x, t.z);

    // Heading aus Quaternion (yaw um Y)
    // forward-vector = (0,0,1) angewendet auf quaternion → projiziert auf XZ
    // einfacher: yaw = atan2(2*(w*y + x*z), 1 - 2*(y*y + z*z))
    const yaw = Math.atan2(
      2 * (r.w * r.y + r.x * r.z),
      1 - 2 * (r.y * r.y + r.z * r.z),
    );
    // Pfeil-Richtung — Bike-Forward zeigt in +Z World, in Canvas-Space gleich
    const dirX = Math.sin(yaw);
    const dirZ = Math.cos(yaw);

    // Pfeil-Spitze 7px vor Position
    const tipX = bx + dirX * 7;
    const tipY = by + dirZ * 7;
    const baseLX = bx - dirZ * 4 - dirX * 3;
    const baseLY = by + dirX * 4 - dirZ * 3;
    const baseRX = bx + dirZ * 4 - dirX * 3;
    const baseRY = by - dirX * 4 - dirZ * 3;

    // Heading-Pfeil in --signal (coral). Kein Glow, nur scharfer Pfeil.
    ctx.fillStyle = SIGNAL;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(baseLX, baseLY);
    ctx.lineTo(baseRX, baseRY);
    ctx.closePath();
    ctx.fill();
  }

  destroy() {
    this.canvas?.removeEventListener?.("click", this._onClick);
    this.root?.remove?.();
    this.toggleBtn?.remove?.();
  }
}
