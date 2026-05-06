"use client";

import { forwardRef, useMemo, useRef, useEffect } from "react";
import { Effect } from "postprocessing";
import { Color, Uniform } from "three";

import { sharedUniforms } from "@/lib/sharedUniforms";

/**
 * Custom cinematic post-processing pass.
 *
 * Stacks four cheap stylization tricks on the composer's input frame:
 *   1. Saturation boost (~15%) — pushes the cartoon palette without
 *      blowing skin-tone equivalents.
 *   2. Soft contrast S-curve — adds pop to mid-tones, leaves shadows
 *      and highlights mostly alone.
 *   3. Day-cycle-tinted vignette — corners fade toward a darker
 *      version of the sky tint instead of pure black, so a sunset
 *      vignette reads warm, a night vignette reads deep blue.
 *   4. Subtle animated film grain — a tiny per-pixel noise term keyed
 *      off uTime so the image breathes instead of looking like a flat
 *      render.
 *
 * Uses the postprocessing library's Effect class via the standard
 * @react-three/postprocessing pattern. Reads uTime + uDayWeight from
 * the shared uniforms registry so the pass animates and re-tints
 * automatically with the rest of the world.
 */

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uDayWeight;
  uniform vec3  uVignetteTint;
  uniform float uSaturation;
  uniform float uContrast;
  uniform float uVignetteStrength;
  uniform float uGrainStrength;

  void mainImage(
    const in vec4 inputColor,
    const in vec2 uv,
    out vec4 outputColor
  ) {
    vec3 col = inputColor.rgb;

    // ── 1) Saturation. Use Rec. 709 luminance so colour-shift stays
    //        natural rather than yanking everything toward a single hue.
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(lum), col, uSaturation);

    // ── 2) Contrast. Pivot on mid-grey so we widen the range
    //        symmetrically.
    col = (col - 0.5) * uContrast + 0.5;

    // ── 3) Vignette tinted by day-cycle. Falls off radially from
    //        screen centre; corners fade toward the (dimmed) sky tint.
    vec2  offset = uv - 0.5;
    float vignAmt = smoothstep(0.20, 0.95, dot(offset, offset) * 2.4);
    vec3  nightCorner = vec3(0.02, 0.02, 0.05);
    vec3  vignTone   = mix(nightCorner, uVignetteTint * 0.55, uDayWeight);
    col = mix(col, vignTone, vignAmt * uVignetteStrength);

    // ── 4) Animated film grain — pseudo-random per pixel, drifts on
    //        uTime so it reads as breath rather than a static dot
    //        pattern. Subtle: ±0.02 typical.
    float grain = fract(
      sin(dot(uv * 1024.0, vec2(12.9898, 78.233)) + uTime * 60.0) * 43758.5453
    );
    col += (grain - 0.5) * uGrainStrength;

    // Clamp output to valid LDR range; otherwise the bloom pass already
    // ran upstream and any negative values would error out the chain.
    outputColor = vec4(clamp(col, 0.0, 1.0), inputColor.a);
  }
`;

class CinematicEffectImpl extends Effect {
  constructor() {
    super("CinematicEffect", fragmentShader, {
      uniforms: new Map([
        ["uTime",             new Uniform(0)],
        ["uDayWeight",        new Uniform(1)],
        ["uVignetteTint",     new Uniform(new Color("#8ec8e8"))],
        ["uSaturation",       new Uniform(1.18)],
        ["uContrast",         new Uniform(1.06)],
        ["uVignetteStrength", new Uniform(0.55)],
        ["uGrainStrength",    new Uniform(0.025)],
      ]),
    });
  }

  /** Called by the EffectComposer once per frame. We forward the
   *  shared time + day-cycle values into our local uniforms. The
   *  CinematicEffect runs on the same clock as every other shader. */
  update(/* renderer, inputBuffer, deltaTime */) {
    const u = this.uniforms;
    u.get("uTime").value      = sharedUniforms.uTime.value;
    u.get("uDayWeight").value = sharedUniforms.uDayWeight.value;
  }
}

const CinematicEffect = forwardRef(function CinematicEffect(_, ref) {
  const effect = useMemo(() => new CinematicEffectImpl(), []);
  // Forward the underlying Effect to whoever's referencing us so the
  // composer can wire it in.
  useEffect(() => {
    if (ref && typeof ref === "function") ref(effect);
    else if (ref) ref.current = effect;
  }, [ref, effect]);
  return <primitive object={effect} dispose={null} />;
});

export default CinematicEffect;
