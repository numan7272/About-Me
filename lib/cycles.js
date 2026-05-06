/**
 * Tiny smoothed-state helper, modelled on Bruno's Cycles.js pattern.
 *
 * Bruno's full module manages animations / state transitions for whole
 * subsystems (sky tints, fog density, post-processing strength). Most
 * of what we need is just "lerp the current value toward a target each
 * frame" — usable inside any useFrame.
 *
 *   const speedLerp = createCycle(0, 8);   // start 0, response 8/s
 *   useFrame((_, dt) => {
 *     speedLerp.target = bikeState.speed;
 *     speedLerp.tick(dt);
 *     uniform.value = speedLerp.value;
 *   });
 *
 * `response` is a "frequency" — how many e-folds per second the value
 * approaches its target. 4 = leisurely, 12 = snappy. The exp-based step
 * is frame-rate independent so the visual feel doesn't change at 30 vs
 * 144 FPS.
 */
export function createCycle(initial = 0, response = 6) {
  const state = {
    value:    initial,
    target:   initial,
    response,
    tick(delta) {
      const t = 1 - Math.exp(-state.response * delta);
      state.value += (state.target - state.value) * t;
      return state.value;
    },
    snap(v) {
      state.value = v;
      state.target = v;
    },
  };
  return state;
}

/** Vector3-flavoured cycle. Pass a target Vec3 each frame, .tick(dt). */
export function createVec3Cycle(initial, response = 6) {
  const state = {
    value:    initial.clone(),
    target:   initial.clone(),
    response,
    tick(delta) {
      const t = 1 - Math.exp(-state.response * delta);
      state.value.x += (state.target.x - state.value.x) * t;
      state.value.y += (state.target.y - state.value.y) * t;
      state.value.z += (state.target.z - state.value.z) * t;
      return state.value;
    },
    snap(v) {
      state.value.copy(v);
      state.target.copy(v);
    },
  };
  return state;
}
