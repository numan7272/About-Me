import * as THREE from "three";

/**
 * Procedural natural-island silhouette.
 *
 * The island's shape is defined as a radial function of an angle parameter
 * `a` (in radians). The radius at any angle is a base radius plus several
 * sine layers — gives an organic, irregular coast with bays and small
 * peninsulas rather than a perfect circle or square.
 *
 * Coordinate convention (important):
 *   The rendering meshes use rotation.x = -π/2 to lay flat on the ground.
 *   A shape point (cos(a)·r, sin(a)·r, 0) maps to world (cos(a)·r, 0, -sin(a)·r).
 *   So shape angle `a` corresponds to world angle `-a`.
 *
 *   `shapeAngleFromWorld(x, z)` returns the shape-angle for any world point,
 *   so `outerR(shapeAngleFromWorld(x, z))` gives the coastline radius along
 *   the ray from the origin through (x, z).
 */

const BASE_R          = 60;
const BEACH_WIDTH_AVG = 5.5;
const BEACH_WIDTH_VAR = 1.6;       // beach gets noticeably wider/narrower
export const ISLAND_VERTS = 96;     // boundary resolution (visual + physics)

/** Outer (water-line) radius at the given shape-angle. */
export function outerR(a) {
  return (
    BASE_R
    + Math.sin(a * 3.0  + 0.7) * 5.5
    + Math.sin(a * 5.0  + 2.1) * 3.2
    + Math.sin(a * 7.0  + 4.3) * 1.8
    + Math.sin(a * 11.0 + 1.1) * 1.0
  );
}

/** Per-angle beach width — varies so bays have wider strands than headlands. */
export function beachWidth(a) {
  return BEACH_WIDTH_AVG + Math.sin(a * 4.0 + 1.3) * BEACH_WIDTH_VAR;
}

/** Inner (grass-line) radius. The beach lives between innerR and outerR. */
export function innerR(a) {
  return outerR(a) - beachWidth(a);
}

/** Convert world (x, z) to the shape-angle used by outerR/innerR. */
export function shapeAngleFromWorld(x, z) {
  return Math.atan2(-z, x);
}

export function isOnIsland(x, z) {
  return Math.hypot(x, z) <= outerR(shapeAngleFromWorld(x, z));
}

export function isOnBeach(x, z) {
  const a = shapeAngleFromWorld(x, z);
  const r = Math.hypot(x, z);
  return r >= innerR(a) && r <= outerR(a);
}

export function isInGrass(x, z) {
  return Math.hypot(x, z) < innerR(shapeAngleFromWorld(x, z));
}

/* ── Shape builders ─────────────────────────────────────────────────────── */

function buildShape(radiusFn) {
  const s = new THREE.Shape();
  s.moveTo(radiusFn(0), 0);
  for (let i = 1; i <= ISLAND_VERTS; i++) {
    const a = (i / ISLAND_VERTS) * Math.PI * 2;
    const r = radiusFn(a);
    s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
}

export function makeOuterShape() { return buildShape(outerR); }

/** Beach ring: the area between the inner (grass) and outer (water) curves. */
export function makeBeachShape() {
  const outer = buildShape(outerR);
  const hole  = new THREE.Path();
  // Hole must wind opposite to outer (CCW outer → CW hole). Iterate
  // backward through the vertex list to flip the winding.
  hole.moveTo(innerR(0), 0);
  for (let i = ISLAND_VERTS; i >= 1; i--) {
    const a = (i / ISLAND_VERTS) * Math.PI * 2;
    const r = innerR(a);
    hole.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  outer.holes.push(hole);
  return outer;
}

/** Wet-sand band: a thinner ring along the outer edge of the beach. */
export function makeWetSandShape(width = 1.8) {
  const outer = buildShape(outerR);
  const hole  = new THREE.Path();
  const inner = (a) => outerR(a) - width;
  hole.moveTo(inner(0), 0);
  for (let i = ISLAND_VERTS; i >= 1; i--) {
    const a = (i / ISLAND_VERTS) * Math.PI * 2;
    hole.lineTo(Math.cos(a) * inner(a), Math.sin(a) * inner(a));
  }
  outer.holes.push(hole);
  return outer;
}

/* ── Physics geometry ───────────────────────────────────────────────────── */

/**
 * Returns world-space (x, z) points along the outer coastline. Used to
 * place CuboidCollider segments as a wall around the island so the bike
 * can't drive off into the water.
 */
export function getOuterWorldPoly() {
  const pts = [];
  for (let i = 0; i < ISLAND_VERTS; i++) {
    const a = (i / ISLAND_VERTS) * Math.PI * 2;
    const r = outerR(a);
    // Shape (cos(a)·r, sin(a)·r) → world (cos(a)·r, -sin(a)·r) in XZ
    pts.push([Math.cos(a) * r, -Math.sin(a) * r]);
  }
  return pts;
}
