export function LogoMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden>
      <path d="M10 57V21L32 8l22 13v36" stroke="currentColor" strokeWidth="6" strokeLinejoin="miter" strokeLinecap="square" />
      <path d="M32 25l9 9-9 9-9-9z" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className="h-6 w-6 text-accent" />
      <span className="font-display text-[17px] font-bold tracking-[0.14em]">THANKS</span>
    </span>
  );
}
