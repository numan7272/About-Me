# About-Me · v2

> An interactive 3D portfolio. Drive a bike around a small island, discover stations that map to my education, work, and projects, and find a few hidden labs along the way.
>
> Built by **Numan Yesil** — Wirtschaftsinformatik @ HAW Kiel.

[![Three.js](https://img.shields.io/badge/three.js-r184-000000?logo=three.js)](https://threejs.org)
[![Vite](https://img.shields.io/badge/vite-8.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Rapier3D](https://img.shields.io/badge/rapier3d-0.19-2A2A2A)](https://rapier.rs)
[![WebGPU](https://img.shields.io/badge/WebGPU-experimental-FF6B6B)](https://www.w3.org/TR/webgpu/)
[![License](https://img.shields.io/badge/license-MIT-green)](#license)

---

## What this is

A from-scratch rewrite of [my old Next.js portfolio](https://github.com/numan7272/About-Me/tree/main) on a modern stack. Same idea — recruiters drive a bike, click stations, learn about me — but every layer rebuilt with the constraints of someone who's tired of fighting framework abstractions and wants tight control over the render loop, physics tick, and shader pipeline.

If you're a recruiter or hiring manager, the easiest entry is the **▶ Tour** button at the top of the page. It walks you through the 5 stations in 3-4 minutes.

If you're a developer, the bike physics, the dual-shader pipeline (WebGL `ShaderMaterial` + WebGPU `NodeMaterial`/TSL), and the in-world joystick are probably the most interesting bits in the source.

---

## Tech stack

| Layer        | Choice                                | Why                                                                                |
| ------------ | ------------------------------------- | ---------------------------------------------------------------------------------- |
| Bundler      | **Vite 8**                            | HMR for shader edits matters more than I expected                                  |
| Renderer     | **Three.js r184**                     | The post-`v0.170` API split + TSL was the right time to commit                     |
| Physics      | **Rapier3D-compat 0.19**              | Capsule colliders, deterministic, fast. WASM-loaded async, no native deps          |
| Shaders      | Custom **GLSL** + **TSL** (WebGPU)    | Two pipelines because Bruno Simon's devlogs were right — WebGPU is the way forward |
| State        | None                                  | Plain class-based singletons. No Redux, no Context, no overhead                    |
| Build target | ES2022 modules, no transpilation      | Modern browsers only — this is a portfolio, not enterprise software                |

There's a **React shell** for the menu chrome (`Settings`, `BottomDrawer`, `ContactPanel`, etc.) — but the canvas, the game loop, the physics step, and every shader live in plain ES modules. Wrapping `<Canvas>` in `react-three-fiber` would have been a downgrade for this use case.

---

## Architecture

```
src/
├── Game.js                # Singleton — owns scene, time, inputs, world
├── core/
│   ├── Renderer.js        # WebGL + WebGPU swappable. Bloom postprocess.
│   ├── CameraRig.js       # Follow-cam + OrbitControls + cinematic flyTo
│   ├── Time.js            # delta, elapsed, frame counter
│   ├── Inputs.js          # Keyboard + pointer + canvas events
│   └── Physics.js         # Rapier world, async-init, debug overlay
├── world/
│   ├── World.js           # Orchestrator: builds island, road, player, etc.
│   ├── Island.js          # GLB loader, building/egg/landmark indexing
│   ├── Player.js          # Bike rigidbody + visual + control logic
│   ├── Road.js            # Procedural curve through stations
│   ├── Grass.js           # Instanced grass — GLSL + TSL variants
│   ├── Ocean.js           # 2-octave fBm caustics
│   ├── StreetLamps.js     # Light-pool along the road
│   ├── DayCycle.js        # Time-of-day → ambient + sky
│   ├── ProximityTrigger.js
│   └── EggClickHandler.js # Raycast-clickable easter-egg meshes
├── ui/
│   ├── Hud.js             # Speed display
│   ├── MiniMap.js         # Top-right island map, collapsible
│   ├── TouchJoystick.js   # In-world 3D dot-trail joystick (mobile)
│   ├── walkthrough/       # Tour state machine + drawer
│   ├── miniGames/         # Easter-egg labs (see below)
│   └── ...
└── data/
    ├── content.js         # i18n strings (DE/EN)
    └── stations.js        # Station copy + tour order + camera setups
```

### Game loop

The canonical update order, applied in `World.update()` every frame:

```
DayCycle → Wind → Island → Road → StreetLamps → Grass → Ocean
       → Player (reads inputs, writes physics)
       → ProximityTrigger (egg + building enter/exit)
       → StationLabels (3D-text billboarding)
```

`CameraRig.update()` runs separately after the world step, in `Game.update()`.

### Bike controls

| Action       | Desktop                  | Mobile                          |
| ------------ | ------------------------ | ------------------------------- |
| Forward      | `W` / `↑`                | Joystick up                     |
| Backward     | `S` / `↓`                | Joystick down                   |
| Steer        | `A` `D` / `←` `→`        | Joystick left/right             |
| Brake        | `Space`                  | Pull joystick back hard         |
| Headlight    | `F`                      | (button, planned)               |
| Camera reset | (button bottom-right)    | (button bottom-right)           |

Movement uses **lerp-based velocity** (`lerpT = min(1, ACCEL * dt)`) rather than m/s² acceleration — the difference at high framerates is the classic Bruno-Simon "feel" where the bike eases into top speed instead of slingshotting. The joystick branch uses a P-controller for yaw correction plus a `cos(dy) * 0.5 + 0.5` alignment factor so the bike doesn't shoot off in the wrong direction during sharp turns.

---

## Hidden labs (easter eggs)

A handful of **interactive labs** are scattered around the island. Two of them are small offensive-security walkthroughs framed inside the story, not as a CTF showcase — but if you're from security you'll recognize the references.

- **Router-Egg** (somewhere on the island) — opens a sandboxed Kali-style terminal. Audit a fictional Hikvision IP-cam: `nmap`, `curl` for the banner, `telnet` with default credentials. CVE-2017-7921 is the reference. Story is real: this was the first network audit I did (my family's restaurant, 2022).
- **HQ-Building** (clickable directly) — boots a fake macOS desktop ("NumanOS"). Browser, Projects folder, Terminal, README. Hidden on the desktop: a `TODO_fix_sql_injection.txt` that opens a vulnerable login form with live SQL-query preview. Classic `' OR 1=1 --` bypass, plus an optional `UNION SELECT` level for exfiltration.

Both labs are **client-side sandboxes** — no real commands executed, no real network traffic. They exist to demonstrate that I can think through an attack path, not to claim wizard-level expertise.

---

## Run locally

```bash
git clone -b v2 https://github.com/numan7272/About-Me.git
cd About-Me
npm install
npm run dev
```

Opens at `http://localhost:5173/`. Append `?touch=1` to force the mobile joystick on desktop.

### Build

```bash
npm run build      # → dist/
npm run preview    # serve the built version
```

### Useful URL parameters

| Param           | Effect                                         |
| --------------- | ---------------------------------------------- |
| `?touch=1`      | Force mobile-style controls + joystick         |
| `?renderer=webgpu` | Try the WebGPU pipeline (Chromium 113+)     |
| `?debug=collider`  | Render physics-collider wireframes          |

---

## Performance notes

- WebGL pipeline: stable 100-120 FPS on mid-range laptops (RTX 3050, integrated AMD, etc.)
- WebGPU pipeline: similar with shadows enabled; bloom adds ~6-8% GPU cost
- Mobile: tested on Android Chrome — comfortable 55-60 FPS on devices ≥ 2022
- Grass: pre-culled per-instance via `aCulled` attribute, ~50% saved on a flat island
- Capsule collider on the bike instead of cuboid — fixed a long-standing "sticking on trimesh edges" bug

---

## Credits & inspiration

- **Bruno Simon** for [folio-2025](https://github.com/brunosimon/folio-2025) — the bike-on-an-island format and a number of small decisions (lerp-based bike feel, joystick as in-world 3D mesh, dual GLSL/TSL pipeline) are directly inspired by his devlogs.
- **Three.js team** for r184 — the WebGPU + TSL story finally feels production-shaped.
- **Rapier3D team** for `rapier3d-compat` — the WASM-compat fork makes async setup trivial.

---

## License

MIT — see [LICENSE](LICENSE). The bike GLB and island GLB are my own (Blender + procedural touch-ups); textures are royalty-free.

---

## Contact

- GitHub: [@numan7272](https://github.com/numan7272)
- LinkedIn: [in/numan-yesil](https://www.linkedin.com/in/numan-yesil)
- Email: hi@numan-yesil.com
- Live demo: https://numan-yesil.com

If you're hiring, my old portfolio's case-study is at [numan7272/About-Me on the legacy `main` branch](https://github.com/numan7272/About-Me/tree/main). This `v2` branch is the active one.
