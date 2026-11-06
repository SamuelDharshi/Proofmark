import type { Deck, Slide, Tone } from "@/lib/pitchSlides";

/**
 * One slide on a fixed 1920 by 1080 canvas, drawn in the site's own colors. The viewer scales it to fit.
 * Slides 2 and 5 are charcoal, slide 4 is paper, slides 1 and 3 are grey.
 */
const TONE: Record<Tone, string> = {
  green: "bg-[#38F997] text-[#0B1A12]",
  blue: "bg-[#6FA3F5] text-[#0B1A12]",
  red: "bg-[#FF8A8A] text-[#2A0B0B]",
  light: "bg-[#F4F3F1] text-[#272727]",
  dark: "bg-[#272727] text-[#F4F3F1]",
  plain: "bg-bg text-text border border-line",
};

const WHY: Record<Deck["id"], string> = { hedera: "Hedera", ens: "ENSv2", world: "World" };
const eyebrows = (id: Deck["id"]) => ["Proofmark · The problem", "The solution", `Why ${WHY[id]} · What is unique`, "Architecture and workflow", id === "world" ? "Proof it runs · Debrief" : "Proof it runs · What is next"];

const Arrow = ({ dark }: { dark: boolean }) => (
  <span aria-hidden className={`h-[26px] w-[44px] shrink-0 ${dark ? "bg-[#38F997]" : "bg-[#272727]"}`} style={{ clipPath: "polygon(0 25%, 60% 25%, 60% 0, 100% 50%, 60% 100%, 60% 75%, 0 75%)" }} />
);

