"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Mono value with a copy button. For hashes and snippets that have no explorer page. */
export function CopyText({ value, display, block = false }: { value: string; display?: string; block?: boolean }) {
  const [done, setDone] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setDone(true);
    setTimeout(() => setDone(false), 1200);
  };
  return (
    <span className={`inline-flex items-start gap-2 ${block ? "w-full" : ""}`}>
      <span className={`num text-[13px] ${block ? "w-full whitespace-pre-wrap break-all" : "break-all"}`}>{display ?? value}</span>
      <button type="button" onClick={copy} aria-label="Copy" className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center text-faint transition-colors hover:text-text">
        {done ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}
