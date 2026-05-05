"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Four hidden discoveries scattered across the map. Each one is a small
 * procedural prop (no GLB required) wrapped in a clickable group that
 * delegates to the same `onClickOpen` handler the landmarks already use.
 *
 * Implementation notes:
 *  - Procedural geometry only — keeps the bundle small and lets us tweak
 *    sizing/styling without round-tripping a modelling tool.
 *  - Each egg has an invisible "click bubble" (a transparent box) that's
 *    larger than the visible mesh so it's easier to tap on mobile.
 *  - A subtle pulsing halo on the ground hints at discoverability for
 *    eggs that aren't obviously visible (Pi Zero, Plate). The kebab
 *    router and the shipping container are sized to be self-evident.
 *  - The visible meshes themselves don't intercept pointer events
 *    (raycast: false on the visual group via the `raycast` prop), so the
 *    bigger click bubble always wins.
 */

// ─── Generic helpers ────────────────────────────────────────────────────────

function BlinkingLED({ position, color = "#a3e635", speed = 3.0, phase = 0 }) {
  const ref = useRef();
  useFrame((s) => {
    if (!ref.current) return;
    const t = s.clock.getElapsedTime();
    const blink = Math.sin(t * speed + phase) > 0.2 ? 3.5 : 0.4;
    ref.current.material.emissiveIntensity = blink;
  });
  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.05, 10, 10]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.5}
        toneMapped={false}
      />
    </mesh>
  );
}

function PulseHalo({ color, radius = 0.9 }) {
  const ref = useRef();
  useFrame((s) => {
    if (!ref.current) return;
    const t = s.clock.getElapsedTime();
    const op = 0.18 + Math.sin(t * 1.6) * 0.10;
    ref.current.material.opacity = op;
  });
  return (
    <mesh
      ref={ref}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.022, 0]}
      renderOrder={1}
    >
      <ringGeometry args={[radius * 0.78, radius, 48]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.22}
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}

/**
 * Wraps the visual prop in:
 *  - a hover/click region (invisible larger box)
 *  - an optional pulsing ground halo for discoverability
 */
