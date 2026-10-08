import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { Resources } from "../src/core/Resources.js";
import { Game } from "../src/Game.js";
import { MODEL_ASSETS } from "../src/data/modelAssets.js";
import { ControlModePicker } from "../src/ui/ControlModePicker.js";
import { MiniGames } from "../src/ui/miniGames/MiniGames.js";

test("empty loaders notify listeners attached after construction", async () => {
  const res = new Resources({});
  let ready = 0;
  res.on("ready", () => ready++);
  await Promise.resolve();
  assert.equal(ready, 1);
  res.destroy();
});

test("versioned GLB URLs use the model loader rather than a null asset", () => {
  const res = Object.create(Resources.prototype);
  let requested;
  res.total = 1;
  res.sources = { bike: "/bike.glb?v=2#model" };
  res.gltf = { load(url) { requested = url; } };
  res._load();
  assert.equal(requested, res.sources.bike);
});

test("failed assets remain errors and duplicate or late callbacks do not complete twice", () => {
  const res = new Resources({});
  res.total = 1;
  res._progress = { island: { loaded: 0, total: 0, done: false } };
  let ready = 0;
  res.on("ready", () => ready++);
  const oldError = console.error;
  console.error = () => {};
  try { res._onError("island", new Error("offline")); }
  finally { console.error = oldError; }
  res._onLoaded("island", {});
  assert.deepEqual(res.errors, ["island"]);
  assert.equal(res.loaded, 1);
  assert.equal(ready, 1);
  res.destroy();
  res._onLoaded("other", {});
  assert.equal(res.loaded, 1);
});

test("start waits for both physics and renderer initialization", async () => {
  const game = Object.create(Game.prototype);
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  game.renderer = { ready: Promise.resolve() };
  game.physics = { initialization: pending };
  game.world = { island: {}, player: { body: {} } };
  let starts = 0;
  game.splash = { setProgress() {}, markReady() { starts++; } };
  const finishing = game._finishLoading({ loaded: 2, total: 2, errors: [] });
  await Promise.resolve();
  assert.equal(starts, 0);
  release();
  await finishing;
  assert.equal(starts, 1);
  await game._finishLoading({ errors: ["island"] });
  assert.equal(starts, 1);
});

test("mobile controls are not shown until the start flow requests them", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const picker = new ControlModePicker({});
  let shown = 0;
  picker._show = () => { shown++; };
  picker._isTouchDevice = () => true;
  t.mock.timers.tick(2000);
  assert.equal(shown, 0);
  picker.show(() => {});
  assert.equal(shown, 1);
});

test("destroying a pending mini-game prevents a late overlay from opening", async () => {
  const manager = new MiniGames({});
  manager._resetPointerStates = () => {};
  let release;
  manager._flyIntro = () => new Promise((resolve) => { release = resolve; });
  let errors = 0;
  const oldError = console.error;
  console.error = () => { errors++; };
  try {
    const opening = manager.open("haw");
    manager.destroy();
    release();
    await opening;
    assert.equal(manager.active, null);
    assert.equal(manager._opening, false);
    assert.equal(errors, 0);
  } finally { console.error = oldError; }
});

function glb(path) {
  const bytes = readFileSync(new URL(path, import.meta.url));
  return { bytes: bytes.length, json: JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString()) };
}

for (const [name, source] of [["bike", "vanmoof-transformed.glb"], ["island", "maps/island.glb"]]) {
  test(`${name} optimization preserves named nodes, metadata and primitive counts`, () => {
    const original = glb(`../public/${source}`);
    const optimized = glb(`../public${MODEL_ASSETS[name]}`);
    assert.ok(optimized.bytes < original.bytes * 0.6);
    for (const node of original.json.nodes.filter((n) => n.name)) {
      const target = optimized.json.nodes.find((n) => n.name === node.name);
      assert.ok(target, `missing node ${node.name}`);
      if (node.extras) assert.deepEqual(target.extras, node.extras);
    }
    const primitives = (j) => j.meshes.reduce((n, mesh) => n + mesh.primitives.length, 0);
    assert.equal(primitives(optimized.json), primitives(original.json));
  });
}
