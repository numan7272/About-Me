import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { TELEPORT_POINTS } from "../data/stations.js";

/** Study and security discoveries placed beside their corresponding island areas. */
export class ExperienceExhibits {
  constructor(game, island) {
    this.game = game;
    this.island = island;
    this.group = new THREE.Group();
    this.group.name = "Experience_stations";
    this.exhibits = new Map();
    this.colliders = [];
    this._boxMaterials = new WeakMap();
    const [hx, , hz] = TELEPORT_POINTS.haw;
    this._build("erasmus", hx + 3.8, hz - 1.5, .45);
    const harbor = island.eggs.find((egg) => String(egg.id).toLowerCase() === "container");
    const [cx, , cz] = harbor?.position || [9.3, 0, 15.5];
    this._build("security", cx + 5.4, cz + 3.0, .35);
    game.scene.add(this.group);
    const addColliders = () => {
      if (this.destroyed || !game.physics?.world) return;
      for (const prop of this.exhibits.values()) {
        const { x, y, z } = prop.position;
        const shape = game.physics.RAPIER.ColliderDesc.cuboid(1.15, 1.1, .85)
          .setTranslation(x, y + 1.1, z)
          .setRotation({ x: 0, y: Math.sin(prop.rotation.y / 2), z: 0, w: Math.cos(prop.rotation.y / 2) });
        this.colliders.push(game.physics.world.createCollider(shape));
      }
    };
    if (game.physics?.ready) addColliders();
    else game.physics?.on("ready", addColliders);
  }

