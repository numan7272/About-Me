import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { ExperienceExhibits } from "../src/world/ExperienceExhibits.js";

test("batching reduces station draw calls while retaining bounds, triangles and clickable root", () => {
  const exhibits = Object.create(ExperienceExhibits.prototype);
  exhibits._boxMaterials = new WeakMap();
  const group = new THREE.Group();
  group.userData.eggId = "Experience_security";
  for (let index = 0; index < 14; index++) exhibits._box(group, [.14, .04, .12], [index * .22, 1.13, .45], 0xd6d1b8);
  exhibits._box(group, [1, 1, 1], [0, 0, 0], 0x20302e);
  const before = new THREE.Box3().setFromObject(group);
  const triangles = group.children.reduce((count, mesh) => count + mesh.geometry.index.count / 3, 0);
  exhibits._batchBoxes(group);
  const after = new THREE.Box3().setFromObject(group);
  assert.equal(group.children.length, 2);
  assert.equal(group.children.reduce((count, mesh) => count + mesh.geometry.index.count / 3, 0), triangles);
  assert.ok(before.min.distanceTo(after.min) < 1e-6);
  assert.ok(before.max.distanceTo(after.max) < 1e-6);
  assert.ok(group.children.every((mesh) => mesh.castShadow && mesh.receiveShadow));
  assert.equal(group.userData.eggId, "Experience_security");
  const ray = new THREE.Raycaster(new THREE.Vector3(.22, 5, .45), new THREE.Vector3(0, -1, 0));
  assert.equal(ray.intersectObject(group, true)[0].object.parent.userData.eggId, "Experience_security");
});
