import Link from "next/link";

/**
 * Real marks of the technology actually used. One hover behaviour for all:
 * quiet at rest, full on hover. They link to the docs section for that integration.
 */
const ITEMS = [
  { href: "/docs#hedera", name: "Hedera", src: "/brands/hedera-wordmark.png", w: 108, h: 22 },
  { href: "/docs#ens", name: "ENS", src: "/brands/ens-wordmark-light.png", w: 66, h: 20 },
  { href: "/docs#world", name: "World", src: "/brands/world-wordmark-light.png", w: 84, h: 22 },
  { href: "/docs#mcp", name: "Model Context Protocol", src: "/brands/mcp-white.svg", w: 30, h: 30 },
];

export function Sponsors({ label = "Built with" }: { label?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
      <span className="label">{label}</span>
      <ul className="flex flex-wrap items-center gap-x-9 gap-y-4">
        {ITEMS.map((i) => (
          <li key={i.name}>
            <Link href={i.href} aria-label={i.name} className="block opacity-50 grayscale transition-all duration-200 ease-out hover:-translate-y-0.5 hover:opacity-100 hover:grayscale-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.src} alt={i.name} width={i.w} height={i.h} style={{ width: i.w, height: i.h, objectFit: "contain" }} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
