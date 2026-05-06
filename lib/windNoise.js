import * as THREE from "three";

/**
 * Procedural wind-direction noise texture.
 *
 * Generates a tiling 64×64 DataTexture where the R/G channels encode a
 * 2D direction vector in [-1, 1] (stored 0..1, decoded in shader). Grass
 * shaders sample this texture at `worldXZ * scale + uTime * driftDir`
 * to get a spatially-varying, smoothly-flowing wind direction —
 * Bruno-Simon's approach instead of pure sine waves.
 *
 * The noise function is multi-octave value noise with bilinear
 * interpolation. Cheap on CPU, runs once at module load.
 */

const SIZE = 64;
const OCTAVES = 3;

// Tiny seeded PRNG so the texture is deterministic across reloads
function rng(seed) {
  let s = seed | 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) | 0;
    return ((s >>> 0) / 0xffffffff);
  };
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

/** 2D value noise tiling at SIZE on each axis. */
function valueNoise(grid, gx, gy) {
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const fx = gx - ix;
  const fy = gy - iy;
  // Wrap so the texture tiles seamlessly
  const wrap = (n) => ((n % SIZE) + SIZE) % SIZE;
  const a = grid[wrap(iy)     * SIZE + wrap(ix)    ];
  const b = grid[wrap(iy)     * SIZE + wrap(ix + 1)];
  const c = grid[wrap(iy + 1) * SIZE + wrap(ix)    ];
  const d = grid[wrap(iy + 1) * SIZE + wrap(ix + 1)];
  const sx = smoothstep(fx);
  const sy = smoothstep(fy);
  const ab = a + (b - a) * sx;
  const cd = c + (d - c) * sx;
  return ab + (cd - ab) * sy;
}

/** Build a multi-octave fbm sample at (x, y) in pixel coords. */
function fbm(grid, x, y) {
  let amp = 0.5;
  let freq = 1.0;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < OCTAVES; o++) {
    sum  += valueNoise(grid, x * freq / SIZE * 8, y * freq / SIZE * 8) * amp;
    norm += amp;
    amp  *= 0.55;
    freq *= 2.0;
  }
  return sum / norm;            // 0..1
}

let cached = null;

/** Returns the wind noise texture (created on first call, cached). */
export function getWindNoiseTexture() {
  if (cached) return cached;

  // Two independent random grids for the two axes (so X and Z noise are
  // not correlated — gives believable curl-y flow).
  const r = rng(0xa15d);
  const grid1 = new Float32Array(SIZE * SIZE);
  const grid2 = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    grid1[i] = r();
    grid2[i] = r();
  }

  // Float32 RGBA texture: R = wind X, G = wind Z, BA unused.
  const data = new Float32Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      // Map fbm 0..1 → -1..1 (signed direction)
      const wx = fbm(grid1, x, y) * 2 - 1;
      const wz = fbm(grid2, x, y) * 2 - 1;
      // Encode back to 0..1 (DataTexture FloatType actually accepts the
      // signed range, but storing 0..1 keeps us compatible with future
      // HalfFloat downgrades on weak GPUs).
      data[i + 0] = wx * 0.5 + 0.5;
      data[i + 1] = wz * 0.5 + 0.5;
      data[i + 2] = 0;
      data[i + 3] = 1;
    }
  }

  const tex = new THREE.DataTexture(
    data, SIZE, SIZE, THREE.RGBAFormat, THREE.FloatType,
  );
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;

  cached = tex;
  return tex;
}
