// PROTOTYPE Variant D — "Generate": start from intent, not from a calendar. Describe the week you
// want, get ranked schedules, flip through them with j/k, and apply the one you like.
import clsx from "clsx";
import { ArrowRight, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fmt, generate, parseConstraints, PRESETS, type Constraints, type Preset } from "../core";
import { COURSES, DAYS, SECTION_BY_ID, TERM, type Day } from "../data";
import { useStore } from "../store";
import { Calendar, Chip, Dot, Kbd, MiniCalendar, ProblemCounts, useHotkey, useScheduleInfo } from "../ui";
import { Logo } from "./A";

type Role = "required" | "optional" | "off";
const EXAMPLE = "no classes before 10, and no sprinting between buildings";

export function VariantD() {
  const { s, d, active } = useStore();
  const currentCourses = active.sections.map((id) => SECTION_BY_ID[id].course);
  const [roles, setRoles] = useState<Record<string, Role>>(() => Object.fromEntries([...currentCourses.map((c) => [c, "required"]), ...s.cart.map((c) => [c, "optional"])]));
  const [text, setText] = useState(EXAMPLE);
  const [cons, setCons] = useState<Constraints>(() => ({ daysOff: [], openOnly: false, noImpossibleWalks: false, ...parseConstraints(EXAMPLE) }));
  const [chips, setChips] = useState<string[]>(() => parseConstraints(EXAMPLE).chips);
  const [preset, setPreset] = useState<Preset>("compact");
  const [idx, setIdx] = useState(0);

  const required = Object.keys(roles).filter((c) => roles[c] === "required");
  const optional = Object.keys(roles).filter((c) => roles[c] === "optional");
  const run = useMemo(() => {
    const t0 = performance.now();
    const r = generate(required, optional, active.blocks, cons, preset);
    return { ...r, ms: performance.now() - t0 };
  }, [required.join(), optional.join(), active.blocks, cons, preset]);
  useEffect(() => setIdx(0), [run]);
  const sel = run.results[idx];
  const changed = useMemo(() => new Set(sel?.sections.filter((id) => !active.sections.includes(id)) ?? []), [sel, active.sections]);
  const info = useScheduleInfo(sel?.sections ?? [], active.blocks);

  useHotkey("j", () => setIdx((i) => Math.min(i + 1, run.results.length - 1)), [run]);
  useHotkey("k", () => setIdx((i) => Math.max(i - 1, 0)), [run]);
  useHotkey("Enter", () => sel && d({ type: "apply", sections: sel.sections }), [sel]);

  const understand = () => {
    const p = parseConstraints(text);
    setCons({ daysOff: [], openOnly: false, noImpossibleWalks: false, ...p });
    setChips(p.chips);
  };
  const dropChip = (chip: string) => {
    setChips((c) => c.filter((x) => x !== chip));
    setCons((c) => {
      const n = { ...c };
      if (chip.startsWith("Start after")) n.noBefore = undefined;
      if (chip.startsWith("End by")) n.noAfter = undefined;
      if (chip.endsWith(" off")) n.daysOff = [];
      if (chip === "Open seats only") n.openOnly = false;
      if (chip === "No impossible walks") n.noImpossibleWalks = false;
      return n;
    });
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border px-3">
        <Logo />
        <span className="text-[12.5px] text-muted">Generate · {TERM.name}</span>
        <span className="ml-auto flex items-center gap-2 text-[11.5px] text-muted"><Kbd>j</Kbd><Kbd>k</Kbd> browse <Kbd>↵</Kbd> apply</span>
      </header>

      {/* intent bar */}
      <div className="border-b border-border px-4 py-3">
        <form onSubmit={(e) => { e.preventDefault(); understand(); }} className="flex items-center gap-2 rounded-lg border border-border bg-raised px-3 focus-within:border-border-strong">
          <Sparkles size={15} className="text-accent" />
          <input id="d-intent" value={text} onChange={(e) => setText(e.target.value)} placeholder="Describe your ideal week… try adding “fridays off”" className="h-10 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-faint" />
          <button className="flex h-7 items-center gap-1 rounded-md bg-fg px-2.5 text-[12px] font-medium text-bg">Apply <ArrowRight size={12} /></button>
        </form>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11.5px] text-muted">Understood as</span>
          {chips.map((c) => <Chip key={c} tone="accent" onRemove={() => dropChip(c)}>{c}</Chip>)}
          {!chips.length && <span className="text-[11.5px] text-faint">nothing yet. Try “no classes before 10” or “fridays off”.</span>}
          <span className="mx-2 h-4 w-px bg-border" />
          <span className="mr-1 text-[11.5px] text-muted">Rank by</span>
          <div className="flex rounded-md border border-border p-0.5">
            {(Object.keys(PRESETS) as Preset[]).map((p) => (
              <button key={p} onClick={() => setPreset(p)} className={clsx("h-6 rounded px-2 text-[11.5px]", preset === p ? "bg-hover font-medium text-fg" : "text-muted hover:text-fg")}>{PRESETS[p]}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* courses */}
        <aside className="scroll-thin hidden w-[230px] shrink-0 overflow-y-auto border-r border-border bg-panel md:block">
          <div className="px-3 pt-3 pb-2 text-[11px] font-medium tracking-wide text-muted uppercase">Courses</div>
          {Object.keys(roles).map((code) => (
            <div key={code} className="px-3 py-1.5">
              <div className="flex items-center gap-2"><Dot color={COURSES[code].color} /><span className="font-mono text-[12px] font-semibold">{code}</span><span className="tnum ml-auto font-mono text-[10.5px] text-faint">{COURSES[code].credits}cr</span></div>
              <div className="mt-1 flex rounded-md border border-border p-0.5">
                {(["required", "optional", "off"] as Role[]).map((r) => (
                  <button key={r} onClick={() => setRoles((x) => ({ ...x, [code]: r }))}
                    className={clsx("h-5 flex-1 rounded text-[10.5px] capitalize", roles[code] === r ? (r === "required" ? "bg-fg text-bg" : "bg-hover text-fg") : "text-faint hover:text-muted")}>{r === "off" ? "skip" : r}</button>
                ))}
              </div>
            </div>
          ))}
          <div className="px-3 pt-4 pb-2 text-[11px] font-medium tracking-wide text-muted uppercase">Always</div>
          <label className="flex items-center gap-2 px-3 py-1 text-[12px]"><input type="checkbox" id="d-open" checked={cons.openOnly} onChange={(e) => setCons((c) => ({ ...c, openOnly: e.target.checked }))} /> Open seats only</label>
          <label className="flex items-center gap-2 px-3 py-1 text-[12px]"><input type="checkbox" id="d-walk" checked={cons.noImpossibleWalks} onChange={(e) => setCons((c) => ({ ...c, noImpossibleWalks: e.target.checked }))} /> No impossible walks</label>
          <div className="flex flex-wrap gap-1 px-3 py-2">
            {DAYS.map((n, i) => (
              <button key={n} onClick={() => setCons((c) => ({ ...c, daysOff: c.daysOff.includes(i as Day) ? c.daysOff.filter((x) => x !== i) : [...c.daysOff, i as Day] }))}
                className={clsx("h-6 rounded border px-1.5 text-[11px]", cons.daysOff.includes(i as Day) ? "border-transparent bg-accent-soft text-accent line-through" : "border-border text-muted")}>{n}</button>
            ))}
          </div>
        </aside>

        {/* results */}
        <section className="scroll-thin w-[300px] shrink-0 overflow-y-auto border-r border-border max-sm:w-full">
          <div className="tnum sticky top-0 z-10 border-b border-border bg-bg/90 px-3 py-2 text-[11.5px] text-muted backdrop-blur">
            <span className="font-medium text-fg">{run.results.length}</span> schedules · {run.explored} combinations checked in {run.ms.toFixed(1)} ms
          </div>
          {!run.results.length && (
            <div className="p-4">
              <div className="text-[13px] font-medium">Nothing fits all of that.</div>
              <p className="mt-1 text-[12px] text-muted">Loosen one of these to see schedules:</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {run.hints.map((h) => (
                  <button key={h} onClick={() => {
                    if (h === "Allow earlier classes") dropChip(chips.find((c) => c.startsWith("Start after")) ?? "");
                    if (h === "Drop a day off") dropChip(chips.find((c) => c.endsWith(" off")) ?? "");
                    if (h === "Include full sections") dropChip("Open seats only");
                    if (h === "Allow tight walks") dropChip("No impossible walks");
                  }} className="h-7 rounded-md border border-border bg-raised px-2 text-[12px] hover:border-border-strong">{h}</button>
                ))}
              </div>
            </div>
          )}
          {run.results.map((r, i) => {
            const swaps = r.sections.filter((id) => !active.sections.includes(id)).length;
            return (
              <button key={r.sections.join()} onClick={() => setIdx(i)} className={clsx("flex w-full gap-3 border-b border-border px-3 py-2.5 text-left", i === idx ? "bg-hover" : "hover:bg-hover/60")}>
                <div className="h-[64px] w-[84px] shrink-0"><MiniCalendar sectionIds={r.sections} blocks={active.blocks} highlight={new Set(r.sections.filter((id) => !active.sections.includes(id)))} /></div>
                <div className="tnum min-w-0 flex-1 text-[11.5px]">
                  <div className="flex items-center gap-2"><span className="font-mono text-faint">#{i + 1}</span><span className="font-medium">{r.stats.days} days · starts {fmt(r.stats.earliest)}</span></div>
                  <div className="mt-1 font-mono text-[10.5px] text-muted">{r.stats.walk} min walking · ★ {r.stats.rating.toFixed(1)}</div>
                  <div className="mt-0.5 font-mono text-[10.5px] text-muted">{r.sections.length} courses · min {r.stats.minOpen} seats open</div>
                  <div className="mt-0.5 text-[10.5px] text-accent">{swaps ? `${swaps} change${swaps > 1 ? "s" : ""} from ${active.name}` : `Same as ${active.name}`}</div>
                </div>
              </button>
            );
          })}
        </section>

        {/* preview */}
        <main className="scroll-thin hidden min-w-0 flex-1 flex-col overflow-auto sm:flex">
          {sel && (
            <>
              <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2">
                <span className="text-[12.5px] font-medium">Schedule #{idx + 1}</span>
                <ProblemCounts probs={info.probs} />
                <div className="flex flex-wrap gap-1">
                  {[...changed].map((id) => {
                    const from = active.sections.find((x) => SECTION_BY_ID[x].course === SECTION_BY_ID[id].course);
                    return <Chip key={id} className="font-mono !text-[10.5px]">{SECTION_BY_ID[id].course} {from ? `${from.split("-")[1]} → ` : "+ "}{id.split("-")[1]}</Chip>;
                  })}
                </div>
                <button onClick={() => d({ type: "apply", sections: sel.sections })} className="ml-auto flex h-7 items-center gap-1.5 rounded-md bg-accent px-3 text-[12px] font-medium text-accent-fg">
                  <Wand2 size={13} />Apply to {active.name}
                </button>
              </div>
              <Calendar sectionIds={sel.sections} blocks={active.blocks} highlight={changed} hourHeight={48} className="pb-16" />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
