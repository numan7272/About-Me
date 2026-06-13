/**
 * Harbor — der Projekthafen am Wasser.
 *
 * Kuratierte GitHub-Projekte als anklickbare Fracht: pro Projekt eine
 * Holzkiste in Akzentfarbe auf dem Strand neben dem Container-Egg, dazu
 * ein kurzer Steg seewärts, Poller und eine bobbende Boje. Klick auf eine
 * Kiste öffnet die InfoCard mit Beschreibung, Stack und Repo-Link.
 *
 * Interaktion läuft über die bestehende Egg-Pipeline: jede Kiste wird mit
 * userData.eggId = "Project_<id>" in proximityTrigger.eggMeshes registriert
 * → EggClickHandler übernimmt Raycast, Hover-Puls und Click; das Routing
 * auf openProject() passiert dort anhand des "Project_"-Präfix.
 *
 * Reine Standard-Materials (kein Custom-Shader) — läuft identisch unter
 * WebGL und WebGPU und wird vom BootReveal-Clip mit erfasst.
 */

import * as THREE from "three";
import { PROJECTS, PROJECT_ORDER, getLang } from "../data/content.js";

const CRATE_SPACING = 1.9;     // m zwischen den Kisten entlang des Strands
const CRATE_SIZE = 1.05;       // Grundkante; pro Kiste leicht gejittert
const WOOD = 0x8a6a4d;
const WOOD_DARK = 0x5e4733;
const PLATE = 0xefe7d5;        // Cream-Labelplatte (Paper-Token)

export class Harbor {
  constructor(game, island) {
    this.game = game;
    this.scene = game.scene;
    this.island = island;
    this.group = new THREE.Group();
    this.group.name = "Harbor";
    this.exhibits = new Map();   // eggId → Kisten-Group
    this._buoy = null;
    this._t = 0;

    const anchor = this._findAnchor();
    if (!anchor) {
      console.warn("[Harbor] kein Anker gefunden — Hafen wird nicht gebaut");
      return;
    }
    this._build(anchor);
    this.scene.add(this.group);
    console.log(
      `[Harbor] gebaut — ${this.exhibits.size} Projekt-Kisten bei ` +
      `(${anchor.pos.x.toFixed(1)}, ${anchor.pos.z.toFixed(1)})`,
    );
  }

  /**
   * Anker = Container-Egg (steht bereits an den Docks). Seewärts-Richtung
   * ist vom Insel-Zentrum (≈ Ursprung) nach außen.
   */
  _findAnchor() {
    const egg = (this.island?.eggs || []).find(
      (e) => String(e.id).toLowerCase() === "container",
    );
    if (!egg?.position) return null;
    const pos = new THREE.Vector3(egg.position[0], 0, egg.position[2]);
    const dir = new THREE.Vector3(pos.x, 0, pos.z).normalize();   // seewärts
    const perp = new THREE.Vector3(-dir.z, 0, dir.x);             // entlang Strand
    return { pos, dir, perp };
  }

  _groundY(x, z) {
    const y = this.island?._sampleTerrainY?.(x, z);
    return typeof y === "number" && Number.isFinite(y) ? y : 0.25;
  }

  _build({ pos, dir, perp }) {
    const shore = this._findShore(pos, dir);
    if (shore) {
      this._buildPier(shore, dir, perp);
      this._buildBuoy(shore, dir);
    }
    this._buildCrates(pos, dir, perp);
  }

  /**
   * Uferlinie suchen: vom Anker seewärts in 0.5m-Schritten samplen, bis
   * das Terrain unter die Wasserlinie fällt. Der Container steht weiter
   * im Landesinneren — der Steg gehört aber ans echte Wasser.
   */
  _findShore(pos, dir) {
    const WATERLINE = 0.12;
    for (let d = 1; d <= 44; d += 0.5) {
      const x = pos.x + dir.x * d;
      const z = pos.z + dir.z * d;
      if (this._groundY(x, z) <= WATERLINE) {
        // 1.5m zurück an Land — Steg beginnt auf dem Strand
        return pos.clone().addScaledVector(dir, d - 1.5);
      }
    }
    return null;   // kein Ufer in Reichweite → kein Steg, nur Kisten
  }

