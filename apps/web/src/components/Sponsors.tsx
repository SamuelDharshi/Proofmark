import Link from "next/link";

/**
 * Real marks of the technology actually used. `tone` picks the artwork that is legible on the
 * surface behind it: dark marks on the light theme, light marks on charcoal.
 */
const ITEMS = {
  dark: [
    { href: "/docs#hedera", name: "Hedera", src: "/brands/hedera-wordmark-dark.png", w: 112, h: 23 },
    { href: "/docs#ens", name: "ENS", src: "/brands/ens-wordmark-dark.png", w: 70, h: 21 },
    { href: "/docs#world", name: "World", src: "/brands/world-wordmark-dark.png", w: 88, h: 23 },
    { href: "/docs#mcp", name: "Model Context Protocol", src: "/brands/mcp-black.svg", w: 30, h: 30 },
  ],
  light: [
    { href: "/docs#hedera", name: "Hedera", src: "/brands/hedera-wordmark.png", w: 112, h: 23 },
    { href: "/docs#ens", name: "ENS", src: "/brands/ens-wordmark-light.png", w: 70, h: 21 },
    { href: "/docs#world", name: "World", src: "/brands/world-wordmark-light.png", w: 88, h: 23 },
    { href: "/docs#mcp", name: "Model Context Protocol", src: "/brands/mcp-white.svg", w: 30, h: 30 },
  ],
};

export function Sponsors({ label = "Built with", tone = "dark" }: { label?: string; tone?: "dark" | "light" }) {
  return (
    <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
      <span className="label">{label}</span>
      <ul className="flex flex-wrap items-center gap-x-9 gap-y-4">
        {ITEMS[tone].map((i) => (
          <li key={i.name}>
            <Link href={i.href} aria-label={i.name} className="block opacity-70 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:opacity-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.src} alt={i.name} width={i.w} height={i.h} style={{ width: i.w, height: i.h, objectFit: "contain" }} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
