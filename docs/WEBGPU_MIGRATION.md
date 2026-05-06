# WebGPU Migration Plan

This branch (`claude/webgpu-experiment`) is the dedicated track for
porting the portfolio to Three.js's WebGPU backend. It is **not**
production-ready — main is still WebGL.

## Why a separate branch

WebGPU's adoption is still nascent. As of early 2026 it's available
in:

- Chrome 113+ (since May 2023)
- Edge 113+
- Safari 17.4+ (March 2024) — **iOS Safari 17.4+ on iPhones too**
- Firefox 121+ (with `dom.webgpu.enabled` flag — not yet on by default)

For a portfolio that should work everywhere, falling back to WebGL
when WebGPU isn't present is mandatory. This branch starts with the
strict-WebGPU path so we can build it cleanly without a fallback layer
muddling the code, then layer detection back on.

## Scope of the migration

| File | Conversion |
|------|------------|
| `components/Water.js` | GLSL → TSL (done — see `components/Water.webgpu.js`) |
| `components/Decorations.js` GrassField | GLSL → TSL (largest job — wind noise sampling, track flatten, camera-facing rotation) |
| `components/Decorations.js` WindStreaks | GLSL → TSL (progress-based draw/erase) |
| `components/Decorations.js` CloudShadows | GLSL → TSL (procedural noise) |
| `components/Decorations.js` RainLines | No shader — `MeshBasicMaterial` works as-is on WebGPU |
| `components/TrackTexture.js` | Render-target API differs slightly — `WebGPURenderer.setRenderTarget()` works but check `renderAsync()` for off-screen renders |

Built-in materials carry over without changes:

- `MeshStandardMaterial` (Ground, Trees, Houses, Lamps, Bike, Landmarks) — works
- `MeshBasicMaterial` (overlays, click zones, halos) — works
- `MeshPhysicalMaterial` (bike) — works

## Dependency changes required

```jsonc
// package.json
{
  "dependencies": {
    "@react-three/fiber": "^9.0.0",          // ↑ from 8.17 — v9 supports WebGPU
    "@react-three/drei": "^10.0.0",          // ↑ matching v9
    "@react-three/postprocessing": "REMOVE", // WebGL only
    "three": "^0.170.0"                      // already supports three/webgpu
  }
}
```

The post-processing library has no WebGPU equivalent yet. Either:

1. Drop SSAO/Bloom/Vignette/ChromaticAberration entirely (the loss is
   noticeable but the scene still works)
2. Re-implement the effects as TSL nodes (Three.js has built-in
   `BloomNode` and `OutputPass` available in `three/examples/jsm/tsl/`)

## Feature parity: build order

1. **Renderer swap** — replace the R3F Canvas with a manual setup that
   uses `WebGPURenderer`. Verify the scene renders at all (Ground +
   Trees + Bike, no custom shaders).
2. **Water (TSL)** — easiest custom shader, single fragment with
   noise + foam.  Converted in `Water.webgpu.js`.
3. **Grass (TSL)** — the big one. Wind-noise sampling, track-flatten
   sampling, camera-facing rotation, soft tip alpha.
4. **WindStreaks + CloudShadows (TSL)** — small shaders.
5. **TrackTexture** — port the off-screen render. WebGPU's render-
   target API is async (`renderer.renderAsync()`) which changes the
   useFrame contract slightly.
6. **Postprocessing** — wire up TSL Bloom + custom output pass; SSAO
   may be the trickiest to replicate.
7. **Detection + fallback** — load `WebGPURenderer` lazily; if
   `navigator.gpu` is unavailable, fall back to WebGL.

## Why this matters

WebGPU is a genuinely better rendering API:

- Multithreaded command encoding (WebGL is single-threaded)
- Compute shaders for things like grass culling / wind simulation
- More predictable performance — fewer driver workarounds
- Better debugging via the new browser dev tools

For this portfolio the visual win is small (Bruno's WebGPU folio and
his earlier WebGL one look similar), but the perf headroom matters
once we add more decoration / interactivity.

## How to use this branch

Currently it's pre-implementation. As shaders get ported, swap the
imports in `World.js`:

```js
// Import { default as Water } from "./Water";          // WebGL
import { default as Water } from "./Water.webgpu";       // WebGPU
```

When v9 of R3F is wired up we'll add a `?webgpu=1` query-string toggle
that picks the renderer at runtime.
