// PROTOTYPE Variant C — "Catalog": browsing comes first. A dense, Linear-style list where every
// section tells you whether it fits your schedule (time AND walking), with the week pinned on the right.
import clsx from "clsx";
import { Check, ChevronRight, Footprints, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { itemsFor, profRating, search, walkLegs } from "../core";
import { SECTION_BY_ID, TERM, type Block, type Section } from "../data";
import { useStore } from "../store";
import { Calendar, Chip, CourseDetail, Dot, Kbd, ProblemCounts, ProblemList, Rating, SeatPill, Sparkline, meetingSummary, placeSummary, useScheduleInfo } from "../ui";
import { Logo } from "./A";

const GENEDS = ["DSHU", "DSNS", "DSSP", "DSHS", "SCIS", "DVUP", "FSPW"];

type Fit = { kind: "current" | "fits" | "clash" | "walk" | "async"; label: string; delta?: number };
function fitOf(sec: Section, ids: string[], blocks: Block[]): Fit {
  if (ids.includes(sec.id)) return { kind: "current", label: "In schedule" };
  if (!sec.meetings.length) return { kind: "async", label: "No set times" };
  const others = ids.filter((id) => SECTION_BY_ID[id].course !== sec.course);
  const mine = itemsFor([sec.id]);
  const rest = itemsFor(others, blocks);
  const clash = rest.find((o) => mine.some((m) => m.day === o.day && m.start < o.end && o.start < m.end));
  if (clash) return { kind: "clash", label: `Clashes with ${clash.label}` };
  const before = walkLegs(itemsFor(ids, blocks));
  const after = walkLegs(itemsFor([...others, sec.id], blocks));
  const bad = after.find((l) => l.status === "impossible" && (l.from.sectionId === sec.id || l.to.sectionId === sec.id));
  const delta = after.reduce((n, l) => n + l.walk, 0) - before.reduce((n, l) => n + l.walk, 0);
  if (bad) return { kind: "walk", label: `${bad.walk}m walk in a ${bad.gap}m gap`, delta };
  return { kind: "fits", label: "Fits", delta };
}

export function VariantC() {
  const { s, d, active } = useStore();
  const info = useScheduleInfo();
  const [q, setQ] = useState("");
  const [geneds, setGeneds] = useState<string[]>([]);
  const [fitsOnly, setFitsOnly] = useState(false);
  const [openOnly, setOpenOnly] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["MUSC130", "PHIL140"]));
  const hits = useMemo(() => search([q, ...geneds.map((g) => "gened:" + g), openOnly ? "open" : ""].join(" ")), [q, geneds, openOnly]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border px-3">
        <Logo />
        <span className="text-[12.5px] text-muted">{TERM.name} catalog</span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => d({ type: "palette", open: true })} className="flex h-7 items-center gap-2 rounded-md border border-border bg-raised px-2 text-[12px] text-muted"><Kbd>⌘K</Kbd></button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          {/* filter bar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
            <div className="flex h-8 w-full max-w-[320px] items-center gap-2 rounded-md border border-border bg-raised px-2">
              <Search size={13} className="text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by code, title, @professor" className="flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-faint" />
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {GENEDS.map((g) => (
                <button key={g} onClick={() => setGeneds((x) => (x.includes(g) ? x.filter((y) => y !== g) : [...x, g]))}
                  className={clsx("h-7 rounded-md border px-2 font-mono text-[11px]", geneds.includes(g) ? "border-transparent bg-accent-soft text-accent" : "border-border text-muted hover:text-fg")}>{g}</button>
              ))}
            </div>
            <Toggle on={openOnly} onClick={() => setOpenOnly((x) => !x)}>Open seats</Toggle>
            <Toggle on={fitsOnly} onClick={() => setFitsOnly((x) => !x)}>Fits my week</Toggle>
          </div>
          {/* column heads */}
          <div className="grid grid-cols-[20px_88px_1fr_70px_64px_60px] items-center gap-3 border-b border-border px-3 py-1.5 text-[10.5px] font-medium tracking-wide text-faint uppercase max-md:hidden">
            <span /><span>Course</span><span>Title</span><span className="text-right">Avg GPA</span><span className="text-right">Best prof</span><span className="text-right">Fit</span>
          </div>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto pb-16">
            {hits.map(({ course: c, sections }) => {
              const fits = sections.map((x) => ({ sec: x, fit: fitOf(x, active.sections, active.blocks) }));
              const shown = fitsOnly ? fits.filter((f) => f.fit.kind === "fits" || f.fit.kind === "current" || f.fit.kind === "async") : fits;
              if (!shown.length) return null;
              const nFit = fits.filter((f) => f.fit.kind === "fits" || f.fit.kind === "async").length;
              const isOpen = expanded.has(c.code);
              const best = Math.max(...sections.map((x) => profRating(x) ?? 0));
              const inSched = fits.some((f) => f.fit.kind === "current");
              return (
                <div key={c.code} className="border-b border-border">
                  <div className={clsx("grid cursor-pointer grid-cols-[20px_88px_1fr_70px_64px_60px] items-center gap-3 px-3 py-2 hover:bg-hover max-md:grid-cols-[20px_88px_1fr_60px]", s.selectedCourse === c.code && "bg-hover")}
                    onClick={() => setExpanded((x) => { const n = new Set(x); n.has(c.code) ? n.delete(c.code) : n.add(c.code); return n; })}>
                    <ChevronRight size={14} className={clsx("text-muted transition-transform", isOpen && "rotate-90")} />
                    <span className="flex items-center gap-2"><Dot color={c.color} /><span className="font-mono text-[12px] font-semibold">{c.code}</span></span>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[12.5px]">{c.title}</span>
                      {c.geneds.map((g) => <span key={g} className="rounded border border-border px-1 font-mono text-[10px] text-muted">{g}</span>)}
                      {inSched && <Chip tone="accent" className="!h-5 !text-[10.5px]">in {active.name}</Chip>}
                    </span>
                    <span className="tnum text-right font-mono text-[11.5px] max-md:hidden">{c.avgGpa.toFixed(2)}</span>
                    <span className="text-right max-md:hidden"><Rating value={best || null} /></span>
                    <span className={clsx("tnum text-right font-mono text-[11px]", nFit ? "text-ok" : "text-faint")}>{nFit}/{sections.length}</span>
                  </div>
                  {isOpen && (
                    <div className="bg-panel/60 pb-1">
                      {shown.map(({ sec, fit }) => (
                        <div key={sec.id} onMouseEnter={() => d({ type: "hover", section: sec.id })} onMouseLeave={() => d({ type: "hover", section: null })}
                          className="grid grid-cols-[20px_88px_1fr_auto] items-center gap-3 px-3 py-1.5 hover:bg-hover">
                          <span />
                          <span className="pl-4 font-mono text-[11.5px] text-muted">{sec.code}</span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-2 text-[12px]"><span className="truncate">{sec.profs.join(", ")}</span><Rating value={profRating(sec)} /></span>
                            <span className="tnum block truncate font-mono text-[10.5px] text-muted">{meetingSummary(sec)}{placeSummary(sec) && ` · ${placeSummary(sec)}`}</span>
                          </span>
                          <span className="flex items-center gap-3">
                            <FitBadge fit={fit} />
                            {sec.fillHistory && <span className="max-md:hidden"><Sparkline values={sec.fillHistory} w={40} h={14} /></span>}
                            <span className="w-14 text-right"><SeatPill s={sec} compact /></span>
                            {fit.kind === "current" ? (
                              <button onClick={() => d({ type: "select", course: c.code })} className="h-6 w-16 rounded-md text-[11px] text-accent"><Check size={12} className="inline" /> Added</button>
                            ) : (
                              <button onClick={() => d({ type: "add", section: sec.id })} className="h-6 w-16 rounded-md border border-border bg-raised text-[11px] font-medium hover:border-border-strong">
                                {fits.some((f) => f.fit.kind === "current") ? "Swap" : "Add"}
                              </button>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </main>
        {/* pinned week */}
        <aside className="scroll-thin hidden w-[440px] shrink-0 flex-col overflow-y-auto border-l border-border lg:flex">
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
            <div className="flex items-center gap-1">
              {s.schedules.map((x) => (
                <button key={x.id} onClick={() => d({ type: "setActive", id: x.id })} className={clsx("h-6 rounded px-2 text-[12px]", x.id === s.activeId ? "bg-hover font-medium" : "text-muted")}>{x.name}</button>
              ))}
            </div>
            <span className="tnum font-mono text-[11px] text-muted">{info.credits} cr · {info.walkMin} min walking</span>
          </div>
          <div className="px-1">
            <Calendar sectionIds={active.sections} blocks={active.blocks} ghost={s.hover} hourHeight={34} className="!min-w-0"
              onItemClick={(i) => i.course && d({ type: "select", course: i.course.code })} />
          </div>
          <div className="mt-2 flex items-center justify-between border-y border-border px-3 py-2 text-[12px] font-medium">Problems <ProblemCounts probs={info.probs} /></div>
          <ProblemList probs={info.probs} dense />
          {s.selectedCourse && (
            <div className="fixed inset-0 z-40 flex justify-end bg-black/20" onClick={() => d({ type: "select", course: null })}>
              <div className="pop-in scroll-thin h-full w-[400px] max-w-full overflow-y-auto border-l border-border bg-bg shadow-[var(--shadow)]" onClick={(e) => e.stopPropagation()}>
                <CourseDetail code={s.selectedCourse} onClose={() => d({ type: "select", course: null })} />
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function FitBadge({ fit }: { fit: Fit }) {
  const tone = { current: "text-accent", fits: "text-ok", clash: "text-err", walk: "text-err", async: "text-muted" }[fit.kind];
  return (
    <span className={clsx("tnum inline-flex w-[190px] items-center justify-end gap-1 text-right text-[11px] max-md:hidden", tone)}>
      {fit.kind === "walk" && <Footprints size={11} />}
      <span className="truncate">{fit.label}</span>
      {fit.kind === "fits" && fit.delta != null && fit.delta !== 0 && <span className="font-mono text-muted">{fit.delta > 0 ? "+" : ""}{fit.delta}m walk</span>}
    </span>
  );
}

const Toggle = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) => (
  <button onClick={onClick} className={clsx("flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11.5px]", on ? "border-transparent bg-fg text-bg" : "border-border text-muted hover:text-fg")}>
    <span className={clsx("size-1.5 rounded-full", on ? "bg-ok" : "bg-faint")} />{children}
  </button>
);
