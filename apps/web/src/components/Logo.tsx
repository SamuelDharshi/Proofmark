/**
 * The Proofmark P. A stem and a chamfered bowl, with the green proof pixel set where the counter would be:
 * the mark is the letter and the check in one shape. The same outline is extruded in 3D on the landing page.
 */
export const P_OUTLINE = "M10 4H40L54 18V32L40 46H24V60H10Z";
export const P_COUNTER = "M24 17H35L40 22V28L35 33H24Z";

export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden>
      <path d={`${P_OUTLINE} ${P_COUNTER}`} fill="currentColor" fillRule="evenodd" />
      <rect x="27" y="21" width="8" height="8" fill="#38f997" />
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
