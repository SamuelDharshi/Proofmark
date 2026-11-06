import { useId } from "react";

/**
 * The Proofmark P. A solid bowl with a cut corner, and the stem as a small 3D cube in three greens:
 * the proof block, the same cube the site's artwork is built from.
 */
export const P_BOWL = "M24 5H38A16.5 16.5 0 0 1 38 38H12V17Z";
export const P_CUBE = { top: "M12 46L17 41H32L27 46Z", front: "M12 46H27V60H12Z", side: "M27 46L32 41V55L27 60Z" };

export function LogoMark({ className = "h-7 w-7", tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  const id = useId().replace(/:/g, "");
  const [a, b] = tone === "light" ? ["#ffffff", "#d9d8d5"] : ["#3a3a3a", "#1c1c1c"];
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={`pm-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <path d={P_BOWL} fill={`url(#pm-${id})`} />
      <path d={P_CUBE.top} fill="#9dffcd" />
      <path d={P_CUBE.front} fill="#38f997" />
      <path d={P_CUBE.side} fill="#17a862" />
    </svg>
  );
}

export function Wordmark({ className = "", tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className="h-8 w-8" tone={tone} />
      <span className="font-display text-[22px] font-semibold tracking-[-0.02em]">proofmark</span>
    </span>
  );
}
