/**
 * Shared mutable state for the off-screen track texture pipeline.
 *
 * `TrackTexture` (the component) populates `track.texture` once its
 * WebGLRenderTarget is constructed. The grass shader reads from that
 * field via the same module reference, so we don't have to thread the
 * texture through React props from a useMemo'd render target down a
 * deep prop chain.
 *
 * `WORLD_SIZE` is the side-length of the orthographic capture area in
 * world metres. Both the off-screen camera and the grass shader's UV
 * lookup need to agree on the value.
 */
export const trackState = {
  texture: null,
  worldSize: 150,
};
