"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Wordmark } from "./Logo";

const LINKS = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/check", label: "Check" },
  { href: "/fleet", label: "Fleet" },
  { href: "/docs", label: "Docs" },
];

/**
 * Over the hero there is no bar at all, only legible links. After the hero scrolls away
 * a detached sticky bar slides in. Rounded-2xl reads as a floating bar, not a capsule.
 * Pages with no hero pass `solid` and always show the bar.
 */
export function Nav({ solid = false }: { solid?: boolean }) {
  const [scrolled, setScrolled] = useState(solid);
  const [open, setOpen] = useState(false);
  const path = usePathname();

  useEffect(() => {
    if (solid) return;
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [solid]);

  useEffect(() => setOpen(false), [path]);

  return (
    <header className={`fixed inset-x-0 top-0 z-50 flex justify-center transition-[padding] duration-300 ease-out ${scrolled ? "pt-3" : "pt-6"}`}>
      <nav
        className={[
          "flex w-[min(1160px,calc(100%-2rem))] items-center justify-between px-4 py-2.5 transition-all duration-300 ease-out",
          "rounded-2xl border",
          scrolled ? "border-line-strong bg-bg/70 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl" : "border-transparent bg-transparent",
        ].join(" ")}
        aria-label="Primary"
      >
        <Link href="/" aria-label="Proofmark home" className="py-1">
          <Wordmark />
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const active = path === l.href || path.startsWith(l.href + "/");
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={`font-label rounded-lg px-3.5 py-2 text-[14px] transition-colors ${active ? "text-text" : "text-muted hover:text-text"}`}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
          <li className="pl-2">
            <Link href="/claim" className="btn btn-primary !min-h-10 !px-4 !text-[14px]">
              Claim a server
            </Link>
          </li>
        </ul>

        <button
          type="button"
          className="grid h-11 w-11 place-items-center rounded-xl border border-line-strong md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-x-4 top-[72px] rounded-2xl border border-line-strong bg-surface p-3 shadow-2xl md:hidden"
          >
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="flex min-h-12 items-center rounded-xl px-4 text-[16px] hover:bg-surface-2">
                {l.label}
              </Link>
            ))}
            <Link href="/claim" className="btn btn-primary mt-2 w-full">
              Claim a server
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
