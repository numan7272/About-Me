/**
 * Lightweight quality tier detection.
 *
 * Picks a tier on first import based on viewport size + UA hint, then
 * exposes a constant settings object to the rendering modules. Far
 * simpler than Bruno's full Quality.js (he probes WebGL extensions and
 * hard-codes per-device GPU profiles), but enough to give phones a
 * lighter-weight scene without sacrificing visual fidelity on desktop.
 *
 * Tiers:
 *   "low"  — small phones / weak GPUs. Cuts grass to ~6k blades, drops
 *             SSAO, halves shadow map.
 *   "mid"  — most laptops + tablets. Default settings.
 *   "high" — large desktops with discrete GPUs.
 */

function detectTier() {
  if (typeof window === "undefined") return "mid";   // SSR / Node fallback

  const ua    = navigator.userAgent ?? "";
  const isMob = /iPhone|iPad|iPod|Android/i.test(ua);
  const w     = window.innerWidth || 1024;
  const dpr   = window.devicePixelRatio || 1;

  // Heuristics — small touch devices read as "low"; widescreens with
  // medium pixel-density at a typical desk size read as "high".
  if (isMob && w < 800)  return "low";
  if (!isMob && w >= 1600 && dpr <= 2) return "high";
  return "mid";
}

const TIER = detectTier();

export const quality = {
  tier:         TIER,
  // Bumped: Bruno runs ~78 k blades over a 280×280 grid. Scaled down to
  // our smaller play area, ~22-30 k reads as similarly dense once the
  // camera-facing rotation prevents edge-on invisibility.
  // Pushing blade count hard now that each blade is smaller — we
  // need the eye to read overlapping crowd, not individual triangles.
  // Bruno does ~78k over a much bigger area; we'd want ~70-90k for
  // similar perceived density at our smaller scale.
  grassCount:   TIER === "low" ? 28000 : TIER === "high" ? 95000 : 65000,
  shadowMap:    TIER === "low" ? 1024  : TIER === "high" ? 2048  : 2048,
  ssaoEnabled:  TIER !== "low",
  bloomEnabled: true,
  // Multiplier on hand-placed foliage counts (bushes / flowers / mounds /
  // dirt). The arrays are filtered by isBlocked + then sliced by this
  // factor; low-tier devices see fewer of each so the total draw-call
  // budget stays in check.
  foliageDensity: TIER === "low" ? 0.55 : TIER === "high" ? 1.20 : 1.00,
};
