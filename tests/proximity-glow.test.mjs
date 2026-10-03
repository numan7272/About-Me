import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { ProximityTrigger } from "../src/world/ProximityTrigger.js";

function fixture(materials = new THREE.MeshStandardMaterial({ emissive: 0x123456, emissiveIntensity: .25 })) {
  const root = new THREE.Group();
  root.add(new THREE.Mesh(new THREE.BoxGeometry(), materials));
  const trigger = new ProximityTrigger({ scene: new THREE.Scene(), time: { delta: 1 / 60 }, world: {
    player: { body: { translation: () => ({ x: 100, z: 100 }) } },
    island: { eggs: [], buildings: [] },
  } });
  trigger.eggMeshes.set("HQ", root);
  return { root, trigger, material: materials };
}

test("idle frames do not traverse or invalidate static clickable materials", () => {
  const { root, trigger, material } = fixture();
  let traversals = 0;
  const traverse = root.traverse.bind(root);
  root.traverse = (visitor) => { traversals++; traverse(visitor); };
  const version = material.version;
  for (let frame = 0; frame < 600; frame++) trigger.update();
  assert.equal(traversals, 0);
  assert.equal(material.version, version);
  assert.equal(material.emissive.getHex(), 0x123456);
  assert.equal(material.emissiveIntensity, .25);
});

test("hover pulses reuse material programs and restore original emission on exit", () => {
  const { root, trigger, material } = fixture();
  let traversals = 0;
  const traverse = root.traverse.bind(root);
  root.traverse = (visitor) => { traversals++; traverse(visitor); };
  root.userData.hovered = true;
  const version = material.version;
  for (let frame = 0; frame < 600; frame++) trigger.update();
  assert.equal(traversals, 1);
  assert.equal(material.version, version);
  assert.equal(material.emissive.getHex(), 0xffeebb);
  assert.ok(material.emissiveIntensity >= .4 && material.emissiveIntensity <= .7);
  root.userData.hovered = false;
  trigger.update();
  assert.equal(material.emissive.getHex(), 0x123456);
  assert.equal(material.emissiveIntensity, .25);
  assert.equal(material.version, version);
});

test("material arrays exclude unlit logos and shared materials retain their active glow", () => {
  const material = new THREE.MeshStandardMaterial({ emissive: 0x102030, emissiveIntensity: .3 });
  const logo = new THREE.MeshBasicMaterial();
  const { root, trigger } = fixture([material, logo]);
  const second = new THREE.Group();
  second.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
  trigger.eggMeshes.set("HAW", second);
  root.userData.hovered = true;
  trigger.update();
  root.userData.hovered = false;
  trigger.highlightEgg("haw");
  trigger.update();
  assert.equal(material.emissive.getHex(), 0xffeebb);
  assert.ok(material.emissiveIntensity >= .7);
  assert.equal(logo.version, 0);
  assert.equal(Object.hasOwn(logo, "emissiveIntensity"), false);
  second.visible = false;
  trigger.update();
  assert.equal(material.emissive.getHex(), 0x102030);
  assert.equal(material.emissiveIntensity, .3);
});
