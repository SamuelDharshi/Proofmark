"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { DECKS } from "@/lib/pitch";
import { DECK_DATA } from "@/lib/pitchSlides";
import { SlideView } from "./SlideView";

/** Three tracks, three decks, in the site itself. Arrow keys move, F goes full screen. */
export function PitchViewer() {
  const params = useSearchParams();
  const startId = params.get("deck");
  const [deckIdx, setDeckIdx] = useState(Math.max(0, DECKS.findIndex((d) => d.id === startId)));
  const [slide, setSlide] = useState(0);
  const [scale, setScale] = useState(0.5);
  const [full, setFull] = useState(false);
  const shell = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  const deck = DECK_DATA.find((d) => d.id === DECKS[deckIdx].id)!;
  const total = deck.slides.length;
  const go = useCallback((n: number) => setSlide((s) => Math.min(total - 1, Math.max(0, typeof n === "number" ? n : s))), [total]);

  const pick = (i: number) => {
    setDeckIdx(i);
    setSlide(0);
    window.history.replaceState(null, "", `/pitch?deck=${DECKS[i].id}`);
  };

  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void shell.current?.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / 1920);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [full]);

  useEffect(() => {
    const onFull = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFull);
    return () => document.removeEventListener("fullscreenchange", onFull);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (["ArrowRight", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        setSlide((s) => Math.min(total - 1, s + 1));
      } else if (["ArrowLeft", "PageUp"].includes(e.key)) {
        setSlide((s) => Math.max(0, s - 1));
      } else if (e.key === "f" || e.key === "F") toggleFull();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total, toggleFull]);

  return (
    <div className="wrap pb-10 pt-32">
      <p className="font-pixel text-[13px] tracking-widest text-accent">PITCH</p>
      <h1 className="mt-3 max-w-[820px] font-hero text-[clamp(40px,5vw,72px)] font-medium leading-[0.98] tracking-[-0.03em]">Three tracks, three decks.</h1>

      <div role="tablist" aria-label="Prize track" className="mt-10 grid gap-px bg-line md:grid-cols-3">
        {DECKS.map((d, i) => (
          <button key={d.id} role="tab" aria-selected={i === deckIdx} onClick={() => pick(i)} className={`grain flex items-center gap-5 px-6 py-5 text-left transition-colors ${i === deckIdx ? "bg-white" : "opacity-70 hover:opacity-100"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.logo} alt={d.sponsor} width={d.w} height={d.h} style={{ width: d.w * 0.7, height: d.h * 0.7, objectFit: "contain" }} />
            <span className="flex flex-col">
              <span className="text-[16px] font-medium leading-tight">{d.track}</span>
              <span className={`mt-1 h-0.5 ${i === deckIdx ? "bg-accent" : "bg-transparent"}`} />
            </span>
          </button>
        ))}
      </div>

      <div ref={shell} className={`mt-6 ${full ? "flex flex-col items-center justify-center bg-black" : ""}`}>
        <div ref={stage} className={`relative aspect-video overflow-hidden border border-line bg-bg ${full ? "w-[min(100vw,calc(100vh*16/9))] border-0" : "w-full"}`}>
          <div key={`${deck.id}-${slide}`} className="animate-[fade_300ms_ease-out]" style={{ width: 1920, height: 1080, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <SlideView deck={deck} index={slide} />
          </div>
        </div>

        {!full && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button className="btn btn-ghost !min-h-10 !px-3" onClick={() => go(slide - 1)} disabled={slide === 0} aria-label="Previous slide"><ChevronLeft className="h-4 w-4" aria-hidden /></button>
              <button className="btn btn-primary !min-h-10 !px-3" onClick={() => go(slide + 1)} disabled={slide === total - 1} aria-label="Next slide"><ChevronRight className="h-4 w-4" aria-hidden /></button>
              <ol className="ml-3 flex gap-2" aria-label="Slides">
                {deck.slides.map((_, i) => (
                  <li key={i}>
                    <button onClick={() => go(i)} aria-label={`Slide ${i + 1}`} aria-current={i === slide} className={`h-2.5 w-8 transition-colors ${i === slide ? "bg-text" : "bg-line-strong hover:bg-muted"}`} />
                  </li>
                ))}
              </ol>
              <span className="num ml-2 text-[13px] text-muted">{slide + 1} / {total}</span>
            </div>
            <button className="btn btn-ghost !min-h-10 !px-4" onClick={toggleFull}>
              <Maximize2 className="h-4 w-4" aria-hidden /> Present
            </button>
          </div>
        )}
        {full && (
          <button className="absolute right-4 top-4 text-white/60 hover:text-white" onClick={toggleFull} aria-label="Exit full screen"><Minimize2 className="h-5 w-5" /></button>
        )}
      </div>

      {!full && (
        <div className="mt-6 max-w-[860px] border border-line bg-surface p-6">
          <p className="label">Speaker notes · slide {slide + 1}</p>
          <p className="mt-3 text-[16px] leading-relaxed text-muted">{deck.slides[slide].notes}</p>
          <p className="num mt-4 text-[12px] text-faint">Arrow keys move between slides. F presents full screen.</p>
        </div>
      )}
    </div>
  );
}
