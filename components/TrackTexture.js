"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { bikeState } from "@/lib/bikeStore";
import { trackState } from "@/lib/trackTexture";

/**
 * Bruno-Simon-style track-texture pipeline.
 *
 * Maintains a separate THREE.Scene + OrthographicCamera looking straight
 * down at the play area, with a pool of "stamp" meshes positioned where
 * the bike has driven. Each frame:
 *   1. Emit a new stamp at the bike's current position (cap rate so we
 *      don't burn the slot pool at low FPS).
 *   2. Age every alive stamp; their material opacity decays so old
 *      tracks fade out instead of accumulating forever.
 *   3. Render the off-screen scene into a WebGLRenderTarget.
 *
 * The render-target's texture is exposed via `trackState.texture` so the
 * grass shader can sample it per-blade and squash blades whose world
 * position has been recently driven over. Pure visual feedback — the
 * physics layer doesn't care about it.
 *
 * Pool size + emit rate strike a balance between trail length and GPU
 * cost: 220 stamps × 0.04 s emit = ~8.8 s of trail at top speed, plenty
 * for the player to see their own circles.
 */

const TEX_SIZE   = 256;
const STAMP_LIFE = 6.5;        // seconds before a stamp is fully invisible
const STAMP_POOL = 220;
const EMIT_HZ    = 1 / 0.04;
const STAMP_RAD  = 0.8;        // metres, the disc radius painted per stamp

export default function TrackTexture() {
  const gl = useThree((s) => s.gl);

  // Off-screen camera looking straight down at the play area
  const camera = useMemo(() => {
    const half = trackState.worldSize / 2;
    const c = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 30);
    c.position.set(0, 20, 0);
    c.lookAt(0, 0, 0);
    return c;
  }, []);

  const offScene = useMemo(() => new THREE.Scene(), []);

  const target = useMemo(() => {
    const t = new THREE.WebGLRenderTarget(TEX_SIZE, TEX_SIZE, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      depthBuffer: false,
      stencilBuffer: false,
    });
    return t;
  }, []);

  // Shared stamp geometry (thin disc) so all 220 stamps reuse it.
  const stampGeom = useMemo(() => new THREE.CircleGeometry(STAMP_RAD, 14), []);

  // Pool of stamp meshes with their own materials so we can fade per-instance
  // via material.opacity. Lighter than rebuilding 220 instanceColor each frame.
  const stamps = useMemo(() => {
    const arr = [];
    for (let i = 0; i < STAMP_POOL; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
      });
      const mesh = new THREE.Mesh(stampGeom, mat);
      mesh.rotation.x = -Math.PI / 2;     // lie flat so the ortho cam sees it
      mesh.position.set(0, 0, 0);
      mesh.visible = false;
      offScene.add(mesh);
      arr.push({ mesh, mat, age: STAMP_LIFE + 1, alive: false });
    }
    return arr;
  }, [offScene, stampGeom]);

  const headIdx   = useRef(0);
  const lastEmit  = useRef(-1e6);

  // Hook the texture into shared state so the grass shader can read it
  // even though it lives in a different component tree.
  useEffect(() => {
    trackState.texture = target.texture;
    return () => {
      if (trackState.texture === target.texture) trackState.texture = null;
      target.dispose();
      stamps.forEach((s) => s.mat.dispose());
    };
  }, [target, stamps]);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    // ── Emit a new stamp at the bike's current position ────────────────
    if (t - lastEmit.current >= 1 / EMIT_HZ) {
      lastEmit.current = t;
      const s = stamps[headIdx.current % STAMP_POOL];
      headIdx.current++;
      s.mesh.position.set(bikeState.x, 0, bikeState.z);
      s.mesh.visible = true;
      s.mat.opacity = 1.0;
      s.alive = true;
      s.age = 0;
    }

    // ── Age live stamps ─────────────────────────────────────────────────
    for (const s of stamps) {
      if (!s.alive) continue;
      s.age += delta;
      const k = 1 - s.age / STAMP_LIFE;
      if (k <= 0) {
        s.mesh.visible = false;
        s.alive = false;
        continue;
      }
      // Quadratic ease-out: linger then fade fast at the end
      s.mat.opacity = k * k;
    }

    // ── Render off-screen scene into the render target ────────────────
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(target);
    gl.setClearColor(0x000000, 1);
    gl.clear(true, false, false);
    gl.render(offScene, camera);
    gl.setRenderTarget(prev);
  });

  return null;
}
