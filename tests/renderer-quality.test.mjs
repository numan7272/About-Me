import assert from "node:assert/strict";
import test from "node:test";
import { Renderer } from "../src/core/Renderer.js";

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
