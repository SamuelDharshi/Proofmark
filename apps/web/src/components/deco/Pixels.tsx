/** Small pixel ornaments used across every page. All inline SVG, no assets. */

const GRAD = "linear-gradient(90deg,#3b82f6,#a855f7,#ec4899,#f59e0b)";

/** The stepped green block with a gradient tail, the section ornament. */
export function PixelMark({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`relative inline-block h-[46px] w-[124px] ${className}`}>
      <span className="absolute left-0 top-0 h-[22px] w-[22px] bg-accent" />
      <span className="absolute left-[22px] top-[22px] h-[22px] w-[22px] bg-accent" />
      <span className="absolute left-[44px] top-0 h-[22px] w-[22px] bg-accent" />
      <span className="absolute left-[66px] top-0 h-[22px] w-[58px]" style={{ background: GRAD }} />
    </span>
  );
}

/** Pixel arrow built from squares, pointing left or right. */
export function PixelArrow({ dir = "right", className = "h-16 w-16" }: { dir?: "left" | "right"; className?: string }) {
  const flip = dir === "left" ? "scale(-1,1) translate(-10,0)" : undefined;
  return (
    <svg viewBox="0 0 10 10" shapeRendering="crispEdges" className={className} aria-hidden>
      <g fill="currentColor" transform={flip}>
        <rect x="0" y="4" width="9" height="1.4" />
        <rect x="6" y="1.2" width="1.4" height="1.4" />
        <rect x="7.4" y="2.6" width="1.4" height="1.4" />
        <rect x="7.4" y="5.4" width="1.4" height="1.4" />
        <rect x="6" y="6.8" width="1.4" height="1.4" />
      </g>
    </svg>
  );
}

/** Tall gradient bars, the floating accent beside headlines. */
export function GradBars({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`pointer-events-none relative block h-[190px] w-[70px] ${className}`}>
      <span className="absolute left-[14px] top-[44px] h-[146px] w-[20px]" style={{ background: "linear-gradient(180deg,#22d3ee,#6366f1 35%,#f5f5f4 55%,#78350f)" }} />
      <span className="absolute left-[34px] top-[14px] h-[110px] w-[20px]" style={{ background: "linear-gradient(180deg,#84cc16,#10b981 40%,#3b82f6 70%,#4338ca)" }} />
      <span className="absolute left-[0] top-0 h-[16px] w-[16px] bg-[#22d3ee]" />
      <span className="absolute left-[54px] top-[22px] h-[16px] w-[16px]" style={{ background: "linear-gradient(135deg,#ec4899,#f59e0b)" }} />
    </span>
  );
}
