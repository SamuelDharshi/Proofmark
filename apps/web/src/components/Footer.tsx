import Link from "next/link";

/** Simple on purpose: faded wordmark across the footer and a thin row of links. */
export function Footer() {
  return (
    <footer className="relative mt-32 overflow-hidden border-t border-line">
      <div className="wrap flex flex-wrap items-center justify-between gap-4 py-8 text-[14px] text-muted">
        <span>© THANKS</span>
        <nav className="flex gap-6" aria-label="Footer">
          <Link href="/docs" className="link hover:text-text">Docs</Link>
          <Link href="/check" className="link hover:text-text">Check a server</Link>
          <a href="https://github.com/SamuelDharshi" target="_blank" rel="noreferrer" className="link hover:text-text">GitHub</a>
        </nav>
      </div>
      <div aria-hidden className="pointer-events-none select-none text-center font-display font-bold leading-[0.8] tracking-[0.06em] text-text/[0.05]" style={{ fontSize: "clamp(72px, 21vw, 300px)" }}>
        THANKS
      </div>
    </footer>
  );
}
