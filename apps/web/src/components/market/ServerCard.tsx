"use client";
import Link from "next/link";
import { useRef } from "react";
import { motion } from "framer-motion";
import { BadgeCheck, Boxes, Package, Server as ServerIcon } from "lucide-react";
import { TierBadge, tierColor } from "../TierBadge";
import { usd } from "@/lib/format";
import type { ServerRow } from "@/lib/api";

const KIND: Record<string, string> = { local: "Local", mcpb: "MCPB", oci: "OCI", npm: "npm", pypi: "PyPI", remote: "Remote" };

/**
 * Cards flip up into place in 3D, then lean a few degrees toward the cursor with a spotlight under it.
 * The top edge carries the tier colour. Under reduced motion they simply appear.
 */
export function ServerCard({ s, i, hbarUsd = 0.1 }: { s: ServerRow; i: number; hbarUsd?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const color = tierColor[s.tier];
  const name = s.title ?? s.server.split("/").pop() ?? s.server;

  const move = (e: React.MouseEvent) => {
    const el = ref.current!;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
    el.style.transform = `rotateX(${(-py * 7).toFixed(2)}deg) rotateY(${(px * 9).toFixed(2)}deg) translateZ(6px)`;
  };
  const leave = () => {
    if (ref.current) ref.current.style.transform = "";
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 40, rotateX: -24 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      exit={{ opacity: 0, scale: 0.94, rotateX: 12 }}
      transition={{ duration: 0.6, delay: Math.min(i, 9) * 0.05, ease: [0.22, 1, 0.36, 1] }}
      style={{ transformPerspective: 1100, transformOrigin: "50% 100%" }}
      className="[perspective:1100px]"
    >
      <div
        ref={ref}
        onMouseMove={move}
        onMouseLeave={leave}
        className="group card relative h-full overflow-hidden transition-[transform,border-color,box-shadow] duration-300 ease-out [transform-style:preserve-3d] hover:border-line-strong hover:shadow-[0_24px_48px_-24px_rgba(0,0,0,0.35)] motion-reduce:!transform-none"
        style={{ ["--tier" as string]: color }}
      >
        {/* tier edge */}
        <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)`, opacity: 0.7 }} />
        {/* cursor spotlight */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: `radial-gradient(260px circle at var(--mx, 50%) var(--my, 0%), color-mix(in srgb, ${color} 14%, transparent), transparent 70%)` }}
        />

        <Link href={`/server/${s.server}`} className="relative flex h-full flex-col gap-4 p-5" aria-label={`Open ${name}`}>
          <div className="flex items-start justify-between gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center border border-line-strong bg-surface-2" style={{ color }}>
              <ServerIcon className="h-5 w-5" aria-hidden />
            </span>
            <TierBadge tier={s.tier} />
          </div>

          <div className="min-w-0">
            <h3 className="truncate font-display text-[19px] font-semibold">{name}</h3>
            <p className="num mt-0.5 truncate text-[12px] text-faint">{s.server}</p>
            <p className="mt-3 line-clamp-2 min-h-[3rem] text-[14px] text-muted">{s.description ?? s.explain}</p>
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4 text-[13px] text-muted">
            <span className="inline-flex items-center gap-1.5" title="Price per connect, settled on Hedera over x402">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brands/hedera-dark.png" alt="Hedera" width={16} height={16} className="h-4 w-4 rounded-full object-contain" />
              <span className="num text-text">{(s.priceUsd / hbarUsd).toFixed(3).replace(/0+$/, "").replace(/\.$/, "")} ℏ</span>
              <span className="num text-faint">{usd(s.priceUsd)}</span>
            </span>
            {s.toolCount !== null && (
              <span className="inline-flex items-center gap-1.5">
                <Boxes className="h-3.5 w-3.5" aria-hidden />
                <span className="num">{s.toolCount}</span> tools
              </span>
            )}
            {s.kind && (
              <span className="inline-flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" aria-hidden />
                {KIND[s.kind] ?? s.kind}
              </span>
            )}
            {s.worldVerified && (
              <span className="ml-auto inline-flex items-center gap-1.5 text-accent" title="Unique, domain-verified, bonded">
                <BadgeCheck className="h-4 w-4" aria-hidden />
                Human
              </span>
            )}
          </div>
        </Link>
      </div>
    </motion.div>
  );
}

export function CardSkeleton() {
  return (
    <div className="card h-[236px] animate-pulse p-5">
      <div className="flex justify-between">
        <div className="h-11 w-11 bg-surface-2" />
        <div className="h-7 w-20 bg-surface-2" />
      </div>
      <div className="mt-5 h-5 w-2/3 rounded bg-surface-2" />
      <div className="mt-3 h-3 w-1/2 rounded bg-surface-2" />
      <div className="mt-5 h-3 w-full rounded bg-surface-2" />
      <div className="mt-2 h-3 w-4/5 rounded bg-surface-2" />
    </div>
  );
}