function EggMarker({
  id,
  position,
  rotation = 0,
  color,
  hint = true,
  haloRadius,
  clickBubble = [1.6, 1.8, 1.6],
  clickOffsetY = 0.6,
  onClickOpen,
  children,
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {hint && <PulseHalo color={color} radius={haloRadius ?? clickBubble[0] * 0.8} />}
      {children}
      <mesh
        position={[0, clickOffsetY, 0]}
        onClick={(e) => { e.stopPropagation(); onClickOpen?.(id); }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={()  => (document.body.style.cursor = "auto")}
      >
        <boxGeometry args={clickBubble} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ─── Egg 1: Raspberry Pi Zero ────────────────────────────────────────────────
// Tiny green PCB tucked at the edge of the HQ plaza. Just visible enough to
// catch the eye if you stop to look around.

function RaspberryPiModel() {
  return (
    <group>
      {/* PCB — slightly raised off the ground so it's not fighting the plaza */}
      <mesh position={[0, 0.04, 0]} castShadow>
        <boxGeometry args={[1.05, 0.05, 0.5]} />
        <meshStandardMaterial color="#176235" roughness={0.4} metalness={0.25} />
      </mesh>
      {/* Solder mask edge */}
      <mesh position={[0, 0.066, 0]}>
        <boxGeometry args={[1.07, 0.005, 0.52]} />
        <meshStandardMaterial color="#0e3d20" roughness={0.6} />
      </mesh>
      {/* SoC chip */}
      <mesh position={[-0.05, 0.10, 0]} castShadow>
        <boxGeometry args={[0.30, 0.06, 0.30]} />
        <meshStandardMaterial color="#1c1f2c" roughness={0.5} metalness={0.45} />
      </mesh>
      {/* Tiny chip silkscreen square */}
      <mesh position={[-0.05, 0.131, 0]}>
        <boxGeometry args={[0.18, 0.002, 0.18]} />
        <meshStandardMaterial color="#3a3a44" />
      </mesh>
      {/* GPIO header — gold-coloured pins along the long edge */}
      {Array.from({ length: 20 }, (_, i) => (
        <mesh
          key={`pin-${i}`}
          position={[-0.42 + i * 0.044, 0.10, -0.20]}
          castShadow
        >
          <boxGeometry args={[0.025, 0.06, 0.025]} />
          <meshStandardMaterial color="#d4a85a" metalness={0.85} roughness={0.3} />
        </mesh>
      ))}
      {/* Mini-USB / HDMI clusters at one edge */}
      <mesh position={[0.42, 0.085, 0.10]} castShadow>
        <boxGeometry args={[0.16, 0.07, 0.20]} />
        <meshStandardMaterial color="#7a7a82" metalness={0.7} roughness={0.45} />
      </mesh>
      <mesh position={[0.42, 0.085, -0.10]} castShadow>
        <boxGeometry args={[0.13, 0.06, 0.13]} />
        <meshStandardMaterial color="#7a7a82" metalness={0.7} roughness={0.45} />
      </mesh>
      {/* Status LED that blinks — tiny but visible */}
      <BlinkingLED position={[0.27, 0.09, 0.18]} color="#a3e635" speed={4} />
    </group>
  );
}

// ─── Egg 2: Compromised Router ───────────────────────────────────────────────

function RouterModel() {
  return (
    <group>
      {/* Body */}
      <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.05, 0.22, 0.65]} />
        <meshStandardMaterial color="#1c1c20" roughness={0.6} metalness={0.25} />
      </mesh>
      {/* Top vent strip */}
      <mesh position={[0, 0.232, 0]}>
        <boxGeometry args={[0.85, 0.005, 0.5]} />
        <meshStandardMaterial color="#0a0a0c" roughness={0.95} />
      </mesh>
      {/* Antennas */}
      {[-0.42, 0, 0.42].map((x, i) => (
        <group key={`ant-${i}`} position={[x, 0.23, -0.28]}>
          <mesh position={[0, 0.5, 0]} castShadow>
            <cylinderGeometry args={[0.025, 0.03, 1.0, 6]} />
            <meshStandardMaterial color="#0a0a0c" roughness={0.7} metalness={0.4} />
          </mesh>
          <mesh position={[0, 1.02, 0]}>
            <sphereGeometry args={[0.04, 10, 10]} />
            <meshStandardMaterial color="#1a1a1c" metalness={0.4} roughness={0.6} />
          </mesh>
        </group>
      ))}
      {/* Front-panel status LEDs — orange/red implies "compromised" */}
      <BlinkingLED position={[-0.32, 0.12, 0.34]} color="#22d3ee" speed={2.6} phase={0.2} />
      <BlinkingLED position={[-0.16, 0.12, 0.34]} color="#34d399" speed={2.6} phase={0.6} />
      <BlinkingLED position={[ 0.00, 0.12, 0.34]} color="#fbbf24" speed={2.6} phase={1.0} />
      <BlinkingLED position={[ 0.16, 0.12, 0.34]} color="#fb923c" speed={4.2} phase={0.0} />
      <BlinkingLED position={[ 0.32, 0.12, 0.34]} color="#ef4444" speed={5.5} phase={0.4} />
      {/* Power brick + cable trailing off behind */}
      <mesh position={[-0.55, 0.07, -0.16]} castShadow>
        <boxGeometry args={[0.22, 0.14, 0.14]} />
        <meshStandardMaterial color="#28282d" roughness={0.7} />
      </mesh>
      <mesh position={[-0.66, 0.045, 0.10]} rotation={[0.5, 0.6, 0.4]}>
        <cylinderGeometry args={[0.022, 0.022, 0.7, 6]} />
        <meshStandardMaterial color="#1a1a1d" roughness={0.85} />
      </mesh>
    </group>
  );
}

// ─── Egg 3: Shipping Container (Docker reference) ────────────────────────────

const CONTAINER_BLUE       = "#1d6fe0";
const CONTAINER_BLUE_DARK  = "#11498f";
const CONTAINER_BLUE_DEEP  = "#0a2d5b";

function ContainerModel() {
  // Corrugation = many thin vertical box ridges along the long sides.
  const ridges = useMemo(() => Array.from({ length: 16 }, (_, i) => -1.95 + i * 0.26), []);

  return (
    <group>
      {/* Main body */}
      <mesh position={[0, 0.95, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.2, 1.8, 1.85]} />
        <meshStandardMaterial color={CONTAINER_BLUE} roughness={0.7} metalness={0.18} />
      </mesh>

      {/* Vertical corrugation on both long sides */}
      {ridges.map((x, i) => (
        <group key={`ridge-${i}`}>
          <mesh position={[x, 0.95, 0.94]}>
            <boxGeometry args={[0.06, 1.6, 0.04]} />
            <meshStandardMaterial color={CONTAINER_BLUE_DARK} roughness={0.7} />
          </mesh>
          <mesh position={[x, 0.95, -0.94]}>
            <boxGeometry args={[0.06, 1.6, 0.04]} />
            <meshStandardMaterial color={CONTAINER_BLUE_DARK} roughness={0.7} />
          </mesh>
        </group>
      ))}

      {/* Container doors at one end */}
      <mesh position={[2.11, 0.95, 0]}>
        <boxGeometry args={[0.04, 1.6, 1.65]} />
        <meshStandardMaterial color="#2580f5" roughness={0.5} metalness={0.3} />
      </mesh>
      {[-0.45, 0.45].map((z, i) => (
        <mesh key={`door-bar-${i}`} position={[2.13, 0.95, z]}>
          <cylinderGeometry args={[0.04, 0.04, 1.55, 6]} />
          <meshStandardMaterial color="#1a4570" metalness={0.65} roughness={0.4} />
        </mesh>
      ))}
      {/* Door handles */}
      {[-0.45, 0.45].map((z, i) => (
        <mesh key={`door-h-${i}`} position={[2.16, 0.92, z]}>
          <boxGeometry args={[0.06, 0.20, 0.10]} />
          <meshStandardMaterial color="#0c2a4f" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}

      {/* Painted "DOCKER" emblem panel on the side */}
      <mesh position={[0, 1.30, 0.94]}>
        <boxGeometry args={[1.6, 0.46, 0.012]} />
        <meshStandardMaterial color="#0c5fc8" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* Whale silhouette: a stylised dome on top of the panel — flat so it
          reads as a logo. */}
      <mesh position={[-0.45, 1.31, 0.948]} rotation={[0, 0, 0]}>
        <sphereGeometry args={[0.18, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        <meshStandardMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      {/* Stack of small "containers" on the whale's back — three stacked
          rectangles, the visual shorthand for Docker. */}
      {[
        [-0.55, 1.42, 0.96, 0.10],
        [-0.40, 1.42, 0.96, 0.10],
        [-0.25, 1.42, 0.96, 0.10],
        [-0.48, 1.52, 0.96, 0.08],
        [-0.32, 1.52, 0.96, 0.08],
        [-0.40, 1.62, 0.96, 0.07],
      ].map(([x, y, z, h], i) => (
        <mesh key={`box-${i}`} position={[x, y, z]}>
          <boxGeometry args={[0.13, h, 0.012]} />
          <meshStandardMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      ))}

      {/* Floor rails / bottom frame */}
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[4.2, 0.12, 1.92]} />
        <meshStandardMaterial color={CONTAINER_BLUE_DEEP} roughness={0.85} />
      </mesh>
      {/* Corner castings — the brutally-square fittings at the box corners */}
      {[
        [-2.02, 0.10,  0.88], [ 2.02, 0.10,  0.88],
        [-2.02, 0.10, -0.88], [ 2.02, 0.10, -0.88],
        [-2.02, 1.78,  0.88], [ 2.02, 1.78,  0.88],
        [-2.02, 1.78, -0.88], [ 2.02, 1.78, -0.88],
      ].map((p, i) => (
        <mesh key={`cast-${i}`} position={p}>
          <boxGeometry args={[0.22, 0.18, 0.18]} />
          <meshStandardMaterial color="#0a2342" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Egg 4: 20 kg Plate (half-sunk in the meadow) ────────────────────────────

function DumbbellPlateModel() {
  // The plate stands vertical (like a wheel) and is tilted slightly so it
  // looks dropped & forgotten. Position is set so the lower half is below
  // y = 0 — half-buried in the grass.
  return (
    <group rotation={[0, 0.3, 0.18]} position={[0, 0.10, 0]}>
      {/* Outer plate body */}
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.55, 0.55, 0.10, 36]} />
        <meshStandardMaterial color="#15161a" metalness={0.55} roughness={0.45} />
      </mesh>
      {/* Slightly raised hub */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.13, 24]} />
        <meshStandardMaterial color="#1f1f24" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* Centre hole — narrow cylinder, dark inside */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <cylinderGeometry args={[0.052, 0.052, 0.16, 16]} />
        <meshBasicMaterial color="#000" side={THREE.DoubleSide} />
      </mesh>
      {/* "20 KG" raised oval ring on the front face */}
      <mesh rotation={[0, 0, 0]} position={[0, 0, 0.052]}>
        <ringGeometry args={[0.26, 0.34, 36]} />
        <meshStandardMaterial color="#a3a3a3" metalness={0.4} roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
      {/* Faint number text — three stamped marks at top to suggest weight */}
      {[-0.10, 0, 0.10].map((x, i) => (
        <mesh key={`mark-${i}`} position={[x, 0.30, 0.052]}>
          <boxGeometry args={[0.02, 0.04, 0.005]} />
          <meshStandardMaterial color="#cccccc" metalness={0.4} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Public export ───────────────────────────────────────────────────────────
export default function EasterEggs({ onClickOpen }) {
  return (
    <group>
      {/* Egg 1: Raspberry Pi — tucked at the south edge of the HQ plaza,
          just outside the cobblestone so it's discoverable but not in the
          way of the bike spawn. */}
      <EggMarker
        id="raspberrypi"
        position={[-3.6, 0, 6.4]}
        rotation={0.4}
        color="#a3e635"
        clickBubble={[1.6, 1.0, 1.0]}
        clickOffsetY={0.5}
        haloRadius={0.95}
        onClickOpen={onClickOpen}
      >
        <RaspberryPiModel />
      </EggMarker>

      {/* Egg 2: Router — behind the kebab plaza, in the grass. The kebab
          building sits at (8, 40) so we offset further into +z. */}
      <EggMarker
        id="router"
        position={[11, 0, 49]}
        rotation={-1.0}
        color="#fb923c"
        clickBubble={[1.6, 1.6, 1.4]}
        clickOffsetY={0.4}
        onClickOpen={onClickOpen}
      >
        <RouterModel />
      </EggMarker>

      {/* Egg 3: Shipping container — sits on the meadow off to the
          north-west of HQ, oriented at a casual angle. */}
      <EggMarker
        id="container"
        position={[-18, 0, -10]}
        rotation={0.55}
        color="#22d3ee"
        clickBubble={[4.6, 2.2, 2.4]}
        clickOffsetY={1.0}
        haloRadius={2.6}
        hint={false}
        onClickOpen={onClickOpen}
      >
        <ContainerModel />
      </EggMarker>

      {/* Egg 4: 20 kg plate — half-sunk in the grass between Designa and
          the kebab shop. */}
      <EggMarker
        id="weight"
        position={[26, 0, 12]}
        rotation={0.9}
        color="#f472b6"
        clickBubble={[1.4, 1.0, 1.0]}
        clickOffsetY={0.3}
        haloRadius={0.8}
        onClickOpen={onClickOpen}
      >
        <DumbbellPlateModel />
      </EggMarker>
    </group>
  );
}
