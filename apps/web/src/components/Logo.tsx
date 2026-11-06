/** Octagon ring with a pixel notch, in the spirit of the reference mark. */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden>
      <path d="M22 6h20l16 16v20L42 58H22L6 42V22z" stroke="currentColor" strokeWidth="7" strokeLinejoin="miter" />
      <rect x="25" y="25" width="14" height="14" fill="#38f997" />
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
