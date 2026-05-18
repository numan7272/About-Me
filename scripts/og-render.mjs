// OG-Image-Generator. Schreibt public/og-image.png als 1200×630 PNG.
//
// Brutalist-HUD register: ink-solid Background, corner-brackets, italic
// mono Display-Title, single Coral-Signal-Akzent, kein Gradient-/Glas-/
// Pill-Slop.
//
// Run:
//   npm install --no-save sharp
//   node scripts/og-render.mjs
//
// System-Fonts: DejaVu Sans Mono (Linux) / Liberation Mono. Funktioniert
// in headless-Render via librsvg/sharp ohne extra Web-Font-Loading.

import sharp from "sharp";
import { writeFileSync } from "fs";

const W = 1200;
const H = 630;

const INK         = "#101218";
const PAPER       = "#f1efea";
const PAPER_MUTED = "#a59f96";
const PAPER_DIM   = "#736f68";
const RULE        = "rgba(241,239,234,0.18)";
const RULE_STRONG = "rgba(241,239,234,0.40)";
const SIGNAL      = "#ff5a3c";
const MONO        = "'DejaVu Sans Mono','Liberation Mono',monospace";

/** L-Shape Corner-Bracket. corner: 'tl'|'tr'|'bl'|'br' */
function bracket(x, y, corner, arm = 26, stroke = 2, color = RULE_STRONG) {
  const v = corner.includes("b") ? -arm : arm;
  const h = corner.includes("r") ? -arm : arm;
  return `<path d="M ${x} ${y + v} L ${x} ${y} L ${x + h} ${y}"
                fill="none" stroke="${color}" stroke-width="${stroke}" />`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"
                  viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${INK}" />

  <!-- Frame: 4 Corner-Brackets, 48px Inset -->
  ${bracket(48, 48,         "tl")}
  ${bracket(W - 48, 48,     "tr")}
  ${bracket(48, H - 48,     "bl")}
  ${bracket(W - 48, H - 48, "br")}

  <!-- TOP ROW: domain (links), status-marker mit signal-caret (rechts) -->
  <text x="80" y="108" font-family="${MONO}" font-size="22"
        fill="${PAPER_MUTED}" letter-spacing="0.02em">
    // numan-yesil.com
  </text>
  <text x="${W - 80}" y="108" font-family="${MONO}" font-size="20"
        fill="${PAPER}" text-anchor="end" letter-spacing="0.08em">
    <tspan fill="${SIGNAL}">▌</tspan><tspan dx="6">3D PORTFOLIO</tspan>
  </text>

  <line x1="80" y1="148" x2="${W - 80}" y2="148"
        stroke="${RULE}" stroke-width="1" />

  <!-- CENTER: Italic-Mono Display Headline, zwei Zeilen.
       Zweite Zeile in Signal-Coral als One-Word-Hierarchie. -->
  <text x="80" y="290" font-family="${MONO}" font-size="78"
        font-style="italic" fill="${PAPER}" letter-spacing="-0.02em">
    drive my portfolio.
  </text>
  <text x="80" y="378" font-family="${MONO}" font-size="78"
        font-style="italic" fill="${SIGNAL}" letter-spacing="-0.02em">
    hack the easter eggs.
  </text>

  <line x1="80" y1="448" x2="${W - 80}" y2="448"
        stroke="${RULE}" stroke-width="1" />

  <!-- BOTTOM-LEFT: Speed-HUD-Referenz (gleiche Komponente wie im Site-UI).
       25 = aktueller Top-Speed-Cap des Bikes. -->
  <g transform="translate(80 528)">
    <text font-family="${MONO}" font-size="44" fill="${PAPER}"
          letter-spacing="-0.02em" font-weight="bold">
      <tspan fill="${PAPER_MUTED}">▌</tspan><tspan dx="6">25</tspan>
      <tspan dx="10" font-size="16" fill="${PAPER_MUTED}"
             letter-spacing="0.06em">KM/H</tspan>
    </text>
    <text y="32" font-family="${MONO}" font-size="13"
          fill="${PAPER_DIM}" letter-spacing="0.08em">
      &gt; ride · click · explore
    </text>
  </g>

  <!-- BOTTOM-RIGHT: Author -->
  <g transform="translate(${W - 80} 510)" text-anchor="end">
    <text font-family="${MONO}" font-size="22" fill="${PAPER}"
          letter-spacing="-0.01em" font-weight="bold">
      NUMAN YESIL
    </text>
    <text y="28" font-family="${MONO}" font-size="14"
          fill="${PAPER_MUTED}" letter-spacing="0.03em">
      wirtschaftsinformatik · haw kiel
    </text>
    <text y="52" font-family="${MONO}" font-size="13"
          fill="${PAPER_DIM}" letter-spacing="0.03em">
      github.com/numan7272
    </text>
  </g>
</svg>`;

writeFileSync("public/og-source.svg", svg);

await sharp(Buffer.from(svg))
  .resize(W, H)
  .png({ compressionLevel: 9 })
  .toFile("public/og-image.png");

console.log("OG rendered:", W, "x", H, "→ public/og-image.png");
