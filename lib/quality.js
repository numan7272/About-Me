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
  grassCount:   TIER === "low" ? 6000  : TIER === "high" ? 14000 : 12000,
  shadowMap:    TIER === "low" ? 1024  : TIER === "high" ? 2048  : 2048,
  ssaoEnabled:  TIER !== "low",
  bloomEnabled: true,
};