export function SlideView({ deck, index }: { deck: Deck; index: number }) {
  const slide: Slide = deck.slides[index];
  const dark = index === 1 || index === 4;
  const paper = index === 3;
  const small = slide.kind === "flows" || slide.kind === "proof" || (slide.kind === "steps" && slide.compact);
  const card = paper ? "bg-bg" : "bg-surface";

  return (
    <section className={`${dark ? "dark-zone" : ""} ${paper ? "bg-surface" : "bg-bg"} relative flex h-[1080px] w-[1920px] flex-col gap-8 overflow-hidden px-32 pb-40 pt-32 font-hero text-text`}>
      <p className={`self-start px-5 py-2 font-label text-[26px] font-medium uppercase tracking-[2px] ${dark ? "bg-[#38F997] text-[#0B1A12]" : "bg-[#272727] text-[#38F997]"}`}>{eyebrows(deck.id)[index]}</p>
      <h2 className={`${small ? "text-[64px]" : "text-[72px]"} font-semibold leading-[1.08] tracking-[-2px]`}>{slide.title}</h2>

      {slide.kind === "problem" && (
        <>
          <div className="flex gap-8">
            {slide.cards.map((c) => (
              <div key={c.title} className={`flex flex-1 flex-col gap-[14px] border border-line p-9 ${card}`}>
                <p className="font-label text-[26px] font-semibold text-accent">{c.n}</p>
                <h3 className="text-[40px] font-semibold leading-[1.1]">{c.title}</h3>
                <p className="text-[28px] leading-[1.35] text-muted">{c.body}</p>
              </div>
            ))}
          </div>
          <p className="border-l-8 border-[#38F997] py-1.5 pl-7 text-[36px] font-medium leading-[1.3]">{slide.statement}</p>
        </>
      )}

      {slide.kind === "steps" && (
        <>
          <div className="flex items-center gap-5">
            {slide.steps.map((s, i) => (
              <div key={i} className="contents">
                {i > 0 && <Arrow dark={dark} />}
                <div className={`flex flex-1 flex-col gap-3 self-stretch p-8 ${s.tone ? TONE[s.tone] : `border border-line ${paper ? "bg-bg" : "bg-surface"}`}`}>
                  {s.n && <p className="font-label text-[26px] font-semibold text-accent">{s.n}</p>}
                  {s.title && <h3 className={`text-[32px] font-semibold leading-[1.1] ${s.tone === "dark" ? "text-[#38F997]" : ""}`}>{s.title}</h3>}
                  <p className={`text-[26px] leading-[1.3] ${s.tone ? "" : "text-muted"}`}>{s.body}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-5">
            {slide.chips.map((c) => (
              <p key={c.label} className={`flex-1 ${slide.chipsAsBoxes ? "p-5 text-[26px] leading-[1.3]" : "px-6 py-[18px] text-[28px] font-semibold leading-[1.3]"} ${TONE[c.tone]}`}>{c.label}</p>
            ))}
          </div>
          {slide.footnote && <p className="text-[28px] font-medium leading-[1.35]">{slide.footnote}</p>}
        </>
      )}

      {slide.kind === "split" && (
        <div className="flex gap-8">
          <div className="flex flex-[3] flex-col gap-[14px]">
            {slide.items.map((it) => (
              <div key={it.mono} className="flex flex-col gap-1.5 border border-line bg-surface px-7 py-[22px]">
                <p className="font-mono text-[26px] font-medium text-accent">{it.mono}</p>
                <p className="text-[26px] leading-[1.3] text-muted">{it.body}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-[2] flex-col justify-between gap-5 bg-[#38F997] p-9 text-[#0B1A12]">
            <p className="font-label text-[26px] font-semibold uppercase tracking-[2px]">{slide.panel.label}</p>
            {slide.panel.lines.map((l, i) => (
              <p key={i} className={l.strong ? "text-[32px] font-semibold leading-[1.25]" : "text-[26px] leading-[1.3]"}>{l.strong ?? l.text}</p>
            ))}
          </div>
        </div>
      )}

      {slide.kind === "duo" && (
        <>
          <div className="flex gap-8">
            {slide.cards.map((c) => (
              <div key={c.title} className="flex flex-1 flex-col gap-4 border border-line bg-surface p-9">
                <p className="font-label text-[26px] font-semibold uppercase tracking-[2px] text-accent">{c.label}</p>
                <h3 className="text-[44px] font-semibold leading-[1.1]">{c.title}</h3>
                <p className="text-[28px] leading-[1.35] text-muted">{c.body}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-5">
            {slide.chips.map((c) => (
              <p key={c.label} className={`flex-1 px-6 py-[18px] text-[28px] font-semibold leading-[1.3] ${TONE[c.tone]}`}>{c.label}</p>
            ))}
          </div>
          <p className="text-[28px] leading-[1.3] text-muted">{slide.footnote}</p>
        </>
      )}

      {slide.kind === "why" && (
        <div className="flex gap-8">
          <div className="flex flex-[3] flex-col gap-4">
            {slide.cards.map((c) => (
              <div key={c.title} className="flex flex-col gap-1.5 border border-line bg-surface px-[30px] py-[22px]">
                <h3 className="text-[34px] font-semibold leading-[1.1]">{c.title}</h3>
                <p className="text-[26px] leading-[1.3] text-muted">{c.body}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-[2] flex-col justify-between gap-5 bg-[#272727] p-9 text-[#F4F3F1]">
            <p className="font-label text-[26px] font-semibold uppercase tracking-[2px] text-[#38F997]">{slide.panel.label}</p>
            {slide.panel.stats?.map((s) => (
              <div key={s.big} className="flex flex-col gap-1">
                <p className="text-[72px] font-semibold leading-none text-[#38F997]">{s.big}</p>
                <p className="text-[26px] leading-[1.3] text-[#C9C6C2]">{s.text}</p>
              </div>
            ))}
            {slide.panel.lines?.map((l) => (
              <div key={l.strong} className="flex flex-col gap-3">
                <p className="text-[34px] font-semibold leading-[1.2]">{l.strong}</p>
                <p className="text-[26px] leading-[1.3] text-[#C9C6C2]">{l.text}</p>
              </div>
            ))}
            {slide.panel.closing && <p className="text-[28px] font-medium leading-[1.3]">{slide.panel.closing}</p>}
          </div>
        </div>
      )}

      {slide.kind === "flows" && (
        <>
          <div className="flex gap-7">
            {slide.columns.map((col) => (
              <div key={col.title} className={`flex flex-1 flex-col gap-3.5 p-[30px] ${col.tone === "dark" ? "bg-[#272727] text-[#F4F3F1]" : "border border-line bg-bg"}`}>
                <h3 className={`text-[36px] font-semibold leading-[1.1] ${col.tone === "dark" ? "text-[#38F997]" : ""}`}>{col.title}</h3>
                {col.items.map((it, i) => (
                  <p key={i} className="text-[25px] leading-[1.3]"><b className="mr-2">{it.n}</b>{it.text}</p>
                ))}
              </div>
            ))}
          </div>
          {slide.bar && <p className="bg-[#272727] px-7 py-5 text-[28px] font-medium leading-[1.3] text-[#F4F3F1]">{slide.bar}</p>}
        </>
      )}

      {slide.kind === "proof" && (
        <>
          <div className="flex gap-8">
            <table className="flex-[3] border-collapse text-[25px]">
              <thead>
                <tr className="text-left text-muted">
                  <th className="w-[42%] pb-3 font-semibold">Requirement</th>
                  <th className="pb-3 font-semibold">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {slide.rows.map(([a, b]) => (
                  <tr key={a} className="border-t border-line align-top">
                    <td className="py-3.5 pr-4 font-medium">{a}</td>
                    <td className="py-3.5 text-muted">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex flex-[2] flex-col gap-4">
              {slide.side.map((s) => (
                <div key={s.label} className="flex flex-col gap-3.5">
                  <p className="font-label text-[26px] font-semibold uppercase tracking-[2px] text-accent">{s.label}</p>
                  {s.lines.map((l) => (
                    <p key={l} className="text-[25px] leading-[1.3] text-muted">{l}</p>
                  ))}
                  {s.callout && <p className="border-l-8 border-[#38F997] py-1 pl-5 text-[26px] font-semibold leading-[1.35]">{s.callout}</p>}
                </div>
              ))}
            </div>
          </div>
          <p className="font-mono text-[26px] text-accent">{slide.links}</p>
        </>
      )}

      <p className="absolute bottom-16 left-32 w-[1200px] text-[24px] text-muted">{deck.footer}</p>
      <p className="absolute bottom-16 right-32 w-[200px] text-right text-[24px] text-muted">{index + 1} / {deck.slides.length}</p>
    </section>
  );
}
