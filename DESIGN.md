## Register

**Brand.** This is a portfolio. The design IS the product.

## Aesthetic Lane

**Brutalist Game-HUD.** Anchored corner-bracket overlays. Hairline rules. No glass. No gradients. No drop shadows. References: Death Stranding HUD, are.na, Teenage Engineering field manuals.

Anti-references: glassmorphism, blue-on-dark "tech minimal", rounded translucent cards, gradient text or accent bars, gear-icon settings rotated 60° on open, pill-shaped skill chips.

## Color tokens

OKLCH. Neutrals tinted toward Indigo/Amber. One signal color, ≤8% surface.

| Token | OKLCH | Use |
|---|---|---|
| `--ink` | `oklch(13% .015 250)` | overlay background |
| `--ink-solid` | `oklch(13% .015 250 / .92)` | overlay background with alpha |
| `--paper` | `oklch(94% .015 75)` | primary foreground, body text |
| `--paper-muted` | `oklch(72% .02 75)` | metadata, labels, hints |
| `--paper-dim` | `oklch(55% .02 75)` | de-emphasized text |
| `--rule` | `oklch(94% .015 75 / .18)` | hairline borders |
| `--rule-strong` | `oklch(94% .015 75 / .40)` | active borders |
| `--signal` | `oklch(72% .22 25)` | hot coral. Active state, alerts, primary CTA, speed peak |
| `--signal-dim` | `oklch(72% .22 25 / .25)` | signal background fill |

`#000` and `#fff` are banned. Every neutral carries chroma.

## Type system

**Primary:** Departure Mono (self-hosted, OFL). Bitmap-style monospace. Place file at `public/fonts/DepartureMono-Regular.woff2`. Until then JetBrains Mono renders.

**Stack:** `'Departure Mono', 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace`

Single family. Weight + size carry hierarchy; no second family.

| Role | Size | Weight | Notes |
|---|---|---|---|
| Display | `clamp(48px, 7vw, 96px)` | 400 | speed value, hero numerals, tabular-nums |
| Title | `28px` | 400 | InfoCard / LoadingSplash heading |
| Body | `14px` | 400 | InfoCard text, descriptions |
| Label | `12px` | 400 | settings rows, button labels |
| Caption | `11px` | 400 | unit labels, timestamps |
| Micro | `10px` | 400 | FPS counter, footnote |

**No `text-transform: uppercase` + `letter-spacing` combo as section-grammar.** One persistent kicker is allowed (the `▌SPEED` block); everything else uses lowercase mono or sentence-case.

**Line-height** 1.5 for body, 1.0 for numerals.

## Layout primitives

- **Corner brackets** instead of card borders. 12px arms, 1px stroke `--rule-strong`. Drawn via CSS `::before`/`::after` per-corner pseudo-elements.
- **Hairline rules** at `1px solid var(--rule)`. Used to separate sections inside an overlay.
- **No `border-radius` above 2px.** Hard corners are the voice. Mono numeric blocks may use `2px` for legibility, nothing more.
- **No `backdrop-filter`.** Surface uses `--ink-solid` (92% alpha). The 3D scene reads through opacity, not blur.
- **No `box-shadow`.** If separation is needed, use a hairline.
- **Anchored to viewport edges.** Speed bottom-left. Settings top-left. InfoCard right. Toast top-center. FPS bottom-right. LoadingSplash centered (only exception, welcome moment).

## Motion

- **Transform + opacity only.** No animating `width`, `height`, `padding`, `top`, `left`, `border-radius`, `filter`.
- **Ease-out-expo:** `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Durations:** 180ms (hover/state), 280ms (panel open/close), 340ms (entrance from off-screen).
- **`prefers-reduced-motion: reduce` → all durations 0ms, opacity-only transitions.**

## Copy voice

- Mono terminal phrasing. lowercase by default.
- **No em dashes.** Replace with periods, commas, colons. `--` also banned.
- One bracketed hotkey hint per affordance: `[ESC]`, `[F1]`, `[TAB]`.
- Boot-log lines use `>` prefix + right-aligned `ok` / `fail` status.

## Accessibility

- All interactive elements: visible `:focus-visible` ring (`outline: 2px solid var(--signal); outline-offset: 2px`).
- All buttons: `aria-label` when icon-only.
- Toggle-groups: `role="radiogroup"` + `role="radio"` + `aria-checked`.
- Modals: `role="dialog"` + `aria-modal="true"`; focus trapped on open; `Esc` closes.
- Touch targets ≥ 44 × 44px.
- Color contrast: paper-on-ink = ~13:1; signal-on-ink = ~5.2:1 (AA Large + UI).

## Component anchors

| Component | Anchor | Default visibility | Signal usage |
|---|---|---|---|
| LoadingSplash | viewport-center | until ready+start | Start CTA when ready |
| SpeedHud | bottom-left, 24px inset | always | numeral when speed ≥ 25 km/h |
| RecenterButton | bottom-center, 100px above edge | only when `followMode=false` | hover-only |
| SettingsPanel button | top-left, 20px inset | always | active toggle hairline |
| SettingsPanel surface | below button, anchored | toggled | active toggle hairline |
| InfoCard | right edge, 24px inset, vertical-center | on station/egg show | accent-bar replaced by hairline |
| Discovery toast | top-center, 70px from top | 2.8s on discovery | signal hairline left + signal text |
| FPS counter | bottom-right, 16px inset | always | numeral when fps < 55 |
| HotkeyHelp button | bottom-left, 20px inset | hidden on touch | hover-only |
| HotkeyHelp overlay | viewport-center, dialog | F1/? toggle | none |
| BuildingsHint toast | top-right (mobile: bottom) | first-run, 9s | signal hairline left |
| ControlModePicker | viewport-center dialog | first mobile visit | active card hairline |
