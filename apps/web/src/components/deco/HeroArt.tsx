/** The hero illustration as one flat image, with a moon and sphere. No runtime drawing, no pointer tracking. */
export function HeroArt({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none ${className}`}>
      <div className="absolute left-[6%] top-[15%] w-[12%]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/tex/moon.png" alt="" width={256} height={256} className="w-full" />
        <span className="absolute left-1/2 top-full h-[700px] w-px bg-line-strong" />
      </div>
      <span className="absolute left-[34%] -top-[16%] h-[34%] w-[34%] rounded-full" style={{ background: "radial-gradient(circle at 40% 62%, #6d6d6d 0, #2a2a2a 38%, #0c0c0c 72%)" }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/art/hero.webp" alt="" width={1200} height={1732} fetchPriority="high" decoding="async" className="absolute -right-[8%] top-[2%] w-[76%]" />
    </div>
  );
}
