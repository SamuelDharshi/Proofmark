/**
 * The Proofmark P: a solid bowl with a diagonal cut, and the stem as a separate green block, the proof.
 * The same geometry is extruded in 3D on the landing page (three/PCanvas.tsx).
 */
export const P_BOWL = "M24 6H38A16 16 0 0 1 38 38H12V18Z";
export const P_BLOCK = { x: 12, y: 42, w: 16, h: 16 };

export function LogoMark({ className = "h-7 w-7", block = "#38f997" }: { className?: string; block?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden>
      <path d={P_BOWL} fill="currentColor" />
      <rect x={P_BLOCK.x} y={P_BLOCK.y} width={P_BLOCK.w} height={P_BLOCK.h} fill={block} />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className="h-7 w-7" />
      <span className="font-display text-[22px] font-semibold tracking-[-0.02em]">proofmark</span>
    </span>
  );
}
