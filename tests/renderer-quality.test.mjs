import assert from "node:assert/strict";
import test from "node:test";
import { Renderer } from "../src/core/Renderer.js";
import { Grass } from "../src/world/Grass.js";

function resolutionTarget() {
  return {
    ratio: 2, shadowMap: { enabled: true },
    getPixelRatio() { return this.ratio; },
    setPixelRatio(ratio) { this.ratio = ratio; },
    setSize(width, height) { this.size = [width, height]; },
  };
}

test("low graphics reduces scene and bloom resolution and survives a viewport resize", () => {
  const renderer = Object.create(Renderer.prototype);
  renderer.game = { sizes: { pixelRatio: 2 } };
  renderer.instance = resolutionTarget();
  renderer.composer = resolutionTarget();
  delete renderer.composer.getPixelRatio;
  renderer.setQuality("low");
  assert.equal(renderer.instance.ratio, 1);
  assert.equal(renderer.composer.ratio, 1);
  assert.equal(renderer.instance.shadowMap.enabled, false);
  renderer.onResize(390, 844);
  assert.equal(renderer.instance.ratio, 1);
  assert.equal(renderer.composer.ratio, 1);
  assert.deepEqual(renderer.composer.size, [390, 844]);
  renderer.setQuality("high");
  assert.equal(renderer.instance.ratio, 2);
  assert.equal(renderer.composer.ratio, 2);
  assert.equal(renderer.instance.shadowMap.enabled, true);
});

test("quality can be selected before the renderer finishes initialization", () => {
  const renderer = Object.create(Renderer.prototype);
  renderer.game = { sizes: { pixelRatio: 1.5 } };
  renderer.setQuality("low");
  assert.equal(renderer._pixelRatio(), 1);
  renderer.setQuality("high");
  assert.equal(renderer._pixelRatio(), 1.5);
});

test("4K and HiDPI scenes stay within their physical pixel budget after resize", () => {
  const renderer = Object.create(Renderer.prototype);
  renderer.game = { sizes: { width: 3840, height: 2160, pixelRatio: 2 } };
  renderer.instance = resolutionTarget();
  renderer.setQuality("high");
  assert.equal(renderer.instance.ratio, 0.5);
  renderer.setQuality("low");
  assert.ok(Math.abs(renderer.instance.ratio - 1 / 3) < 1e-10);
  renderer.game.sizes.width = 1920;
  renderer.game.sizes.height = 1080;
  renderer.onResize(1920, 1080);
  assert.ok(Math.abs(renderer.instance.ratio - 2 / 3) < 1e-10);
});

for (const mode of ["webgl", "webgpu"]) {
  test(`low bypasses ${mode} postprocessing and high restores it`, () => {
    const renderer = Object.create(Renderer.prototype);
    let direct = 0, post = 0;
    renderer.game = { sizes: { pixelRatio: 1 } };
    renderer.instance = { ...resolutionTarget(), render() { direct++; } };
    renderer.mode = mode;
    const pipeline = { render() { post++; }, setPixelRatio() {} };
    if (mode === "webgl") renderer.composer = pipeline;
    else renderer.postProcessing = pipeline;
    renderer.setQuality("low");
    renderer.render({}, {});
    assert.equal(direct, 1);
    assert.equal(post, 0);
    renderer.setQuality("high");
    renderer.render({}, {});
    assert.equal(direct, 1);
    assert.equal(post, 1);
  });
}

test("low hides decorative grass immediately and skips its per-frame work", () => {
  const grass = Object.create(Grass.prototype);
  grass.mesh = { visible: true };
  grass.material = { get userData() { throw new Error("unexpected grass update"); } };
  const renderer = Object.create(Renderer.prototype);
  renderer.game = { sizes: { pixelRatio: 1 }, world: { grass } };
  renderer.setQuality("low");
  assert.equal(grass.mesh.visible, false);
  grass.update();
  renderer.setQuality("high");
  assert.equal(grass.mesh.visible, true);
});
