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

/**
 * One-shot teleport command — set by the mini-map's quick-travel buttons,
 * consumed (and cleared) by Player.useFrame on the next tick.
 * Coordinates are world-space; the Player will also zero linvel/angvel
 * so the teleport lands cleanly.
 */
export const bikeCommand = {
  teleportTo: null,  // { x, y, z, yaw? }  or null
};

/** Build a teleport position 11 m towards the origin from a landmark, so
 * the bike lands on the plaza edge facing inward, not embedded in the
 * collider.  Special case for HQ (offset south so we don't dump the bike
 * inside the homebase building). */
export function teleportRequest(landmarkId) {
  const lm = MAP_META.landmarks.find((l) => l.id === landmarkId);
  if (!lm) return;

  const OFFSET = 11;
  if (lm.id === "homebase") {
    bikeCommand.teleportTo = { x: 0, y: 1.5, z: -OFFSET, yaw: 0 };
    return;
  }

  const dist = Math.hypot(lm.x, lm.z) || 1;
  const tx = lm.x - (lm.x / dist) * OFFSET;
  const tz = lm.z - (lm.z / dist) * OFFSET;
  // Yaw so the bike faces the landmark after the teleport.
  const yaw = Math.atan2(lm.x - tx, lm.z - tz);
  bikeCommand.teleportTo = { x: tx, y: 1.5, z: tz, yaw };
}
