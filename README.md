# Numan Yesil — 3D Free-Roam Portfolio

An interactive, physics-driven 3D portfolio. Drive a VanMoof S3 around a
stylized floating island and discover the stations of my career — HAW Kiel,
Designa Verkehrsleittechnik, and the family Dönerladen — by riding into them.

> [!NOTE]
> Built as a single-page Next.js + React Three Fiber experience with real
> Rapier physics, post-processing bloom and a touch-friendly UI.

---

## Live Demo

<!-- Replace with your deployed URL -->
**[numan-yesil.vercel.app](#)**

---

## Screenshots

<!--
  Drop your screenshots into ./docs/screenshots/ with the filenames below.
  All paths are relative so they render on GitHub and on local clones.
-->

<p align="center">
  <img src="./docs/screenshots/hero.png" alt="Hero — bike on the island at dusk" width="100%" />
</p>

<p align="center">
  <img src="./docs/screenshots/haw-landmark.png"     alt="HAW Kiel landmark"     width="32%" />
  <img src="./docs/screenshots/designa-landmark.png" alt="Designa landmark"      width="32%" />
  <img src="./docs/screenshots/kebab-landmark.png"   alt="Dönerladen landmark"   width="32%" />
</p>

<p align="center">
  <img src="./docs/screenshots/info-card.png" alt="Glassmorphism info card on sensor enter" width="49%" />
  <img src="./docs/screenshots/mobile.png"    alt="Mobile layout with on-screen D-pad"      width="49%" />
</p>

> Don't have screenshots yet? `npm run dev`, fly around for a minute,
> then drop captures into `./docs/screenshots/` using the names above.

---

## Features

- **Free-roaming bike** — physics-based VanMoof S3 driven with WASD / arrows /
  on-screen D-pad. Yaw-only locked rotation, low-speed turn damping,
  brake on `Space`.
- **Sensor-based storytelling** — each landmark wraps a Rapier `<CuboidCollider sensor>`.
  Riding into one slides a glassmorphism `InfoCard` in from the top;
  riding away dismisses it. Only one card is active at a time.
- **Three landmarks**:
  - **HAW Kiel** — Wirtschaftsinformatik & Mindset
  - **Designa Verkehrsleittechnik** — Quality Assurance & Bug-Hunting
  - **Dönerladen der Familie** — Gastro-Wurzeln & MVPs
- **Cinematic visuals** — sunset HDRI environment, soft shadows, bloom +
  vignette via `@react-three/postprocessing`, low-roughness PBR on the logos
  for crisp reflections.
- **Touch-first mobile UX** — hidden D-pad pads with multi-touch
  pointer-capture (forward + steer at the same time), `100dvh` and
  `position: fixed` body to kill iOS bar jitter.
- **Performant** — single dynamic body, scratch-vector reuse in the hot
  loop, frame-rate-independent lerp follow camera, soft shadows tuned for
  consumer GPUs.

---

## Tech Stack

| Area              | Library                                                                                |
| ----------------- | -------------------------------------------------------------------------------------- |
| Framework         | [Next.js 14 (App Router)](https://nextjs.org/)                                         |
| 3D Engine         | [three](https://threejs.org/) + [@react-three/fiber](https://docs.pmnd.rs/react-three-fiber) |
| 3D Helpers        | [@react-three/drei](https://github.com/pmndrs/drei)                                    |
| Physics           | [@react-three/rapier](https://github.com/pmndrs/react-three-rapier)                    |
| Post-processing   | [@react-three/postprocessing](https://github.com/pmndrs/react-postprocessing)          |
| UI Animation      | [framer-motion](https://www.framer.com/motion/)                                        |
| Icons             | [lucide-react](https://lucide.dev/)                                                    |
| Styling           | [TailwindCSS](https://tailwindcss.com/)                                                |

---

## Controls

| Action       | Keyboard                  | Mobile                                  |
| ------------ | ------------------------- | --------------------------------------- |
| Forward      | `W` / `↑` / `Z`           | Up button (left pad)                    |
| Backward     | `S` / `↓`                 | Down button (left pad)                  |
| Turn left    | `A` / `←` / `Q`           | Left button (right pad)                 |
| Turn right   | `D` / `→`                 | Right button (right pad)                |
| Brake        | `Space`                   | —                                       |

> The desktop controls hint hides on viewports `< md`. The mobile D-pad
> hides on viewports `≥ md`. Both write into a shared input store, so the
> controller code only ever reads from one source of truth.

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Drop the GLB models into /public (see "Assets" below)

# 3. Run the dev server
npm run dev

# 4. Build for production
npm run build && npm start
```

The app boots at `http://localhost:3000`.

---

## Project Structure

```
.
├── app/
│   ├── globals.css          # Tailwind + 100dvh body lockdown for mobile
│   ├── layout.js            # Metadata, viewport, body shell
│   └── page.js              # Server component → mounts <Experience>
├── components/
│   ├── Experience.js        # Top-level client: KeyboardControls + Canvas
│   ├── World.js             # Camera, lights, Sky, Environment, Physics root
│   ├── FollowCamera.js      # Frame-rate-independent isometric follow rig
│   ├── Ground.js            # Floating-island RigidBody + boundary walls
│   ├── Decorations.js       # Trees, lampposts, rocks (fixed colliders)
│   ├── Player.js            # VanMoof RigidBody + arcade controller
│   ├── Landmark.js          # Reusable: solid + sensor colliders, GLB loader
│   ├── InfoCard.js          # Animated glassmorphism overlay
│   ├── MobileControls.js    # Touch D-pad (md:hidden)
│   └── SocialDock.js        # Bottom pill: GitHub / LinkedIn / Mail
├── lib/
│   └── inputStore.js        # Mutable touch input merged with keyboard
├── public/
│   ├── vanmoof-transformed.glb
│   ├── haw-logo-transformed.glb
│   ├── designa-logo-transformed.glb
│   └── yekdoener-transformed.glb
└── docs/
    └── screenshots/         # Drop captures here for the README
```

---

## Assets

Three player + landmark models and one kebab-shop building, all loaded
through drei's `useGLTF` and preloaded at module init:

| File                                  | Role               | Material treatment |
| ------------------------------------- | ------------------ | ------------------ |
| `/vanmoof-transformed.glb`            | Player bike        | Slightly shiny     |
| `/haw-logo-transformed.glb`           | HAW Kiel landmark  | Chrome-y (`glossy`)|
| `/designa-logo-transformed.glb`       | Designa landmark   | Chrome-y (`glossy`)|
| `/yekdoener-transformed.glb`          | Dönerladen building| Baked materials    |

The logos float and bob (`<Float>`) with a chrome-y PBR override so they
catch the HDRI. The kebab shop sits on the ground (`floating={false}`,
`glossy={false}`) and keeps its original baked materials.

> **Generating optimized models:** the `*-transformed` suffix follows the
> [`gltfjsx`](https://github.com/pmndrs/gltfjsx) convention. To
> regenerate: `npx gltfjsx ./model.glb --transform`.

---

## Customization

### Add a new landmark

1. Drop the GLB into `/public/`.
2. Add the German content block to `LANDMARKS` in `components/Experience.js`:
   ```js
   newLandmark: {
     id: "newLandmark",
     title: "Title",
     subtitle: "Subtitle",
     text: "Body copy.",
     color: "#a78bfa",
     accent: "#7c3aed",
   }
   ```
3. Add a `<Landmark>` instance to `components/World.js`:
   ```jsx
   <Landmark
     id="newLandmark"
     model="/your-model-transformed.glb"
     position={[8, 0, 8]}
     colliderHalfExtents={[1.5, 1.5, 1.5]}
     sensorHalfExtents={[3, 2.4, 3]}
     color="#a78bfa"
     glow="#7c3aed"
     onEnter={onEnter}
     onExit={onExit}
   />
   ```

### Tune the bike feel

`components/Player.js` — top-of-file constants:

```js
const MAX_SPEED  = 7.5;   // m/s cap
const ACCEL      = 6;     // velocity-lerp factor (units/s)
const TURN_SPEED = 2.6;   // angular velocity (rad/s)
```

### Move the camera angle

`components/World.js` → `<FollowCamera offset={[12, 14, 12]} />`. Increase
the Y component for a more top-down look; decrease X/Z for a tighter
chase.

---

## Performance Notes

- The Canvas uses `dpr={[1, 2]}` so retina screens get crispness without
  blowing up GPU fill on 4K displays.
- All scratch math (`Vector3`, `Quaternion`, `Euler`) is hoisted out of
  `useFrame` to avoid GC pressure in the hot loop.
- Soft shadows use PCSS via drei's `<SoftShadows>` with conservative
  samples (12).
- Bloom runs `mipmapBlur` with a high `luminanceThreshold` so only the
  bright bits (lamps, beacons, sun) glow.

---

## License

MIT © Numan Yesil

---

## Credits

- The R3F / drei / rapier ecosystem by [Poimandres](https://pmnd.rs/).
- VanMoof S3 reference geometry — used for the player avatar placeholder.
- Built with a lot of `useFrame` and a little German stubbornness.
