/**
 * Mutable, single-instance bike state shared between the R3F world (writer)
 * and the DOM HUD overlays (readers).
 *
 * Reading via React state would force a re-render every frame; we instead
 * write into this plain object inside useFrame and let HUDs poll it via
 * requestAnimationFrame.
 */
export const bikeState = {
  x:      0,
  y:      0,
  z:      0,
  yaw:    0,    // radians; 0 = bike facing -Z (Three's default forward)
  speed:  0,    // m/s on the XZ plane
  maxSpeed: 7.5,
};

/** Static map definition for the mini-map. Mirrors World.js LM constants. */
export const MAP_META = {
  islandSize: 130,
  landmarks: [
    { id: "homebase",   x:   0, z:   0, color: "#f472b6" },
    { id: "haw",        x: -38, z: -35, color: "#22d3ee" },
    { id: "designa",    x:  42, z: -22, color: "#34d399" },
    { id: "kebab",      x:   8, z:  40, color: "#fb923c" },
    { id: "highschool", x: -36, z:  32, color: "#a78bfa" },
  ],
};
