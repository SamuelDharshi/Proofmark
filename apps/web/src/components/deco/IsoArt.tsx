"use client";
import { useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

/**
 * Flat isometric illustration, drawn as SVG. Each cube has three visible faces
 * (top, left, right) and each face is a flat colour or a tiled surface texture.
 */
export type Face = "black" | "white" | "pale" | "green" | "concrete" | "water" | "moss" | "chrome" | "grad";
export type Cube = [x: number, y: number, z: number, faces: [top: Face, left: Face, right: Face]];

const FLAT: Partial<Record<Face, string>> = { black: "#181a19", white: "#ffffff", pale: "#ececeb", green: "#38f997" };
const TEX: Partial<Record<Face, string>> = { concrete: "/tex/concrete.jpg", water: "/tex/water.jpg", moss: "/tex/moss.jpg", chrome: "/tex/chrome.jpg", grad: "/tex/gradient.jpg" };
const K = Math.sqrt(3) / 2;

type P = [number, number];
function project(x: number, y: number, z: number, u: number): P {
  return [(x - y) * K * u, (x + y) * 0.5 * u - z * u];
}
const pts = (a: P[]) => a.map((p) => p.map((n) => n.toFixed(1)).join(",")).join(" ");

export function IsoArt({ cubes, u = 96, id, className = "" }: { cubes: Cube[]; u?: number; id: string; className?: string }) {
  const sorted = [...cubes].sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]) || a[2] - b[2]);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const drawn = sorted.map(([x, y, z, f]) => {
    const top = [project(x, y, z + 1, u), project(x + 1, y, z + 1, u), project(x + 1, y + 1, z + 1, u), project(x, y + 1, z + 1, u)];
    const left = [project(x, y + 1, z, u), project(x + 1, y + 1, z, u), project(x + 1, y + 1, z + 1, u), project(x, y + 1, z + 1, u)];
    const right = [project(x + 1, y, z, u), project(x + 1, y + 1, z, u), project(x + 1, y + 1, z + 1, u), project(x + 1, y, z + 1, u)];
    for (const p of [...top, ...left, ...right]) {
      minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
    }
    return { top, left, right, f };
  });
  const fill = (m: Face) => (TEX[m] ? `url(#${id}-${m})` : FLAT[m]!);
  const ps = u * 4;
  const used = new Set<Face>();
  drawn.forEach((d) => d.f.forEach((m) => TEX[m] && used.add(m)));

  return (
    <svg
      className={className}
      viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
      shapeRendering="geometricPrecision"
      aria-hidden
    >
      <defs>
        {[...used].map((m) => (
          <pattern key={m} id={`${id}-${m}`} patternUnits="userSpaceOnUse" width={ps} height={ps} x={minX} y={minY}>
            <image href={TEX[m]} width={ps} height={ps} preserveAspectRatio="none" />
          </pattern>
        ))}
      </defs>
      {drawn.map((d, i) => (
        <g key={i} strokeWidth={0.8} strokeLinejoin="round">
          <polygon points={pts(d.top)} fill={fill(d.f[0])} stroke={fill(d.f[0])} />
          <polygon points={pts(d.left)} fill={fill(d.f[1])} stroke={fill(d.f[1])} />
          <polygon points={pts(d.right)} fill={fill(d.f[2])} stroke={fill(d.f[2])} />
        </g>
      ))}
    </svg>
  );
}

/* ----------------------------------------------------------------- scenes */

export const HERO: Cube[] = [
  [0, 0, 0, ["concrete", "black", "black"]],
  [1, 0, 0, ["white", "pale", "white"]],
  [2, 0, 0, ["water", "grad", "black"]],
  [3, 0, 0, ["white", "white", "black"]],
  [0, 1, 0, ["black", "black", "white"]],
  [1, 1, 0, ["concrete", "concrete", "concrete"]],
  [2, 1, 0, ["green", "pale", "grad"]],
  [3, 1, 0, ["black", "black", "white"]],
  [0, 2, 0, ["white", "pale", "black"]],
  [1, 2, 0, ["water", "white", "black"]],
  [2, 2, 0, ["black", "black", "black"]],
  [0, 0, 1, ["white", "pale", "white"]],
  [1, 0, 1, ["concrete", "pale", "concrete"]],
  [2, 0, 1, ["green", "white", "black"]],
  [1, 1, 1, ["chrome", "chrome", "white"]],
  [2, 1, 1, ["water", "grad", "black"]],
  [0, 1, 1, ["black", "black", "black"]],
  [0, 0, 2, ["moss", "black", "black"]],
  [1, 0, 2, ["white", "pale", "white"]],
  [1, 1, 2, ["concrete", "white", "pale"]],
];

export const FOOT: Cube[] = [
  [-1, 1, 0, ["moss", "moss", "moss"]],
  [0, 1, 0, ["concrete", "concrete", "pale"]],
  [0, 0, 0, ["white", "white", "white"]],
  [1, 0, 0, ["white", "pale", "white"]],
  [0, 0, 1, ["chrome", "chrome", "green"]],
  [1, 0, 1, ["white", "white", "white"]],
  [0, 0, 2, ["chrome", "chrome", "white"]],
];

/** A tiling field of mixed-height cubes for the full-bleed pattern band. */
export function field(cols: number, rows: number, seed = 3): Cube[] {
  const mats: Face[] = ["concrete", "white", "moss", "black", "water", "chrome", "green", "grad", "pale"];
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const out: Cube[] = [];
  for (let x = 0; x < cols; x++)
    for (let y = 0; y < rows; y++) {
      const h = ((x * 2 + y) % 3) + 1;
      for (let z = 0; z < h; z++) {
        const pick = () => mats[Math.floor(rnd() * mats.length)];
        out.push([x, y, z, [z === h - 1 ? pick() : "white", pick(), pick()]]);
      }
    }
  return out;
}

/* -------------------------------------------------------------- hero art */

/** The hero illustration: cropped off the corner, drifting with the pointer, moon and sphere floating above. */
export function HeroArt({ className = "" }: { className?: string }) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(useTransform(mx, (v) => v * -18), { stiffness: 60, damping: 20 });
  const y = useSpring(useTransform(my, (v) => v * -12), { stiffness: 60, damping: 20 });
  const mxs = useSpring(useTransform(mx, (v) => v * -34), { stiffness: 50, damping: 20 });

  useEffect(() => {
    const move = (e: PointerEvent) => {
      mx.set((e.clientX / window.innerWidth - 0.5) * 2);
      my.set((e.clientY / window.innerHeight - 0.5) * 2);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [mx, my]);

  return (
    <div aria-hidden className={`pointer-events-none ${className}`}>
      <motion.div style={{ x: mxs }} className="absolute left-[6%] top-[15%] w-[12%]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/tex/moon.png" alt="" className="w-full" />
        <span className="absolute left-1/2 top-full h-[700px] w-px bg-line-strong" />
      </motion.div>
      <motion.div style={{ x, y }} className="absolute inset-0">
        <span className="absolute left-[34%] -top-[16%] h-[34%] w-[34%] rounded-full" style={{ background: "radial-gradient(circle at 40% 62%, #6d6d6d 0, #2a2a2a 38%, #0c0c0c 72%)" }} />
        <IsoArt cubes={HERO} u={110} id="hero" className="absolute -right-[10%] -top-[4%] w-[112%]" />
      </motion.div>
    </div>
  );
}