  // ── Steg: Planken seewärts, Pfähle, zwei Poller ──────────────────────
  _buildPier(start, dir, perp) {
    const deckMat = new THREE.MeshStandardMaterial({ color: WOOD, roughness: 0.9 });
    const pileMat = new THREE.MeshStandardMaterial({ color: WOOD_DARK, roughness: 0.95 });

    const shoreY = this._groundY(start.x, start.z);
    const deckY = Math.max(shoreY, 0.05) + 0.42;
    const yaw = Math.atan2(dir.x, dir.z);

    // 5 Planken hintereinander Richtung See
    const plankGeo = new THREE.BoxGeometry(1.7, 0.07, 0.62);
    for (let i = 0; i < 5; i++) {
      const p = new THREE.Mesh(plankGeo, deckMat);
      const c = start.clone().addScaledVector(dir, 0.4 + i * 0.68);
      p.position.set(c.x, deckY, c.z);
      p.rotation.y = yaw;
      p.castShadow = true;
      p.receiveShadow = true;
      this.group.add(p);
    }

    // 4 Pfähle (paarweise) bis in den Sand/das Wasser
    const pileGeo = new THREE.CylinderGeometry(0.07, 0.09, 1.4, 8);
    for (const [along, side] of [[0.6, 0.7], [0.6, -0.7], [3.0, 0.7], [3.0, -0.7]]) {
      const pile = new THREE.Mesh(pileGeo, pileMat);
      const c = start.clone()
        .addScaledVector(dir, along)
        .addScaledVector(perp, side);
      pile.position.set(c.x, deckY - 0.62, c.z);
      pile.castShadow = true;
      this.group.add(pile);
    }

    // 2 Poller am Stegende
    const bollardGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.34, 10);
    for (const side of [0.62, -0.62]) {
      const b = new THREE.Mesh(bollardGeo, pileMat);
      const c = start.clone()
        .addScaledVector(dir, 3.2)
        .addScaledVector(perp, side);
      b.position.set(c.x, deckY + 0.2, c.z);
      b.castShadow = true;
      this.group.add(b);
    }
  }

  // ── Projekt-Kisten in einer Reihe entlang des Strands ────────────────
  _buildCrates(pos, dir, perp) {
    const lang = getLang();
    const projects = PROJECTS[lang] || PROJECTS.de;

    PROJECT_ORDER.forEach((id, i) => {
      const card = projects[id];
      if (!card) return;

      // Einseitige Reihe NEBEN dem Container (nicht zentriert — sonst
      // stecken die ersten Kisten im Container-Mesh), mit leichtem
      // Vor/Zurück-Stagger für den Frachtlager-Look.
      const c = pos.clone()
        .addScaledVector(perp, 2.5 + i * CRATE_SPACING)
        .addScaledVector(dir, -0.9 + (i % 2) * 0.55);
      const size = CRATE_SIZE * (0.92 + ((i * 37) % 17) / 100);   // determ. Jitter
      const y = this._groundY(c.x, c.z) + size / 2;

      const crate = this._makeCrate(card.accent || card.color, size);
      crate.position.set(c.x, y, c.z);
      crate.rotation.y = ((i * 53) % 23 - 11) * 0.022;
      crate.userData.eggId = `Project_${id}`;
      crate.userData.isClickableEgg = true;
      this.group.add(crate);
      this.exhibits.set(crate.userData.eggId, crate);
    });
  }

  _makeCrate(accentHex, size) {
    const g = new THREE.Group();
    const accent = new THREE.Color(accentHex || "#ffd28a");
    // Akzent leicht entsättigt — Poly-Look statt Plastikspielzeug
    const body = accent.clone().lerp(new THREE.Color(0x6b6258), 0.25);

    const bodyMat = new THREE.MeshStandardMaterial({ color: body, roughness: 0.85 });
    const ribMat = new THREE.MeshStandardMaterial({
      color: body.clone().multiplyScalar(0.62),
      roughness: 0.9,
    });
    const plateMat = new THREE.MeshStandardMaterial({ color: PLATE, roughness: 0.7 });

    const box = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size), bodyMat,
    );
    box.castShadow = true;
    box.receiveShadow = true;
    g.add(box);

    // Zwei horizontale Zurr-Rippen
    const ribGeo = new THREE.BoxGeometry(size * 1.04, size * 0.09, size * 1.04);
    for (const fy of [-0.28, 0.28]) {
      const rib = new THREE.Mesh(ribGeo, ribMat);
      rib.position.y = size * fy;
      rib.castShadow = true;
      g.add(rib);
    }

    // Cream-Labelplatte vorn (Richtung Land — dort fährt man vorbei)
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(size * 0.46, size * 0.3, 0.025), plateMat,
    );
    plate.position.set(0, size * 0.06, size / 2 + 0.013);
    g.add(plate);

    return g;
  }

  // ── Boje am Stegende, bobbt im update() ──────────────────────────────
  _buildBuoy(shore, dir) {
    const c = shore.clone().addScaledVector(dir, 5.6);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffd28a, roughness: 0.6 });
    const buoy = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mat);
    const tip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.34, 6),
      new THREE.MeshStandardMaterial({ color: 0x394742, roughness: 0.8 }),
    );
    tip.position.y = 0.26;
    buoy.add(tip);
    buoy.position.set(c.x, 0.0, c.z);
    this.group.add(buoy);
    this._buoy = buoy;
    this._buoyBaseY = 0.0;
  }

  /**
   * Registriert die Kisten in der bestehenden Click-Pipeline. Muss NACH
   * ProximityTrigger.spawnEggGlows() laufen (World._buildProximity).
   * Emissive-Snapshot analog zu registerMesh dort — der Hover-Puls in
   * ProximityTrigger.update() liest _origEmissive zum Zurücksetzen.
   */
  registerClickables() {
    const trigger = this.game.world?.proximityTrigger;
    if (!trigger?.eggMeshes) return;
    for (const [eggId, crate] of this.exhibits) {
      crate.traverse((child) => {
        if (child.isMesh && child.material) {
          child.userData._origEmissive = child.material.emissive?.clone?.();
          child.userData._origEmissiveIntensity = child.material.emissiveIntensity;
        }
      });
      trigger.eggMeshes.set(eggId, crate);
    }
  }

  /** Vom EggClickHandler gerufen (eggId mit "Project_"-Präfix). */
  openProject(eggId) {
    const id = String(eggId).replace(/^Project_/, "");
    const card = (PROJECTS[getLang()] || PROJECTS.de)[id];
    if (!card) {
      console.warn("[Harbor] unbekanntes Projekt:", eggId);
      return;
    }
    this.game.ui?.infoCard?.show(card, eggId);
  }

  update() {
    if (!this._buoy) return;
    this._t += this.game.time?.delta ?? 1 / 60;
    this._buoy.position.y = this._buoyBaseY + Math.sin(this._t * 1.3) * 0.07;
    this._buoy.rotation.z = Math.sin(this._t * 0.9) * 0.08;
    this._buoy.rotation.x = Math.cos(this._t * 1.1) * 0.06;
  }

  destroy() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose?.();
        o.material?.dispose?.();
      }
    });
    this.exhibits.clear();
    this._buoy = null;
  }
}
