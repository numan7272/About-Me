# QA and loading audit — 6 October 2026

## Fixed findings

| Finding | Change |
| --- | --- |
| The initial bike and island downloads totalled 18.26 MB. | Optimized textures and geometry encoding; load fingerprinted assets and preload both model URLs from HTML. |
| Ambient music could compete with model downloads after an early pointer gesture. | Request ambient music only from the actual start gesture. |
| Loading progress advanced only after each complete model. | Show monotonic download/decode progress, model counts and transferred bytes. |
| Failed models counted as complete and could enable a broken start. | Retain asset errors; show a translated failure message and a retry button. |
| Models could finish before physics or the renderer was initialized. | Start readiness waits for models, renderer and physics, then checks that island and player body exist. |
| The mobile control chooser appeared over the loading introduction. | Request the chooser after starting, then show the tour welcome. |
| Empty resource loads emitted ready before callers could subscribe. Versioned model URLs were treated as unknown assets. | Queue initial loading and recognize extensions before query/hash suffixes. |
| Closing/destroying a mini-game while its chunk was loading could allow a late overlay to open. | Cancel stale asynchronous opens using a generation token and clean up failed opens and scroll locks. |
| Hidden contact/drawer controls remained in keyboard navigation. | Use inert and aria-hidden while closed; focus and trap keyboard navigation in contact, and restore focus on close. |
| Station shortcuts could open content during loading, onboarding or contact. | Ignore station shortcuts while these blocking views are active. |
| Settings section labels and the tour tooltip kept their old language after switching languages. | Update existing labels and the tooltip during language changes. |

## Model payload

Decimal MB; these are file bytes, not measured time improvements.

| Model | Before | After |
| --- | ---: | ---: |
| Bike | 13,230,256 bytes | 2,577,640 bytes |
| Island | 5,031,424 bytes | 2,466,468 bytes |
| Total | 18,261,680 bytes | 5,044,108 bytes |

Reduction: **72.38%**. Original files remain available but are no longer requested by the application. Fingerprinted URLs avoid reusing cached original assets under Vercel's immutable model cache policy.

Generated with glTF Transform 4.5.1: texture dimensions capped at 1024×1024, WebP quality 85, bike Meshopt medium and island Draco edgebreaker, with position/normal/UV quantization at 16/12/14 bits. This reduces texture detail and slightly quantizes coordinates; it does not simplify meshes or flatten named objects. Regression checks preserve named nodes, node metadata and primitive counts used by scene interactions.

## Validation

- Browser QA on the production build in the local preview: first mobile visit, start → control chooser → welcome, seven tour stations and completion, Agents of Change and HackerOne HQ files, opening/closing contact, contact keyboard wrap, German/English changes, WebGL and WebGPU, Low/High settings.
- Models decoded and the scene started with both renderers. HQ content and certificate/profile links remained accessible.
- Eight new regression tests cover loader timing/errors, versioned URLs, physics/renderer readiness, mobile chooser timing, cancelled mini-game opens and model structure preservation. Together with the ten existing committed tests, all 18 pass.
- Production build and ESLint pass. Vite still reports large Three.js/Rapier chunks; the largest measured reduction here is model transfer size.

## Limits

No repeatable cold-network timing benchmark or physical iPhone Safari test was available. Viewport checks do not reproduce iOS browser bars or safe-area behavior. Do not interpret 72% fewer model bytes as 72% faster total loading or higher frame rate. The previously reported desktop 4 FPS occurred with software-only browser graphics; asset compression cannot enable hardware acceleration. This change requires a new production deployment before it affects the live site.
