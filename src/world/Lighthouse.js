/**
 * Lighthouse — Leuchtturm auf einer Landzunge.
 *
 * Kiel-Förde-Stil: weißer, leicht konischer Turm mit zwei petrolfarbenen
 * Bändern, dunkle Galerie mit Reling, warm glühende Laterne unter einer
 * Kappe. Nachts (DayCycle.nightFactor) glüht die Laterne auf und ein
 * rotierendes Leuchtfeuer streicht über die See.
 *
 * Standort wird automatisch gesucht: vom Insel-Zentrum aus werden mehrere
 * Himmelsrichtungen seewärts gesampelt, gewählt wird die Landzunge, die
 * am weitesten ins Wasser ragt UND genug Abstand zu den Gebäuden hat.
 *
 * Reine Standard-Materials (kein Custom-Shader) → identisch unter WebGL
 * und WebGPU; wird vom BootReveal-Sturm-Clip miterfasst.
 */

import * as THREE from "three";

const WHITE = 0xf3efe6;        // Turm (Cream, kein Reinweiß — Poly-Look)
const PETROL = 0x1c2e2b;       // Bänder, Galerie, Kappe (--ink Familie)
const STONE = 0x4a5751;        // Felssockel
const WARM = 0xffd28a;         // Laterne / Leuchtfeuer (--signal)
const RED = 0xc0443a;          // Turm-Streifen (gedämpftes Leuchtturm-Rot)

export class Lighthouse {
  constructor(game, island) {
    this.game = game;
    this.scene = game.scene;
    this.island = island;
    this.group = new THREE.Group();
    this.group.name = "Lighthouse";
    this._t = 0;

    const spot = this._findHeadland();
    if (!spot) {
      console.warn("[Lighthouse] keine Landzunge gefunden — nicht gebaut");
      return;
    }
    this._build(spot);
    this.scene.add(this.group);
    console.log(
      `[Lighthouse] gebaut auf Landzunge bei ` +
      `(${spot.x.toFixed(1)}, ${spot.z.toFixed(1)})`,
    );
  }

  _groundY(x, z) {
    const y = this.island?._sampleTerrainY?.(x, z);
    return typeof y === "number" && Number.isFinite(y) ? y : 0.25;
  }

