"use client";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CircleAlert, ExternalLink, GitBranch, PackageSearch, ShieldQuestion } from "lucide-react";
import type { ServerInfo } from "@proofmark/core";
import { CopyText } from "../CopyText";

const Row = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1 border-b border-line py-3 last:border-0">
    <dt className="shrink-0 text-[14px] text-muted">{k}</dt>
    <dd className="min-w-0 text-right text-[14px]">{children}</dd>
  </div>
);

const pkgUrl = (t: string, id?: string) =>
  !id ? null : t === "npm" ? `https://www.npmjs.com/package/${id}` : t === "pypi" ? `https://pypi.org/project/${id}/` : null;

/** Everything the official registry and the package host say about a server name, with no filler. */
export function ServerFacts({ info, claimed, onPick }: { info: ServerInfo; claimed: boolean; onPick?: (name: string) => void }) {
  if (!info.found) {
    return (
      <div className="mt-5 space-y-4">
        <p className="flex items-start gap-2.5 border border-line bg-surface-2 px-4 py-3.5 text-[14.5px]">
          <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
          <span>
            <strong className="font-semibold">Not in the official MCP registry.</strong> <span className="text-muted">{info.launch.detail}</span>
          </span>
        </p>
        {info.suggestions.length > 0 && (
          <div>
            <p className="label mb-2">Did you mean</p>
            <ul className="space-y-2">
              {info.suggestions.map((s) => (
                <li key={s.name}>
                  {onPick ? (
                    <button onClick={() => onPick(s.name)} className="card card-hover flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                      <span className="min-w-0">
                        <span className="num block truncate text-[13px]">{s.name}</span>
                        {s.description && <span className="block truncate text-[13px] text-muted">{s.description}</span>}
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-faint" aria-hidden />
                    </button>
                  ) : (
                    <Link href={`/server/${s.name}`} className="card card-hover block px-4 py-3">
                      <span className="num block truncate text-[13px]">{s.name}</span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  const published = info.publishedAt ? new Date(info.publishedAt).toISOString().slice(0, 10) : null;
  return (
    <div className="mt-5 space-y-5">
      {(info.title || info.description) && (
        <div>
          {info.title && info.title !== info.name && <p className="font-display text-[18px] font-semibold">{info.title}</p>}
          {info.description && <p className="mt-1 text-[14.5px] text-muted">{info.description}</p>}
        </div>
      )}

      <dl className="border border-line bg-bg px-4">
        {info.version && <Row k="Version"><span className="num">{info.version}</span></Row>}
        {published && <Row k="Published"><span className="num">{published}</span> <span className="text-muted">({info.ageDays} days ago)</span></Row>}
        {info.packages.map((p, i) => {
          const url = pkgUrl(p.registryType, p.identifier);
          return (
            <div key={i}>
              <Row k="Package">
                <span className="num">{p.registryType}</span>{" "}
                {p.identifier &&
                  (url ? (
                    <a href={url} target="_blank" rel="noreferrer" className="num link inline-flex items-center gap-1 hover:text-accent">
                      {p.identifier} <ExternalLink className="h-3 w-3 opacity-60" aria-hidden />
                    </a>
                  ) : (
                    <span className="num break-all">{p.identifier}</span>
                  ))}
              </Row>
              {p.hash ? (
                <Row k="Artefact hash">
                  <span className="block"><CopyText value={p.hash} display={p.hash.length > 30 ? p.hash.slice(0, 22) + "…" + p.hash.slice(-8) : p.hash} /></span>
                  {p.hashSource && <span className="block text-[12px] text-faint">{p.hashSource}</span>}
                </Row>
              ) : (
                <Row k="Artefact hash"><span className="text-muted">Not published</span></Row>
              )}
            </div>
          );
        })}
        {info.remotes.map((r) => (
          <Row key={r.url} k={`Remote (${r.type})`}><span className="num break-all">{r.url}</span></Row>
        ))}
        {info.repository && (
          <Row k="Repository">
            <a href={info.repository} target="_blank" rel="noreferrer" className="num link inline-flex items-center gap-1.5 hover:text-accent">
              <GitBranch className="h-3.5 w-3.5 opacity-70" aria-hidden /> {info.repository.replace(/^https?:\/\/(www\.)?/, "")}
            </a>
          </Row>
        )}
        {info.ownership && (
          <Row k="Name ownership">
            {info.ownership.ok ? (
              <span className="inline-flex items-center gap-1.5 text-accent"><BadgeCheck className="h-4 w-4" aria-hidden /> Verified by {info.ownership.method}</span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-danger"><CircleAlert className="h-4 w-4" aria-hidden /> {info.ownership.detail}</span>
            )}
          </Row>
        )}
      </dl>

      {info.signals.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {info.signals.map((s) => (
            <li key={s.label} className={`inline-flex items-center gap-2 border px-3 py-1.5 text-[13px] ${s.level === "warn" ? "border-danger/30 bg-danger/5 text-text" : "border-line text-muted"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${s.level === "warn" ? "bg-danger" : "bg-faint"}`} aria-hidden />
              {s.label}
            </li>
          ))}
        </ul>
      )}

      <p className="flex items-start gap-2.5 text-[14px] text-muted">
        <PackageSearch className="mt-0.5 h-4 w-4 shrink-0 text-faint" aria-hidden />
        <span><span className="text-text">On connect:</span> {info.launch.detail}</span>
      </p>

      {info.ownership?.ok && !claimed && info.source === "registry" && (
        <Link href={`/claim?server=${encodeURIComponent(info.name)}`} className="btn btn-ghost">
          Claim this server <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}
