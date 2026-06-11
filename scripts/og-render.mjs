// OG-Image-Generator. Schreibt public/og-image.png als 1200×630 PNG.
//
// Register: warme Spielwelt — Aubergine-Fläche, Amatic-SC-Display,
// Nunito-Body, der leuchtende Reveal-Ring mit Bike-Piktogramm als Motiv.
//
// Run:
//   npm install --no-save sharp
//   node scripts/og-render.mjs
//
// Fonts: Amatic SC Bold + Nunito (TTF in ~/.fonts, fc-cache).

import sharp from "sharp";
import { writeFileSync } from "fs";

const W = 1200;
const H = 630;

const PAPER       = "rgba(255,255,255,0.94)";
const PAPER_MUTED = "rgba(255,255,255,0.66)";
const PAPER_DIM   = "rgba(255,255,255,0.42)";
const SIGNAL      = "#ffceca";
const SUCCESS     = "#d5ff95";
const DISPLAY     = "'Amatic SC'";
const UI          = "'Nunito','DejaVu Sans',sans-serif";
const MONO        = "'DejaVu Sans Mono','Liberation Mono',monospace";

// Blueprint-Kreuzchen wie auf dem Boot-Grid
function crosses() {
  let out = "";
  const STEP = 96;
  for (let y = STEP / 2; y < H; y += STEP) {
    for (let x = STEP / 2; x < W; x += STEP) {
      out += `<path d="M ${x - 5} ${y - 5} L ${x + 5} ${y + 5} M ${x + 5} ${y - 5} L ${x - 5} ${y + 5}"
                    stroke="rgba(255,255,255,0.05)" stroke-width="2" fill="none"/>`;
    }
  }
  return out;
}

const RING_X = 920;
const RING_Y = 330;
const RING_R = 190;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="bg" cx="0.22" cy="0.18" r="1.25">
      <stop offset="0" stop-color="#2b2333"/>
      <stop offset="1" stop-color="#171219"/>
    </radialGradient>
    <radialGradient id="pool" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#3b4a2c"/>
      <stop offset="0.85" stop-color="#2c3a20"/>
      <stop offset="1" stop-color="#243018"/>
    </radialGradient>
    <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="10" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${crosses()}

  <!-- Reveal-Kreis rechts: Gras-Insel-Ausschnitt + leuchtender Ring + Bike -->
  <circle cx="${RING_X}" cy="${RING_Y}" r="${RING_R}" fill="url(#pool)"/>
  <circle cx="${RING_X}" cy="${RING_Y}" r="${RING_R}" fill="none"
          stroke="${SIGNAL}" stroke-width="6" filter="url(#glow)"/>

  <!-- Bike-Piktogramm (Strich-Stil, runde Kappen) -->
  <g transform="translate(${RING_X - 95} ${RING_Y - 50}) scale(1.05)"
     stroke="${PAPER}" stroke-width="7" fill="none"
     stroke-linecap="round" stroke-linejoin="round">
    <circle cx="40" cy="105" r="36"/>
    <circle cx="150" cy="105" r="36"/>
    <path d="M 40 105 L 76 45 L 128 45 L 150 105"/>
    <path d="M 76 45 L 102 105 L 40 105"/>
    <path d="M 70 32 L 86 32"/>
    <path d="M 128 45 L 120 24 L 136 21"/>
  </g>

  <!-- Gras-Büschel am Ring-Boden -->
  <g stroke="${SUCCESS}" stroke-width="4" stroke-linecap="round" opacity="0.8">
    <path d="M ${RING_X - 130} ${RING_Y + 120} q -4 -18 2 -28" fill="none"/>
    <path d="M ${RING_X - 118} ${RING_Y + 122} q 2 -16 8 -22" fill="none"/>
    <path d="M ${RING_X + 110} ${RING_Y + 112} q -2 -18 4 -26" fill="none"/>
    <path d="M ${RING_X + 124} ${RING_Y + 108} q 4 -14 10 -18" fill="none"/>
  </g>

  <!-- Links: Kicker, Name, Tagline, Meta -->
  <text x="84" y="150" font-family="${MONO}" font-size="22" fill="${PAPER_DIM}"
        letter-spacing="0.04em">// numan-yesil.com</text>

  <text x="80" y="305" font-family="${DISPLAY}" font-weight="700"
        font-size="150" fill="${PAPER}">Numan Yesil</text>

  <text x="84" y="375" font-family="${UI}" font-weight="700" font-size="33"
        fill="${SIGNAL}">Eine Insel. Ein Fahrrad. Mein Werdegang.</text>

  <text x="84" y="430" font-family="${UI}" font-size="24" fill="${PAPER_MUTED}">
    Fahr durch mein interaktives 3D-Portfolio.
  </text>

  <text x="84" y="540" font-family="${UI}" font-weight="700" font-size="22" fill="${PAPER}">
    Wirtschaftsinformatik · HAW Kiel
  </text>
  <text x="84" y="572" font-family="${MONO}" font-size="17" fill="${PAPER_DIM}">
    github.com/numan7272 · Three.js + WebGPU + Rapier
  </text>
</svg>`;

writeFileSync("public/og-source.svg", svg);

await sharp(Buffer.from(svg), { density: 96 })
  .resize(W, H)
  .png({ compressionLevel: 9 })
  .toFile("public/og-image.png");

console.log("OG rendered:", W, "x", H, "→ public/og-image.png");
