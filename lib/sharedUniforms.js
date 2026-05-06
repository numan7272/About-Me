import * as THREE from "three";

/**
 * Bruno-Simon-style shared uniforms registry.
 *
 * In his folio-2025 every shader that cares about time, wind, day-cycle
 * or the off-screen track texture references the SAME uniform object
 * instances (Materials.js) — updating `uTime.value` once per frame
 * propagates to every material that uses it.  This module is our
 * equivalent: a singleton dictionary of THREE.IUniform objects.
 *
 * Usage in a shader material:
 *   const mat = new THREE.ShaderMaterial({
 *     uniforms: {
 *       uTime:     sharedUniforms.uTime,        // share the same ref
 *       uWindDir:  sharedUniforms.uWindDir,
 *       uMyColor:  { value: new THREE.Color(...) }, // material-specific
 *     },
 *   });
 *
 * Then `tickSharedUniforms(state, delta, dayWeight)` runs in ONE
 * useFrame at the top of the scene tree (World.js) and every material
 * reads the new values for free on its next draw call.
 */
export const sharedUniforms = {
  uTime:           { value: 0 },
  uPlayerPos:      { value: new THREE.Vector3() },
  uWindDir:        { value: new THREE.Vector2(0.62, 0.78).normalize() },
  uWindStrength:   { value: 0.18 },
  uWindNoiseTex:   { value: null },              // populated in World.js
  uWindNoiseScale: { value: 0.045 },             // world-units → noise-uv scale
  uDayWeight:      { value: 1.0 },
  uTrackTex:       { value: null },              // populated by TrackTexture
  uTrackWorldSize: { value: 150 },
  uTrackHas:       { value: 0 },
};
