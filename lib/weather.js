import * as THREE from "three";

/**
 * Tiny weather controller.
 *
 * Slowly varies wind direction and strength so the world doesn't feel
 * mechanically locked at one wind setting. Output values are written
 * directly into `sharedUniforms.uWindDir` / `uWindStrength` once per
 * frame from World.js's SharedUniformsTick — every wind-aware shader
 * (grass, bushes, trees, flowers, streaks, cloud shadows) picks them
 * up automatically.
 *
 * Three time-domains layered together:
 *
 *   1. A slow turn (period ~7 min) rotates the wind direction —
 *      simulates a weather front sweeping across.
 *   2. A medium gust pulse (period ~25 s) modulates wind strength up
 *      and down — simulates breezy conditions where wind comes in
 *      waves.
 *   3. A day-cycle coupling: night drops strength toward calm, day
 *      pumps it up. Lets the day/night feel palpably different even
 *      on the wind side.
 *
 * Returns a plain object with `dir` (Vector2) and `strength` (number)
 * each frame; the consumer copies them into the shared uniforms.
 */

const tmpDir = new THREE.Vector2();

const BASE_DIR_ANGLE = Math.atan2(0.62, 0.78);   // matches our default
const BASE_STRENGTH  = 0.18;

// Output container reused across calls so we don't allocate per frame.
const out = {
  dir:      new THREE.Vector2(0.62, 0.78).normalize(),
  strength: BASE_STRENGTH,
};

/** Sample weather state for the given elapsed time + day weight (0..1). */
export function sampleWeather(elapsedSeconds, dayWeight = 1) {
  // 1) Slow direction drift — adds ±20° to the base angle over a 7-min cycle
  const dirAngle = BASE_DIR_ANGLE
    + Math.sin(elapsedSeconds / 420 * Math.PI * 2) * (Math.PI / 9);
  tmpDir.set(Math.sin(dirAngle), Math.cos(dirAngle));
  out.dir.copy(tmpDir);

  // 2) Medium gust — strength oscillates ±35% around the base over 25 s
  const gustAmp   = 0.35;
  const gustPhase = (elapsedSeconds / 25) * Math.PI * 2;
  const gust      = 1 + Math.sin(gustPhase) * gustAmp;

  // 3) Day-cycle multiplier: 0.55 at midnight → 1.0 at noon
  const dayMul = 0.55 + dayWeight * 0.45;

  out.strength = BASE_STRENGTH * gust * dayMul;
  return out;
}
