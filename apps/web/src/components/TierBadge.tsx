import { ShieldCheck, Box, ShieldX } from "lucide-react";

const T = {
  green: { label: "Green", cls: "text-accent border-accent bg-accent/20", Icon: ShieldCheck },
  sandboxed: { label: "Sandboxed", cls: "text-sandbox border-sandbox/30 bg-sandbox/10", Icon: Box },
  blocked: { label: "Blocked", cls: "text-danger border-danger/30 bg-danger/10", Icon: ShieldX },
} as const;

export type Tier = keyof typeof T;

export function TierBadge({ tier, className = "" }: { tier: Tier; className?: string }) {
  const { label, cls, Icon } = T[tier];
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2.5 py-1 font-label text-[12px] font-medium uppercase tracking-[0.06em] ${cls} ${className}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  );
}

export const tierColor: Record<Tier, string> = {
  green: "var(--color-accent)",
  sandboxed: "var(--color-sandbox)",
  blocked: "var(--color-danger)",
};