  /**
   * Sucht eine Landzunge: 16 Himmelsrichtungen, je seewärts marschieren bis
   * die Uferlinie unterschritten wird. Gewählt wird die Richtung mit der
   * weitesten Küste, die zugleich >14m von jedem Gebäude entfernt liegt.
   */
  _findHeadland() {
    const WATERLINE = 0.12;
    const buildings = this.island?.buildings || [];
    let best = null;

    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const dx = Math.sin(a);
      const dz = Math.cos(a);
      let shore = null;
      for (let d = 6; d <= 60; d += 0.5) {
        const x = dx * d;
        const z = dz * d;
        if (this._groundY(x, z) <= WATERLINE) {
          // 2.5m zurück an Land — der Turm steht auf festem Grund
          shore = { x: dx * (d - 2.5), z: dz * (d - 2.5), dist: d };
          break;
        }
      }
      if (!shore) continue;

      let minB = Infinity;
      for (const b of buildings) {
        const bx = b.position[0] - shore.x;
        const bz = b.position[2] - shore.z;
        minB = Math.min(minB, Math.hypot(bx, bz));
      }
      if (minB < 14) continue;            // zu nah an einem Gebäude
      if (!best || shore.dist > best.dist) best = shore;
    }
    if (best) best.y = this._groundY(best.x, best.z);
    return best;
  }

  _build(spot) {
    const baseY = Math.max(spot.y, 0.0);
    this.group.position.set(spot.x, baseY, spot.z);

    const matWhite = new THREE.MeshStandardMaterial({ color: WHITE, roughness: 0.8 });
    const matPetrol = new THREE.MeshStandardMaterial({ color: PETROL, roughness: 0.7, metalness: 0.2 });
    const matStone = new THREE.MeshStandardMaterial({ color: STONE, roughness: 0.95 });
    const matRed = new THREE.MeshStandardMaterial({ color: RED, roughness: 0.75 });

    // ── Felssockel ──
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.8, 1.6, 9), matStone,
    );
    plinth.position.y = 0.2;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    this.group.add(plinth);

    // ── Turm (konisch) ──
    const TOWER_H = 9.2;
    const towerBaseY = 0.9;
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 1.45, TOWER_H, 20), matWhite,
    );
    tower.position.y = towerBaseY + TOWER_H / 2;
    tower.castShadow = true;
    tower.receiveShadow = true;
    this.group.add(tower);

    // ── Zwei rote Bänder ──
    for (const fy of [0.34, 0.64]) {
      const r = 1.45 - (1.45 - 0.95) * fy;   // Turm-Radius an dieser Höhe
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(r + 0.04, r + 0.07, 1.0, 20), matRed,
      );
      band.position.y = towerBaseY + TOWER_H * fy;
      band.castShadow = true;
      this.group.add(band);
    }

    // ── Galerie + Reling ──
    const galleryY = towerBaseY + TOWER_H + 0.1;
    const gallery = new THREE.Mesh(
      new THREE.CylinderGeometry(1.55, 1.55, 0.28, 20), matPetrol,
    );
    gallery.position.y = galleryY;
    gallery.castShadow = true;
    this.group.add(gallery);

    const rail = new THREE.Mesh(
      new THREE.TorusGeometry(1.45, 0.05, 6, 24), matPetrol,
    );
    rail.rotation.x = Math.PI / 2;
    rail.position.y = galleryY + 0.5;
    this.group.add(rail);

    // ── Laternenraum (Glas, warm) ──
    const lampY = galleryY + 0.95;
    this.lampGlassMat = new THREE.MeshStandardMaterial({
      color: WARM,
      emissive: new THREE.Color(WARM),
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.5,
      roughness: 0.25,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 0.95, 1.3, 16, 1, true), this.lampGlassMat,
    );
    glass.position.y = lampY;
    this.group.add(glass);

    // Leuchtkern — kräftig emissiv, damit Bloom ihn nachts aufgreift
    this.lampCoreMat = new THREE.MeshStandardMaterial({
      color: WARM,
      emissive: new THREE.Color(WARM),
      emissiveIntensity: 0.6,
      toneMapped: false,
    });
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 12), this.lampCoreMat);
    core.position.y = lampY;
    this.group.add(core);

    // ── Kappe + Finial ──
    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(1.15, 1.15, 16), matPetrol,
    );
    cap.position.y = lampY + 1.25;
    cap.castShadow = true;
    this.group.add(cap);
    const finial = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8), matPetrol,
    );
    finial.position.y = lampY + 1.95;
    this.group.add(finial);

    // ── Leuchtfeuer: EIN Strahl, schwenkt seewärts über die See ──
    // Basis-Yaw so wählen, dass der Strahl (lokal +X) vom Inselzentrum weg
    // aufs offene Wasser zeigt; im update() pendelt er nur in diesem
    // Seeward-Bogen, nie zurück über die Insel.
    const sea = new THREE.Vector2(spot.x, spot.z);
    if (sea.lengthSq() < 1e-4) sea.set(0, 1);
    sea.normalize();
    this._beamBaseYaw = Math.atan2(-sea.y, sea.x);

    this.beamGroup = new THREE.Group();
    this.beamGroup.position.y = lampY;
    this.beamGroup.rotation.y = this._beamBaseYaw;
    this.beamMat = new THREE.MeshBasicMaterial({
      color: WARM,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: false,
    });
    // Kegel zeigt per Default +Y; waagerecht kippen, Basis (breites Ende)
    // nach außen, Spitze an der Laterne. Leicht nach unten Richtung Wasser.
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(2.2, 30, 16, 1, true), this.beamMat,
    );
    beam.rotation.z = Math.PI / 2;            // Achse entlang X (seewärts)
    beam.position.set(15, -1.6, 0);           // nach außen + leicht abwärts
    beam.rotation.x = 0.06;
    this.beamGroup.add(beam);

    // Echtes Spotlight, am Strahl montiert → leuchtet mit nach See und
    // streicht über das Wasser, trifft nie die Insel hinter dem Turm.
    this.lampSpot = new THREE.SpotLight(WARM, 0.0, 75, 0.46, 0.5, 1.3);
    this.lampSpot.position.set(0, 0, 0);
    this.lampSpot.target.position.set(26, -9, 0);   // +X (seewärts) und abwärts
    this.beamGroup.add(this.lampSpot);
    this.beamGroup.add(this.lampSpot.target);

    this.group.add(this.beamGroup);
  }

  update() {
    if (!this.beamGroup) return;
    const dt = this.game.time?.delta ?? 1 / 60;
    this._t += dt;

    // Nacht-Faktor vom DayCycle (0=Tag, 1=Nacht)
    const nf = this.game.world?.dayCycle?.live?.nightFactor ?? 0;

    // Laterne glüht mit der Nacht auf
    if (this.lampCoreMat) this.lampCoreMat.emissiveIntensity = 0.4 + nf * 3.0;
    if (this.lampGlassMat) this.lampGlassMat.emissiveIntensity = 0.3 + nf * 1.6;

    // Strahl pendelt seewärts hin und her (kein Vollkreis über die Insel)
    const SWEEP = 1.1;          // ±63° um die Seerichtung
    this.beamGroup.rotation.y =
      this._beamBaseYaw + Math.sin(this._t * 0.4) * SWEEP;

    const vis = nf > 0.04;
    const pulse = 0.85 + 0.15 * Math.sin(this._t * 2.2);
    for (const c of this.beamGroup.children) {
      if (c.isMesh) c.visible = vis;
    }
    if (this.beamMat) this.beamMat.opacity = vis ? nf * 0.2 * pulse : 0;
    if (this.lampSpot) this.lampSpot.intensity = nf * 7.0;
  }

  destroy() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose?.();
        o.material?.dispose?.();
      }
    });
    this.beamGroup = null;
  }
}
