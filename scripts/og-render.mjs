// OG-Image-Generator. Schreibt public/og-image.png als 1200×630 PNG.
//
// Register "Ostsee": tiefes Petrol, Sand-Akzent, Caveat-Display +
// Quicksand-Body. Rein typografisch, als Motiv nur ruhige Wellen-Linien
// am unteren Rand (Kiel/Förde, ohne Piktogramm).
//
// Run:
//   npm install --no-save sharp
//   node scripts/og-render.mjs
//
// Fonts: Caveat + Quicksand (TTF in ~/.fonts, fc-cache -f).

import sharp from "sharp";
import { writeFileSync } from "fs";

const W = 1200;
const H = 630;

const PAPER       = "rgba(255,255,255,0.94)";
const PAPER_MUTED = "rgba(255,255,255,0.66)";
const PAPER_DIM   = "rgba(255,255,255,0.40)";
const SIGNAL      = "#ffd28a";
const SEAFOAM     = "#8fe3c0";
const DISPLAY     = "'Caveat'";
const UI          = "'Quicksand','DejaVu Sans',sans-serif";
const MONO        = "'DejaVu Sans Mono','Liberation Mono',monospace";

// Ruhige Wellen-Linien (3 Sinus-Züge) als Ostsee-Signatur
function waves() {
  let out = "";
  const rows = [
    { y: 520, amp: 9,  len: 170, color: "rgba(143,227,192,0.35)", w: 3 },
    { y: 552, amp: 12, len: 210, color: "rgba(143,227,192,0.22)", w: 3 },
    { y: 586, amp: 15, len: 260, color: "rgba(143,227,192,0.12)", w: 3 },
  ];
  for (const r of rows) {
    let d = `M -20 ${r.y}`;
    for (let x = -20; x <= W + 20; x += 10) {
      const y = r.y + Math.sin((x / r.len) * Math.PI * 2) * r.amp;
      d += ` L ${x} ${y.toFixed(1)}`;
    }
    out += `<path d="${d}" fill="none" stroke="${r.color}" stroke-width="${r.w}" stroke-linecap="round"/>`;
  }
  return out;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="bg" cx="0.25" cy="0.15" r="1.3">
      <stop offset="0" stop-color="#22332f"/>
      <stop offset="1" stop-color="#101b1a"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${waves()}

  <text x="86" y="138" font-family="${MONO}" font-size="21" fill="${PAPER_DIM}"
        letter-spacing="0.04em">// numan-yesil.com</text>

  <text x="80" y="300" font-family="${DISPLAY}" font-weight="700"
        font-size="170" fill="${PAPER}">Numan Yesil</text>

  <text x="86" y="372" font-family="${UI}" font-weight="700" font-size="34"
        fill="${SIGNAL}">Eine Insel. Ein Fahrrad. Mein Werdegang.</text>

  <text x="86" y="424" font-family="${UI}" font-weight="600" font-size="24"
        fill="${PAPER_MUTED}">Fahr durch mein interaktives 3D-Portfolio.</text>

  <text x="86" y="488" font-family="${UI}" font-weight="700" font-size="21" fill="${PAPER}">
    Wirtschaftsinformatik · HAW Kiel
    <tspan dx="14" fill="${SEAFOAM}" font-size="19">github.com/numan7272</tspan>
  </text>
</svg>`;

writeFileSync("public/og-source.svg", svg);

await sharp(Buffer.from(svg), { density: 96 })
  .resize(W, H)
  .png({ compressionLevel: 9 })
  .toFile("public/og-image.png");

console.log("OG rendered:", W, "x", H, "→ public/og-image.png");
