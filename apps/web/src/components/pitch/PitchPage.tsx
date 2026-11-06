import { ArrowUpRight } from "lucide-react";
import { DECKS, DECK_SLIDES } from "@/lib/pitch";

/** One card per prize track. Each opens that track's five-slide deck. */
export function PitchPage() {
  return (
    <div className="wrap pb-10 pt-32">
      <p className="font-pixel text-[13px] tracking-widest text-accent">PITCH</p>
      <h1 className="mt-3 max-w-[820px] font-hero text-[clamp(44px,6vw,84px)] font-medium leading-[0.98] tracking-[-0.03em]">Three tracks, three decks.</h1>
      <p className="mt-6 max-w-[620px] text-[18px] text-muted">
        One deck per prize track, five slides each: {DECK_SLIDES.join(", ").toLowerCase()}. Every claim in them is backed by something you can open on HashScan or Etherscan.
      </p>

      <ul className="mt-12 grid gap-px bg-line md:grid-cols-3">
        {DECKS.map((d) => (
          <li key={d.id}>
            <a href={d.url} target="_blank" rel="noreferrer" className="grain group flex h-full min-h-[420px] flex-col justify-between p-8 transition-colors hover:bg-white">
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.logo} alt={d.sponsor} width={d.w} height={d.h} style={{ width: d.w, height: d.h, objectFit: "contain", objectPosition: "left" }} />
                <h2 className="mt-8 text-[30px] font-medium leading-[1.1] tracking-[-0.02em]">{d.track}</h2>
                <p className="mt-4 text-[16px] text-muted">{d.line}</p>
                <ol className="num mt-6 space-y-1.5 text-[13px] text-muted">
                  {DECK_SLIDES.map((s, i) => (
                    <li key={s}>
                      <span className="mr-2 text-text">{String(i + 1).padStart(2, "0")}</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
              <span className="-mx-8 -mb-8 mt-8 flex items-center justify-between bg-accent px-8 py-3.5 font-label text-[13px] uppercase tracking-[0.1em] text-accent-ink transition-[padding] duration-300 group-hover:pr-10">
                Open the deck <ArrowUpRight className="h-4 w-4" aria-hidden />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
