# Session Handoff · About-Me v2

> Übergabe-Doc für eine neue Claude-Code-Session. Zeigt was bisher gemacht
> wurde, welche Design-Entscheidungen gefällt sind, was noch offen ist.

## Projekt

Interaktives 3D-Portfolio von **Numan Yesil** (Wirtschaftsinformatik HAW Kiel,
20). User fährt mit einem VanMoof-S3-Bike über eine kleine Insel, klickt 5
Gebäude (Stationen Yek/THG/HAW/Designa/HQ) und entdeckt 4 Easter-Egg-Labs
(Router-Pentest, Container, Dumbbell, Pi Zero W).

Stack: Vite 8 + Three.js r184 (WebGL + WebGPU/TSL dual-pipeline) + Rapier3D
WASM Physics + React (nur für UI-Overlay) + Zustand store. Deployed auf
Vercel. Production: `https://numan-yesil.com`.

## Branch + Stand

Aktiver Branch: **`claude/document-skills-z4rmM`** (9 commits ahead von main,
gepusht zu Origin, Vercel-Preview-Deploy läuft pro Push).

Letzter Commit: `ed56dec` *fix(eggs): catch Egg_Container_Whale_* sub-meshes
+ aggressive bullet shortening + drawer redesign*.

```bash
git log --oneline -10 claude/document-skills-z4rmM
ed56dec fix(eggs): catch Egg_Container_Whale_* and other sub-meshes
8cbfc0e content(welcome): bump age to 20 and fix abbreviations + em-dash
7173007 feat(hud): mobile-polish + speed cap + variety pass
0fcd892 fix(scene): scope env-map to bike only + fix WebGL blowout
03d7c9d fix(bike): defensive material neutralization + variety pass
f24e704 fix(bike): strip USDZ-baked emissive + add PMREM env for PBR
ce26d25 chore(vercel): add immutable cache for assets and CSP/security headers
3332ec0 feat(renderer): robustness pack for WebGPU pipeline
d51ecb8 feat(ui): rework all overlays to Brutalist Game-HUD register
```

## Design-System (siehe `DESIGN.md` für Tokens)

Zwei Register, bewusst gemischt für Varietät:

### Brutalist Game-HUD · `oklch(13% .015 250)` ink, mono, hairline brackets
Für **Chrome / HUD / Telemetrie**:
- `Hud.js` (Speed, Recenter)
- `SettingsPanel.js`, `HotkeyHelp.js` (chrome-tier, kleiner)
- `MiniMap.js` (rechteckig, Mono-Karte mit Crosshairs)
- `DiscoveryHud.js` (Toast)
- `LoadingSplash.js` (Boot-Log)
- `BottomDrawer.js` (Tour-Drawer, mit Station-Color-Stripe links)
- `ContactPanel.js` (Side-Panel)
- `App.jsx` (FPS counter)
- `BuildingsHint.js`, `ControlModePicker.js`

### Editorial-Paper · `oklch(94% .018 75)` cream, mono, italic-mono titles
Für **Lese-Momente**:
- `InfoCard.js` (Station-Slide-in beim Building-Click)
- `WalkthroughController.js _showStartOverlay` (Welcome-Modal)
- `StationLabels3D.js` (3D-Schilder über Gebäuden)

### Tokens (in `src/index.css`)
- Ink-Register: `--ink`, `--ink-solid`, `--paper`, `--paper-muted/dim`, `--rule(-strong)`
- Paper-Register: `--paper-bg(-solid)`, `--ink-text`, `--ink-text-muted/dim`, `--ink-rule(-strong)`
- Shared: `--signal` (Hot Coral oklch(72% .22 25)), `--signal-dim`, `--ease`, `--font-mono`

### Typografie
- Primary: Departure Mono (self-hosted, **muss noch in `public/fonts/DepartureMono-Regular.woff2` gelegt werden** — bis dahin rendert JetBrains Mono via Google Fonts)
- Italic-Mono Variante (JetBrains Mono Italic 400/500) für 3D-Labels und kursive Akzente

## Was gerade konkret im Repo passierte