  _box(group, size, position, color) {
    let palette = this._boxMaterials.get(group);
    if (!palette) this._boxMaterials.set(group, palette = new Map());
    if (!palette.has(color)) palette.set(color, new THREE.MeshStandardMaterial({ color, roughness: .78 }));
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), palette.get(color));
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  _batchBoxes(group) {
    const batches = new Map();
    for (const child of group.children) {
      if (!child.isMesh || child.geometry.type !== "BoxGeometry") continue;
      if (!batches.has(child.material)) batches.set(child.material, []);
      batches.get(child.material).push(child);
    }
    for (const [material, boxes] of batches) {
      if (boxes.length < 2) continue;
      const geometries = boxes.map((box) => {
        box.updateMatrix();
        return box.geometry.clone().applyMatrix4(box.matrix);
      });
      const geometry = mergeGeometries(geometries);
      geometries.forEach((part) => part.dispose());
      if (!geometry) continue;
      for (const box of boxes) {
        group.remove(box);
        box.geometry.dispose();
      }
      const batch = new THREE.Mesh(geometry, material);
      batch.castShadow = true;
      batch.receiveShadow = true;
      group.add(batch);
    }
  }

  _label(group, lines, position, width, height, background, ink) {
    const canvas = document.createElement("canvas");
    // Match the plane's proportions so lettering keeps its natural shape.
    canvas.width = 1024;
    canvas.height = Math.round(canvas.width * height / width);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    lines.forEach((line, i) => {
      const weight = i === 0 ? 700 : 600;
      let fontSize = canvas.height * (i === 0 ? .34 : .2);
      ctx.font = `${weight} ${fontSize}px Arial, sans-serif`;
      const textWidth = ctx.measureText(line).width;
      const availableWidth = canvas.width * .9;
      if (textWidth > availableWidth) {
        fontSize *= availableWidth / textWidth;
        ctx.font = `${weight} ${fontSize}px Arial, sans-serif`;
      }
      ctx.fillText(line, canvas.width / 2, canvas.height * (.35 + i * .38));
    });
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
    label.position.set(...position);
    group.add(label);
  }

  _brandImage(group, path, position, width, height) {
    const texture = new THREE.TextureLoader().load(path);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false }));
    mark.position.set(...position);
    group.add(mark);
  }

  _build(id, x, z, yaw = 0) {
    const prop = new THREE.Group();
    const terrain = this.island?._sampleTerrainY?.(x, z);
    prop.position.set(x, Number.isFinite(terrain) ? terrain : .25, z);
    prop.rotation.y = yaw;
    prop.userData.eggId = `Experience_${id}`;
    prop.userData.isClickableEgg = true;
    prop.userData.highlightScale = .02;
    this._box(prop, [3.2, .16, 2.6], [0, .08, 0], 0x8c8878);

    if (id === "security") {
      // Official H1 mark on a square screen tile; mint rails frame the kiosk.
      this._box(prop, [1.5, .85, 1.1], [0, .6, 0], 0x263f3b);
      this._box(prop, [2.3, 1.6, .7], [0, 1.7, 0], 0x20302e);
      for (const side of [-1.08, 1.08]) this._box(prop, [.08, 1.5, .04], [side, 1.7, .37], 0x8fe3c0);
      this._label(prop, ["", ""], [-.48, 1.75, .356], 1.15, 1.15, "#142120", "#ffffff");
      this._brandImage(prop, "/brands/hackerone/h1_mark_white.png", [-.48, 1.76, .363], .44, .817);
      this._label(prop, ["BBP", "RESEARCH"], [.6, 1.75, .356], .76, .66, "#20302e", "#8fe3c0");
      this._box(prop, [1.8, .12, .55], [0, 1.05, .55], 0x445a53);
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 7; col++) {
          this._box(prop, [.14, .04, .12], [-.66 + col * .22, 1.13, .45 + row * .18], 0xd6d1b8);
        }
      }
      this._brandImage(prop, "/brands/hackerone/hackerone_logo_white.png", [0, .53, .556], 1.24, .28);
    } else {
      // A travel case, route board and six country markers for the learning tour.
      this._box(prop, [2.1, 1.65, .85], [0, 1.05, 0], 0xd39753);
      for (const side of [-.65, .65]) {
        this._box(prop, [.15, 1.75, .91], [side, 1.05, 0], 0x5e4733);
      }
      this._box(prop, [.9, .12, .18], [0, 2.08, 0], 0x5e4733);
      for (const side of [-.4, .4]) this._box(prop, [.12, .25, .18], [side, 1.97, 0], 0x5e4733);
      this._label(prop, ["AGENTS OF", "CHANGE"], [0, 1.17, .43], 1.1, .65, "#efe7d5", "#263f3b");
      this._label(prop, ["SLOW TOURISM", "FI EE SI"], [0, .45, .432], 1.1, .4, "#5e4733", "#efe7d5");
      for (let i = 0; i < 6; i++) {
        this._box(prop, [.17, .13, .03], [-.5 + i * .2, 1.7, .44], [0x8fe3c0, 0xffd28a, 0xefe7d5][i % 3]);
      }
    }
    this._batchBoxes(prop);
    this.group.add(prop);
    this.exhibits.set(id, prop);
  }

  registerClickables() {
    const targets = this.game.world?.proximityTrigger?.eggMeshes;
    if (!targets) return;
    for (const prop of this.exhibits.values()) {
      prop.traverse((child) => {
        if (!child.isMesh) return;
        child.userData._origEmissive = child.material.emissive?.clone();
        child.userData._origEmissiveIntensity = child.material.emissiveIntensity;
      });
      targets.set(prop.userData.eggId, prop);
    }
  }

  getTourPose(id) {
    const prop = this.exhibits.get(id);
    if (!prop) return null;
    const { x, y, z } = prop.position;
    const offset = new THREE.Vector3(3.4, 4.2, 8.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), prop.rotation.y);
    return { camera: [x + offset.x, y + offset.y, z + offset.z], lookAt: [x, y + .35, z] };
  }

  getGrassZones() {
    return [...this.exhibits.values()].map((prop) => ({
      id: prop.userData.eggId, position: prop.position.toArray(), grassClearRadius: 3.0,
    }));
  }

  destroy() {
    this.destroyed = true;
    this.game.scene.remove(this.group);
    for (const collider of this.colliders) this.game.physics?.world?.removeCollider(collider, true);
    for (const prop of this.exhibits.values()) {
      this.game.world?.proximityTrigger?.eggMeshes?.delete(prop.userData.eggId);
    }
    this.group.traverse((child) => {
      child.geometry?.dispose();
      child.material?.map?.dispose();
      child.material?.dispose();
    });
    this.exhibits.clear();
  }
}
