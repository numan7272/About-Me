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
  grassCount:   TIER === "low" ? 12000 : TIER === "high" ? 30000 : 22000,
  shadowMap:    TIER === "low" ? 1024  : TIER === "high" ? 2048  : 2048,
  ssaoEnabled:  TIER !== "low",
  bloomEnabled: true,
};
