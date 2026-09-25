// PROTOTYPE Variant B — "Canvas": the calendar is the whole app. Everything floats over it;
// you place classes by clicking ghosts, not by filling forms.
import clsx from "clsx";
import { ChevronDown, CircleAlert, Map as MapIcon, Search, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import { fmt } from "../core";
import { COURSES, DAYS, TERM, type Day } from "../data";
import { useStore } from "../store";
import { Calendar, CampusMap, CourseDetail, Dot, Kbd, ProblemCounts, ProblemList, useHotkey, useScheduleInfo } from "../ui";
import { Logo } from "./A";

export function VariantB() {
  const { s, d, active } = useStore();
  const info = useScheduleInfo();
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [showProblems, setShowProblems] = useState(true);
  const [showMap, setShowMap] = useState(false);
  const [mapDay, setMapDay] = useState<Day>(0);
  useHotkey("Escape", () => { d({ type: "select", course: null }); setAnchor(null); });
  useHotkey("p", () => setShowProblems((x) => !x));
  useHotkey("m", () => setShowMap((x) => !x));

  const select = (code: string | null, el?: HTMLElement) => {
    d({ type: "select", course: code });
    if (el && code) {
      const r = el.getBoundingClientRect();
      const x = r.right + 400 > window.innerWidth ? Math.max(12, r.left - 392) : r.right + 8;
      setAnchor({ x, y: Math.min(Math.max(64, r.top - 20), window.innerHeight - 460) });
    } else setAnchor(code ? { x: window.innerWidth - 400, y: 64 } : null);
  };

  return (
    <div className="relative h-full overflow-hidden">
      <div className="scroll-thin h-full overflow-auto pt-14 pr-20 pb-20 pl-2">
        <Calendar sectionIds={active.sections} blocks={active.blocks} ghost={s.hover} swapCourse={s.selectedCourse} selectedCourse={s.selectedCourse}
          hourHeight={62}
          onItemClick={(i, el) => i.course && select(s.selectedCourse === i.course.code ? null : i.course.code, el)}
          onGhostClick={(id) => { d({ type: "add", section: id }); }} />
      </div>

      {/* floating top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-3 px-3 pt-3">
        <div className="pointer-events-auto flex h-9 items-center gap-2 rounded-full border border-border bg-raised/90 pr-1 pl-3 shadow-sm backdrop-blur">
          <Logo />
          <button onClick={() => d({ type: "setActive", id: s.activeId === "a" ? "b" : "a" })} className="flex h-7 items-center gap-1 rounded-full bg-hover px-2.5 text-[12px] font-medium">
            {active.name} <ChevronDown size={12} className="text-muted" />
          </button>
        </div>
        <button onClick={() => d({ type: "palette", open: true })}
          className="pointer-events-auto mx-auto flex h-9 w-full max-w-[440px] items-center gap-2 rounded-full border border-border bg-raised/90 px-3.5 text-[12.5px] text-faint shadow-sm backdrop-blur hover:border-border-strong">
          <Search size={14} className="text-muted" /> Add a course, find a professor…
          <span className="ml-auto"><Kbd>⌘K</Kbd></span>
        </button>
        <div className="tnum pointer-events-auto hidden h-9 items-center gap-3 rounded-full border border-border bg-raised/90 px-3.5 font-mono text-[11.5px] shadow-sm backdrop-blur md:flex">
          <span>{info.credits} cr</span><span className="text-faint">·</span>
          <span>{info.days} days</span><span className="text-faint">·</span>
          <span>{info.earliest != null ? fmt(info.earliest) : "–"} start</span><span className="text-faint">·</span>
          <span className="text-muted">{TERM.name}</span>
        </div>
      </div>

      {/* cart dock on the right edge */}
      <div className="absolute top-1/2 right-3 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-2xl border border-border bg-raised/90 p-1.5 shadow-sm backdrop-blur">
        <ShoppingBag size={14} className="my-1 text-muted" />
        {s.cart.map((code) => (
          <button key={code} onClick={(e) => select(code, e.currentTarget)} title={COURSES[code].title}
            className={clsx("flex w-14 flex-col items-center rounded-xl py-1.5 hover:bg-hover", s.selectedCourse === code && "bg-hover ring-1 ring-border-strong")}>
            <Dot color={COURSES[code].color} />
            <span className="mt-1 font-mono text-[9.5px] font-semibold">{code.slice(0, 4)}</span>
            <span className="font-mono text-[9.5px] text-muted">{code.slice(4)}</span>
          </button>
        ))}
        <div className="px-1 pb-1 text-center text-[9px] leading-tight text-faint">click, then<br />pick a ghost</div>
      </div>

      {/* course popover */}
      {s.selectedCourse && anchor && (
        <div className="pop-in scroll-thin fixed z-40 max-h-[440px] w-[384px] overflow-y-auto rounded-xl border border-border bg-raised shadow-[var(--shadow)]" style={{ left: anchor.x, top: anchor.y }}>
          <CourseDetail code={s.selectedCourse} compact onClose={() => select(null)} />
        </div>
      )}

      {/* problems card */}
      <div className="absolute bottom-16 left-3 w-[340px] max-w-[calc(100%-24px)]">
        {showProblems ? (
          <div className="pop-in overflow-hidden rounded-xl border border-border bg-raised/95 shadow-[var(--shadow)] backdrop-blur">
            <div className="flex h-9 items-center justify-between border-b border-border px-3 text-[12px] font-medium">
              <span className="flex items-center gap-2">Problems <ProblemCounts probs={info.probs} /></span>
              <button onClick={() => setShowProblems(false)} className="rounded p-1 text-muted hover:bg-hover" aria-label="Hide problems"><X size={13} /></button>
            </div>
            <div className="scroll-thin max-h-[240px] overflow-y-auto"><ProblemList probs={info.probs} dense /></div>
          </div>
        ) : (
          <button onClick={() => setShowProblems(true)} className="flex h-8 items-center gap-2 rounded-full border border-border bg-raised px-3 text-[12px] shadow-sm">
            <CircleAlert size={13} className="text-muted" /><ProblemCounts probs={info.probs} /><Kbd>P</Kbd>
          </button>
        )}
      </div>

      {/* map card */}
      <div className="absolute right-24 bottom-16 hidden md:block">
        {showMap ? (
          <div className="pop-in w-[340px] overflow-hidden rounded-xl border border-border bg-raised/95 shadow-[var(--shadow)] backdrop-blur">
            <div className="flex h-9 items-center gap-1 border-b border-border px-2">
              {DAYS.map((n, i) => (
                <button key={n} onClick={() => setMapDay(i as Day)} className={clsx("h-6 flex-1 rounded text-[11px]", mapDay === i ? "bg-hover font-medium" : "text-muted")}>{n}</button>
              ))}
              <button onClick={() => setShowMap(false)} className="rounded p-1 text-muted hover:bg-hover" aria-label="Hide map"><X size={13} /></button>
            </div>
            <CampusMap items={info.items} day={mapDay} className="aspect-[4/3]" />
          </div>
        ) : (
          <button onClick={() => setShowMap(true)} className="flex h-8 items-center gap-2 rounded-full border border-border bg-raised px-3 text-[12px] shadow-sm">
            <MapIcon size={13} className="text-muted" />Day routes<Kbd>M</Kbd>
          </button>
        )}
      </div>
    </div>
  );
}