### Phase A · UI-Overhaul (Brutalist HUD)
8 Overlays vom AI-Slop-Glas-Default umgebaut. Keine Glassmorphism mehr, keine
Gradient-Buttons, keine Pill-Chips, keine tracked-uppercase-labels-als-Grammar,
keine em-dashes in Copy. Corner-Bracket Primitives in CSS.

### Phase B · 3D / Engine
- **Renderer.js**: Migration `PostProcessing → RenderPipeline` (r183+),
  WebGPU device-loss-Handler mit Recovery-Overlay, dispose-Cleanup.
- **PMREM Env-Map**: zuerst global gesetzt (war Bug → WebGL Blowout bei
  UnrealBloomPass-Threshold 0.85). Jetzt nur direkt auf Bike-Materials via
  `mat.envMap`. Buildings/Ocean/Grass bleiben in Original-Beleuchtung.
- **VanMoof GLB Defensive**: USDZ→glTF-Bake hatte Chrome_material mit
  `emissiveFactor=[1,1,1]` + Emissive-Texture (chrome-Teile glühten weiß).
  Fix in `Player._setupVisual`: Materials werden geklont, Emissive auf
  jedem Mat außer `light_rear` gestrippt, Metalness cap 0.85, Roughness
  floor 0.25, envMapIntensity 0.8, Fallback-baseColor pro Material-Name
  falls Texturen failen.
- **Egg-Mesh Defensive**: Docker-Whale war auch weiß (Sketchfab-Sub-Meshes
  `Egg_Container_Whale_*`). Fix in `Island.js`: defensive Material-Strip
  läuft auf JEDEM Mesh dessen Name mit `Egg_` startet, egal welches Suffix.

### Phase C · Mobile-Polish
- Speed-HUD auto-hide bei Idle (1.2s ohne Bewegung)
- Speed cap 25 km/h (war 32). Coral signalisiert "flat-out"
- FPS-Counter auf Mobile per Default hidden, opt-in via `?fps=1`
- Recenter-Button text-only bottom-right, auto-fade nach 8s
- Settings + HotkeyHelp als chrome-tier (kleiner, ohne Frame)
- BottomDrawer compact: numbered bullets `01 / 02 / 03`, 2-col Skills,
  kein Scroll mehr nötig auf 390×844
- Tour-Restart-Button next to MiniMap, text-link statt Pill

### Phase D · Content
- Welcome-Text: "20, aus Kiel, studiere…" (Geburtstag, korrekte Grammatik)
- Station-Titel gekürzt (Yek, THG, Designa)
- Alle Bullets aggressiv gekürzt (single-line wo möglich) für Drawer-Compact
- HQ von 5 auf 4 Bullets reduziert
- Em-dashes raus aus i18n (`stations.js`, `content.js`, `ContactPanel.js`)
- Contact "Availability"-Block entfernt (war: "Offen für Werkstudent /…")

### Phase E · Vercel-Production
`vercel.json` mit:
- 1-Jahr-immutable Cache für `/fonts/*`, `.woff2/.woff/.ttf/.otf`, `.glb/.gltf/.hdr/.ktx2/.basis`, `.mp3/.ogg/.wav`
- CSP: `default-src 'self'; script-src 'self' 'wasm-unsafe-eval' (Rapier);
  style-src 'self' 'unsafe-inline' fonts.googleapis.com;
  font-src 'self' fonts.gstatic.com; img-src 'self' data: blob:;
  worker-src 'self' blob:; ...; frame-ancestors 'none'`
- Security-Header: nosniff, Referrer-Policy, X-Frame-Options DENY,
  Permissions-Policy (kein FLoC, kein Mic/Cam/Geo)

## Skills installiert (`~/.claude/skills/`)

Verfügbar via `/<name>` oder via Skill-Tool:

1. **`impeccable`** (Apache 2.0, basiert auf Anthropic's frontend-design-skill)
   - Slash-Commands: `craft`, `shape`, `audit`, `critique`, `polish`, `bolder`,
     `quieter`, `distill`, `harden`, `onboard`, `animate`, `colorize`, `typeset`,
     `layout`, `delight`, `overdrive`, `clarify`, `adapt`, `optimize`,
     `teach`, `document`, `extract`, `live`
   - Reference docs in `~/.claude/skills/impeccable/reference/`
   - **Diese Session war hauptsächlich angewandte impeccable-Arbeit.**

2. **`webgpu-threejs-tsl`** (Reference-Skill, kein Slash-Command)
   - Docs: core-concepts, materials, compute-shaders, post-processing,
     wgsl-integration, device-loss, limits-and-features
   - Examples: basic-setup, custom-material, particle-system, earth-shader
   - **Wurde für Renderer.js Migration + Bike envMap angewandt.**

## Offene Punkte / TODOs (vom User noch nicht beauftragt)

- **Departure Mono woff2** noch nicht im Repo. User muss die Datei (OFL,
  https://departuremono.com) in `public/fonts/DepartureMono-Regular.woff2`
  ablegen. Bis dahin rendert JetBrains Mono (sieht auch gut aus).
- **Visual Verifikation auf Vercel-Deploy**: alles wurde nur in Screenshots
  vom User auf seinem iPhone gegen-getestet. Keine Browser-Tests aus
  dem Container möglich.
- **Drei Phase-2-Ideen offen** (nicht beauftragt, würden Sinn machen):
  - DayCycle-Übergang glätten (User berichtete von hartem Tag→Nacht-Sprung)
  - Tap-to-Move-Visual-Feedback polish (gibt nur einen Click-Ring)
  - BottomDrawer könnte auf Paper-Register umgestellt werden für Konsistenz
    mit InfoCard + Welcome (aktuell ist Drawer noch Ink mit Station-Stripe)

## Engine-Audit-Findings (siehe `webgpu-threejs-tsl` Skill)

Nicht alle gefixt, nur P2 *Robustness Pack* gemacht. P3 polish offen:

- `Grass.js:417` — `uLampCount` Uniform geschrieben aber im TSL-Loop nie
  gelesen (Loop läuft fest über 12 Slots, far-away defaults+falloff machen
  ungenutzte korrekt → 0, aber dead uniform)
- `Grass.js:756-759` — per-Frame Raycast gegen Terrain für View-Center-Y.
  Terrain ist statisch. Throttle auf 4-8 Hz oder Heightmap-Lookup würde
  Frames sparen.
- `Renderer.js:105` — `setClearColor(0x04060e)` ist die alte Cyan-Tint.
  Sollte auf neuen Ink `#101218` (oklch 13% .015 250) wenn Konsistenz wichtig.
- `Ocean.js:174-177` — `varying`, `cameraProjectionMatrix`, `cameraViewMatrix`,
  `time` importiert aus TSL aber nicht genutzt (lint flag).

## Wichtige Hinweise für nächste Session

- **DESIGN.md** lesen für Token-System.
- Vor JEDER UI-Änderung den **Register prüfen**: chrome → ink, lese-content → paper.
  Mischen kann variety bringen, aber nicht zufällig — bewusst.
- **Keine em-dashes (`—`)** in i18n-Copy oder User-Sichtbarer Text. Skill-Regel.
- **Keine Glassmorphism** (`backdrop-filter: blur`) als Default. Skill-Regel.
- **Keine Gradient-Buttons**. Skill-Regel.
- Mobile-Tests: Drawer auf 390×844 ohne Scroll. Speed-HUD nur bei Bewegung.
  FPS hidden außer `?fps=1`.

## How to continue

1. `git pull origin claude/document-skills-z4rmM`
2. `npm install`
3. `npm run dev` — Localhost mit HMR
4. Falls Visual-Iteration: `/impeccable live` (kommt mit dem Skill — startet
   ein Browser-Wrap das Element-Picks ermöglicht)
5. Vor Commits: `npm run build` (lint hat 28k pre-existing errors, nicht
   wertvoll); Vercel deployed auf jedem Push.

Branch ist ready für Merge in `main` sobald User Daumen hoch gibt.
