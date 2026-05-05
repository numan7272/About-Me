/**
 * Mutable shared camera-shake intensity.
 *
 * Anything in the scene can call triggerShake(amount) — the FollowCamera
 * picks it up next frame, jitters the camera position with a sin-mix and
 * decays the intensity exponentially. No React state involved.
 */
export const shakeState = {
  intensity: 0,
};

/** Add to the current shake intensity (clamped 0..1). */
export function triggerShake(amount) {
  shakeState.intensity = Math.min(1, shakeState.intensity + amount);
}
