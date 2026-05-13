/**
 * ProximityTrigger — überwacht Bike-Position, feuert onEnter/onExit-Events
 * für Buildings + Easter-Eggs. Die UI-Reaktion (Walkthrough-Trigger, Mini-
 * Game-Start, Discovery-Mark) wird von außen registriert.
 *
 * Aktuell:
 *   - Egg-Glow-Sphere wird unsichtbar wenn discovered
 *   - DiscoveryHud markDiscovered bei Egg-Enter (Counter + Toast)
 *   - KEINE automatische InfoCard mehr — Walkthrough kommt separat
 */

import * as THREE from "three";
import { LANDMARKS, EGGS, getLang } from "../data/content.js";

const BUILDING_RADIUS = 6;
const EGG_RADIUS = 2.5;
const EGG_GLOW_RADIUS = 0.5;

export class ProximityTrigger {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;

    // State pro Trigger
    this.activeId = null;       // aktuell offenes Building/Egg
    this.lastInsideId = null;   // gerade-noch-drin-ID (damit re-entry möglich)

    // Egg-Visuals (kleine Glow-Sphere am Spawn-Punkt jedes Eggs)
    this.eggMeshes = new Map();   // id → THREE.Mesh

    // Time für Pulse-Animation
    this._t = 0;

    // Highlight-State (Walkthrough-Killer-Moment) — z.B. "Router" wenn die
    // Tour bei Yek angekommen ist. null = niemand highlighted.
    this._highlightedEggId = null;
  }

  /** Setzt ein Egg in Highlight-Mode (stärkerer Puls + größer + heller).
   *  Case-insensitive Match — egg-Keys aus dem GLB sind groß ("Router"),
   *  aber `eggHint` in stations.js ist klein ("router"). Wir normalisieren. */
  highlightEgg(id) {
    if (!id) {
      this._highlightedEggId = null;
      return;
    }
    const want = String(id).toLowerCase();
    let match = null;
    for (const key of this.eggMeshes.keys()) {
      if (String(key).toLowerCase() === want) {
        match = key;
        break;
      }
    }
    this._highlightedEggId = match;
  }

  /** Entfernt jeglichen Highlight-State. */
  clearHighlight() {
    this._highlightedEggId = null;
  }

  /** Eggs die ein interaktives Mini-Game haben (Click statt Proximity).
   *  Mapping zu MiniGames:
   *    Router → RouterPentest (nmap/telnet/Default-Creds)
   *  HQ ist ein BUILDING, kein Egg — wird in EggClickHandler separat
   *  als Click-Target registriert.
   */
  static CLICKABLE_EGGS = new Set([
    "Router", "router",
  ]);

  /** Registriert die ECHTEN GLB-Egg-Meshes (Egg_Router_joined, Egg_Container_joined)
   *  als klickbare Targets. Keine zusätzliche Glow-Kugel mehr — das Egg bleibt
   *  visuell so wie in Blender, nur Cursor wird Pointer bei Hover und Material
   *  pulsiert leicht bei Nähe.
   *
   *  Auffindbarkeit: Egg ist absichtlich versteckt. Optional kann der User
   *  den Tooltip "🔒 Hack me" sehen wenn er nah dran ist (Proximity-Aktivierung). */
  spawnEggGlows() {
    const island = this.game.world?.island;
    if (!island) return;

    const registerMesh = (idRaw, mesh) => {
      if (!mesh) {
        console.warn(`[Proximity] no mesh for clickable id "${idRaw}"`);
        return;
      }
      mesh.userData.eggId = idRaw;
      mesh.userData.isClickableEgg = true;

      // Original-Materials snapshotten damit wir bei Hover sanft "leuchten" können
      mesh.traverse((child) => {
        if (child.isMesh && child.material) {
          child.userData._origEmissive = child.material.emissive?.clone?.();
          child.userData._origEmissiveIntensity = child.material.emissiveIntensity;
        }
      });

      this.eggMeshes.set(idRaw, mesh);
    };

    // Egg-Meshes
    for (const e of island.eggs || []) {
      if (!ProximityTrigger.CLICKABLE_EGGS.has(e.id)) continue;
      registerMesh(e.id, e.mesh);
    }

    // HQ-Building (kein Egg, aber als Click-Target registriert für NumanOS)
    const hq = (island.buildings || []).find((b) => b.id === "HQ");
    if (hq?.mesh) {
      registerMesh("HQ", hq.mesh);
    }

    console.log(`[Proximity] registered ${this.eggMeshes.size} clickable meshes`);
  }

  /** Hide-Glow für ein Egg sobald discovered */
  _hideEggGlow(id) {
    const mesh = this.eggMeshes.get(id);
    if (mesh) {
      mesh.visible = false;
    }
  }

  update() {
    const player = this.game.world?.player;
    const island = this.game.world?.island;
    if (!player?.body || !island) return;

    this._t += this.game.time.delta;

    // Egg-Animationen — kein Floating/Spinning mehr für GLB-Meshes (Router
    // soll dort sitzen wo er platziert wurde). Stattdessen subtiles Emissive-
    // Pulsing bei Hover oder Highlight (Walkthrough-Killer-Moment).
    for (const [id, mesh] of this.eggMeshes) {
      if (!mesh.visible) continue;
      const isHighlighted = id === this._highlightedEggId;
      const isHovered = !!mesh.userData?.hovered;
      const pulse = (Math.sin(this._t * 4.0) + 1) * 0.5;   // 0..1
      let emissiveIntensity = 0;
      if (isHighlighted) emissiveIntensity = 0.7 + pulse * 0.5;
      else if (isHovered) emissiveIntensity = 0.4 + pulse * 0.3;
      mesh.traverse((child) => {
        if (child.isMesh && child.material) {
          if (emissiveIntensity > 0) {
            child.material.emissive?.setHex?.(0xffeebb);
            child.material.emissiveIntensity = emissiveIntensity;
          } else {
            // Zurück auf Original
            const orig = child.userData._origEmissive;
            if (orig && child.material.emissive) {
              child.material.emissive.copy(orig);
            }
            child.material.emissiveIntensity =
              child.userData._origEmissiveIntensity ?? 0;
          }
          child.material.needsUpdate = true;
        }
      });
    }

    const t = player.body.translation();
    const px = t.x;
    const pz = t.z;

    // 1) Egg-Proximity check (höhere Priorität)
    // CLICKABLE_EGGS (Router/HQ) sind ausgenommen — die werden per Click
    // getriggert nicht per Reinfahren. Sonst stört das Mini-Game UX.
    let triggered = null;
    for (const e of island.eggs) {
      if (ProximityTrigger.CLICKABLE_EGGS.has(e.id)) continue;
      const dx = e.position[0] - px;
      const dz = e.position[2] - pz;
      const d2 = dx * dx + dz * dz;
      if (d2 < EGG_RADIUS * EGG_RADIUS) {
        triggered = { type: "egg", id: e.id };
        break;
      }
    }

    // 2) Building-Proximity (wenn kein Egg getriggert)
    if (!triggered) {
      for (const b of island.buildings) {
        const dx = b.position[0] - px;
        const dz = b.position[2] - pz;
        const d2 = dx * dx + dz * dz;
        if (d2 < BUILDING_RADIUS * BUILDING_RADIUS) {
          triggered = { type: "building", id: b.id };
          break;
        }
      }
    }

    if (triggered) {
      // Erst-Trigger oder Wechsel auf andere ID
      if (triggered.id !== this.lastInsideId) {
        this.lastInsideId = triggered.id;
        this._openCard(triggered);
      }
    } else {
      // Wir sind draußen — lastInsideId resetten damit beim nächsten
      // Reinfahren der Trigger wieder feuert
      this.lastInsideId = null;
    }
  }

  _openCard(trig) {
    // Keine automatische InfoCard mehr — Walkthrough wird das später
    // übernehmen. Hier nur Discovery-Mark für Eggs.
    const lang = getLang();
    const ui = this.game.ui;

    if (trig.type === "egg") {
      const data = EGGS[lang]?.[trig.id];
      const title = data?.title;
      const isNew = ui?.discoveryHud?.markDiscovered?.(trig.id, title);
      if (isNew) this._hideEggGlow(trig.id);
    }
    // Building-Enter macht aktuell nichts — kommt mit Walkthrough.
  }

  destroy() {
    for (const [, mesh] of this.eggMeshes) {
      this.scene.remove(mesh);
      mesh.geometry?.dispose?.();
      mesh.material?.dispose?.();
    }
    this.eggMeshes.clear();
  }
}
