"use client";
import { useEffect, useRef } from "react";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";

type Mat = "white" | "black" | "green" | "concrete" | "water" | "chrome" | "moss";

const NOISE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.35 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

/** Surface per material. Each face gets a different light so the cube reads as solid. */
function face(m: Mat, light: 0 | 1 | 2): React.CSSProperties {
  const shade = ["rgba(0,0,0,0)", "rgba(0,0,0,0.12)", "rgba(0,0,0,0.3)"][light];
  const base: Record<Mat, string> = {
    white: "#f7f7f5",
    black: "#151515",
    green: "#38f997",
    concrete: `${NOISE}, linear-gradient(135deg,#d4d3d0,#a9a8a4)`,
    water: "repeating-radial-gradient(circle at 30% 20%,rgba(255,255,255,0.55) 0 3px,transparent 4px 16px), linear-gradient(135deg,#22d3ee,#0ea5e9 60%,#0369a1)",
    chrome: "conic-gradient(from 40deg at 50% 50%,#f8fafc,#94a3b8,#1e293b,#e2e8f0,#a5b4fc,#f1f5f9,#64748b,#f8fafc)",
    moss: `${NOISE}, radial-gradient(circle at 30% 30%,#65a30d,#365314 70%)`,
  };
  return { background: `linear-gradient(${shade},${shade}), ${base[m]}` };
}

function Cube({ x, y, z, s, m }: { x: number; y: number; z: number; s: number; m: Mat }) {
  const h = s / 2;
  const f = (t: string, l: 0 | 1 | 2): React.CSSProperties => ({ position: "absolute", inset: 0, transform: t, backfaceVisibility: "hidden", ...face(m, l) });
  return (
    <div style={{ position: "absolute", width: s, height: s, transformStyle: "preserve-3d", transform: `translate3d(${x * s}px, ${-y * s}px, ${z * s}px)` }}>
      <div style={f(`translateZ(${h}px)`, 0)} />
      <div style={f(`rotateY(90deg) translateZ(${h}px)`, 1)} />
      <div style={f(`rotateY(180deg) translateZ(${h}px)`, 2)} />
      <div style={f(`rotateY(-90deg) translateZ(${h}px)`, 1)} />
      <div style={f(`rotateX(90deg) translateZ(${h}px)`, 0)} />
      <div style={f(`rotateX(-90deg) translateZ(${h}px)`, 2)} />
    </div>
  );
}

/** [x, y, z, material]. A stepped, interlocking cluster in the spirit of the reference. */
const CUBES: [number, number, number, Mat][] = [
  [0, 0, 0, "black"], [1, 0, 0, "white"], [2, 0, 0, "water"], [3, 0, 0, "white"],
  [0, 0, 1, "white"], [1, 0, 1, "concrete"], [2, 0, 1, "green"], [3, 0, 1, "black"],
  [0, 0, 2, "concrete"], [1, 0, 2, "white"], [2, 0, 2, "black"],
  [1, 1, 0, "white"], [2, 1, 0, "green"], [1, 1, 1, "chrome"], [0, 1, 1, "black"],
  [2, 1, 1, "water"], [0, 1, 2, "white"], [1, 2, 1, "moss"],
];

export function IsoCubes({ size = 78, className = "" }: { size?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const spin = useTransform(scrollYProgress, [0, 1], [-18, 52]);
  const rotY = useSpring(useTransform([mx, spin], ([a, b]: number[]) => 38 + a * 10 + b), { stiffness: 80, damping: 18 });
  const rotX = useSpring(useTransform(my, (v) => -30 + v * 8), { stiffness: 80, damping: 18 });

  useEffect(() => {
    const move = (e: PointerEvent) => {
      mx.set((e.clientX / window.innerWidth - 0.5) * 2);
      my.set((e.clientY / window.innerHeight - 0.5) * 2);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [mx, my]);

  return (
    <div ref={ref} aria-hidden className={`pointer-events-none ${className}`} style={{ perspective: 1600 }}>
      <motion.div className="absolute left-1/2 top-1/2" style={{ width: 0, height: 0, transformStyle: "preserve-3d", rotateX: rotX, rotateY: rotY }}>
        <div style={{ position: "absolute", transformStyle: "preserve-3d", transform: `translate3d(${-1.5 * size}px, ${0.2 * size}px, ${-1 * size}px)` }}>
          {CUBES.map(([x, y, z, m], i) => (
            <Cube key={i} x={x} y={y} z={z} s={size} m={m} />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
