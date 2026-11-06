"use client";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { RefreshCw, Search, WifiOff } from "lucide-react";
import { api, type ServerRow } from "@/lib/api";
import { CardSkeleton, ServerCard } from "./ServerCard";

const TABS = [
  { id: "all", label: "All" },
  { id: "green", label: "Green" },
  { id: "sandboxed", label: "Sandboxed" },
  { id: "blocked", label: "Blocked" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function Marketplace() {
  const [rows, setRows] = useState<ServerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [tick, setTick] = useState(0);

  // Debounced search against the gateway, which merges claimed, demo and registry servers.
  useEffect(() => {
    let live = true;
    setError(null);
    const t = setTimeout(() => {
      api
        .servers(q.trim() || undefined)
        .then((r) => live && setRows(r.servers))
        .catch((e) => live && (setRows([]), setError(e.message)));
    }, q ? 300 : 0);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, tick]);

  const counts = useMemo(() => {
    const c = { all: rows?.length ?? 0, green: 0, sandboxed: 0, blocked: 0 };
    rows?.forEach((r) => c[r.tier]++);
    return c;
  }, [rows]);
  const shown = useMemo(() => (rows ?? []).filter((r) => tab === "all" || r.tier === tab), [rows, tab]);

  return (
    <div className="wrap pb-10 pt-32">
      <div className="max-w-[720px]">
        <p className="font-pixel text-[13px] tracking-widest text-accent">MARKETPLACE</p>
        <h1 className="mt-3 font-hero font-medium tracking-[-0.03em] text-[clamp(44px,6vw,84px)] leading-[0.98]">MCP servers, graded.</h1>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
        <LayoutGroup id="tabs">
          <div role="tablist" aria-label="Filter by tier" className="flex gap-1 border border-line bg-surface p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`relative min-h-10 px-4 font-label text-[14px] transition-colors ${tab === t.id ? "text-text" : "text-muted hover:text-text"}`}
              >
                {tab === t.id && <motion.span layoutId="tab-pill" className="absolute inset-0 bg-surface-2 ring-1 ring-line-strong" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                <span className="relative flex items-center gap-2">
                  {t.label}
                  <span className="num text-[12px] text-faint">{counts[t.id]}</span>
                </span>
              </button>
            ))}
          </div>
        </LayoutGroup>

        <label className="relative block w-full sm:w-[320px]">
          <span className="sr-only">Search servers</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the registry"
            className="h-11 w-full border border-line bg-surface pl-10 pr-3 text-[15px] outline-none transition-colors placeholder:text-faint focus:border-accent/60"
          />
        </label>
      </div>

      <div className="mt-8">
        {error ? (
          <div className="card flex flex-col items-center gap-4 px-6 py-16 text-center">
            <WifiOff className="h-7 w-7 text-faint" aria-hidden />
            <div>
              <p className="font-display text-[20px] font-semibold">Gateway unreachable</p>
              <p className="mt-1 text-[14px] text-muted">Start it with <span className="num">npm run gateway</span>, then retry.</p>
            </div>
            <button className="btn btn-ghost" onClick={() => setTick((n) => n + 1)}>
              <RefreshCw className="h-4 w-4" aria-hidden /> Retry
            </button>
          </div>
        ) : rows === null ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : shown.length === 0 ? (
          <div className="card px-6 py-16 text-center text-muted">No servers match.</div>
        ) : (
          <motion.div layout className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {shown.map((s, i) => (
                <ServerCard key={s.server} s={s} i={i} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
