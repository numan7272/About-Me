/**
 * Slow day/night cycle driver.
 *
 * One full cycle takes `DAY_LENGTH` seconds. The page loads near
 * mid-day so a fresh visit opens on a sunny scene. `sample(time)`
 * returns a snapshot of every value the rendering layers care about
 * (sun direction, light tint, ambient, sky tint, fog colour) — World.js
 * just calls this on every frame and applies the values.
 */

import * as THREE from "three";

export const DAY_LENGTH  = 240;          // 4 minutes for a full cycle
const PHASE_OFFSET       = 0.18;          // start near "morning-noon" plateau
const tmpDir             = new THREE.Vector3();

export function dayFraction(elapsedSeconds) {
  const f = (elapsedSeconds / DAY_LENGTH + PHASE_OFFSET) % 1;
  return f < 0 ? f + 1 : f;
}

function smoothstep(e0, e1, x) {
  const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function lerpColor(a, b, t) {
  return new THREE.Color(
    a.r + (b.r - a.r) * t,
    a.g + (b.g - a.g) * t,
    a.b + (b.b - a.b) * t,
  );
}

const SUN = {
  noon:   new THREE.Color("#fff4d6"),
  golden: new THREE.Color("#ffb86b"),
  dusk:   new THREE.Color("#ff8a52"),
  night:  new THREE.Color("#3a4a78"),
};
const SKY = {
  noon:   new THREE.Color("#8ec8e8"),
  golden: new THREE.Color("#f0a878"),
  dusk:   new THREE.Color("#36344e"),
  night:  new THREE.Color("#0a0e1c"),
};
const AMBIENT = {
  noon:   new THREE.Color("#ddeeff"),
  golden: new THREE.Color("#f0c8a0"),
  dusk:   new THREE.Color("#5a4870"),
  night:  new THREE.Color("#141a2e"),
};
const FOG = {
  noon:   new THREE.Color("#bcd8e8"),
  golden: new THREE.Color("#dab48c"),
  dusk:   new THREE.Color("#3a3a52"),
  night:  new THREE.Color("#0a0e1c"),
};

/** Sample the current cycle. f = 0 sunrise, 0.25 noon, 0.5 sunset, 0.75 midnight. */
export function sample(elapsedSeconds, target = {}) {
  const f = dayFraction(elapsedSeconds);

  // Sun direction. f=0 sun rises in +X, f=0.25 overhead, f=0.5 sets in -X.
  const arc = (f - 0.25) * Math.PI * 2;
  tmpDir.set(Math.sin(arc), Math.cos(arc), 0.32).normalize();
  target.sunDir = target.sunDir ? target.sunDir.copy(tmpDir) : tmpDir.clone();

  // Smoothstep day weight: 1 around noon, 0 around midnight.
  const dayWeight = (1 - smoothstep(0.45, 0.62, f)) * smoothstep(0.0, 0.18, f)
                  + (f >= 0.85 ? smoothstep(0.85, 1.0, f) : 0);
  const dw = THREE.MathUtils.clamp(dayWeight, 0, 1);

  let sun, sky, ambient, fog;
  if (f < 0.08) {
    const t = f / 0.08;
    sun = lerpColor(SUN.night, SUN.golden, t);
    sky = lerpColor(SKY.night, SKY.golden, t);
    ambient = lerpColor(AMBIENT.night, AMBIENT.golden, t);
    fog = lerpColor(FOG.night, FOG.golden, t);
  } else if (f < 0.22) {
    const t = (f - 0.08) / 0.14;
    sun = lerpColor(SUN.golden, SUN.noon, t);
    sky = lerpColor(SKY.golden, SKY.noon, t);
    ambient = lerpColor(AMBIENT.golden, AMBIENT.noon, t);
    fog = lerpColor(FOG.golden, FOG.noon, t);
  } else if (f < 0.40) {
    sun = SUN.noon.clone();
    sky = SKY.noon.clone();
    ambient = AMBIENT.noon.clone();
    fog = FOG.noon.clone();
  } else if (f < 0.50) {
    const t = (f - 0.40) / 0.10;
    sun = lerpColor(SUN.noon, SUN.golden, t);
    sky = lerpColor(SKY.noon, SKY.golden, t);
    ambient = lerpColor(AMBIENT.noon, AMBIENT.golden, t);
    fog = lerpColor(FOG.noon, FOG.golden, t);
  } else if (f < 0.60) {
    const t = (f - 0.50) / 0.10;
    sun = lerpColor(SUN.golden, SUN.dusk, t);
    sky = lerpColor(SKY.golden, SKY.dusk, t);
    ambient = lerpColor(AMBIENT.golden, AMBIENT.dusk, t);
    fog = lerpColor(FOG.golden, FOG.dusk, t);
  } else if (f < 0.74) {
    const t = (f - 0.60) / 0.14;
    sun = lerpColor(SUN.dusk, SUN.night, t);
    sky = lerpColor(SKY.dusk, SKY.night, t);
    ambient = lerpColor(AMBIENT.dusk, AMBIENT.night, t);
    fog = lerpColor(FOG.dusk, FOG.night, t);
  } else {
    sun = SUN.night.clone();
    sky = SKY.night.clone();
    ambient = AMBIENT.night.clone();
    fog = FOG.night.clone();
  }

  target.sun = sun;
  target.sky = sky;
  target.ambient = ambient;
  target.fog = fog;

  target.dayWeight        = dw;
  target.sunIntensity     = 0.5 + dw * 2.3;
  target.ambientIntensity = 0.30 + dw * 0.30;
  target.hemiIntensity    = 0.25 + dw * 0.40;
  target.fraction         = f;
  return target;
}
