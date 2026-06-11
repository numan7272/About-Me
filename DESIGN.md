# Design Register

**Brand.** This is a portfolio. The design IS the product.

## Aesthetic Lane

**Baltic game-world chrome with a mono backbone ("Ostsee").** The UI should
feel like part of a hand-built game, not like a SaaS dashboard: deep petrol
surfaces (Kiel, Förde, island), warm sand accents, a handwritten display
face for big moments — while small labels, status lines and anything
terminal-adjacent keep a strict monospace voice.

Anti-references: glassmorphism on HUD chrome, blue-on-dark "tech minimal",
gradient text, pill-shaped skill chips, default-Bootstrap buttons.

## Color tokens

| Token | Value | Use |
|---|---|---|
| `--ink` | `#142120` | base background (deep petrol) |
| `--ink-solid` | `rgba(20,33,32,.95)` | overlay background with alpha |
| `--surface` | `radial-gradient(#1c2e2b → #142120)` | card/panel fill |
| `--paper` | `rgba(255,255,255,.92)` | primary foreground |
| `--paper-muted` | `rgba(255,255,255,.65)` | metadata, labels |
| `--paper-dim` | `rgba(255,255,255,.42)` | de-emphasized text |
| `--rule` | `rgba(255,255,255,.22)` | hairline borders |
| `--rule-strong` | `rgba(255,255,255,.55)` | button borders, active rules |
| `--signal` | `#ffd28a` | warm sand/amber: active state, CTA |
| `--success` | `#8fe3c0` | success states (seafoam) |
| `--danger` | `#ff8576` | errors, destructive |

Pure `#000`/`#fff` stay banned; white only ever appears with alpha.

## Type system

Three voices, each with a job:

| Face | Role | Where |
|---|---|---|
| **Quicksand** (500/600/700, Google) | UI/body | buttons, body copy, panels |
| **Caveat** (700, Google) | Display | names, panel titles, speed numeral, 3D station labels |
| **Departure Mono** (self-hosted, OFL) → JetBrains Mono | Mono backbone | `.hud-kicker` labels, status lines, units, FPS, terminals, code |

- `--font-ui`, `--font-display`, `--font-mono` in `:root`.
- Mono micro-labels use the `.hud-kicker` class (11px, 0.04em tracking).
- Sentence case by default. Lowercase mono is allowed only inside kickers
  and diegetic terminal output.

## Layout primitives

- **Cards** (`.hud-bracket`): `--surface` gradient fill, 1px `--rule` border,
  `--radius-card` (12px). The old corner brackets are retired; the class name
  stays for compatibility.
- **Buttons** (`.hud-btn`): outlined 1px `--rule-strong`, `--radius` (8px),
  Nunito 700. Hover brightens text + border to full white. Active state uses
  `--signal` for both.
- **Hairline rules** at `1px var(--rule)` separate sections inside a panel.
- **Anchors**: Speed bottom-left. Settings top-left. Contact + map top-right.
  InfoCard right. Toasts top-center / top-right with a 2px `--signal` left edge.

## Diegetic surfaces (easter eggs)

Mini-games (Kali terminal, NumanOS desktop, SQLi lab) are part of the game
fiction, not HUD chrome — they may use shadows, blur, scanlines and their own
palettes. Rules:

- Terminals run Departure Mono first and live in a floating window with
  traffic lights + subtle CRT scanlines (fullscreen on mobile).
- NumanOS mimics macOS faithfully (its own font stack, blur, dock).
- Whatever happens inside a fiction window stays inside it.

## Motion

- Transform + opacity only on HUD chrome.
- Ease-out-expo: `cubic-bezier(0.16, 1, 0.3, 1)`; 150-340ms.
- `prefers-reduced-motion: reduce` → all durations 0ms.

## Copy voice

- Friendly and direct, sentence case: "Los geht's", "Lass uns sprechen!"
- Mono kickers may keep the `>` prefix: `> willkommen`, `> end of tour`.
- One bracketed hotkey hint per affordance: `[esc]`, `[F1]`.

## Accessibility

- All interactive elements: visible `:focus-visible` ring
  (`outline: 2px solid var(--signal); outline-offset: 2px`) — applied
  globally to buttons, links and form fields.
- Icon-only buttons carry `aria-label`; toggle groups are radiogroups.
- Modals: `role="dialog"` + `aria-modal`; `Esc` closes.
- Touch targets ≥ 44 × 44px.
