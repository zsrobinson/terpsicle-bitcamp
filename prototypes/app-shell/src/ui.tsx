// PROTOTYPE shared pieces. Variants own their layout; these are the building blocks.
import { Command } from "cmdk";
import clsx from "clsx";
import {
  Accessibility, ArrowRightLeft, CircleAlert, CircleX, Footprints, Info, Moon, Plus, Search, ShoppingBag, Sparkles, Star, TriangleAlert, X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  credits, daysLabel, fmt, fmtRange, itemsFor, layoutDay, problems, profRating, search, walkLegs,
  type Item, type Leg, type Problem,
} from "./core";
import { BUILDINGS, COURSES, DAYS, PROFS, SECTION_BY_ID, sectionsOf, type Block, type Day, type Section } from "./data";
import { useStore } from "./store";

// ---------- atoms ----------
export const Kbd = ({ children }: { children: ReactNode }) => (
  <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-border bg-raised px-1 font-mono text-[10px] font-medium text-muted">{children}</kbd>
);

export const Chip = ({ children, tone = "neutral", onRemove, className }: { children: ReactNode; tone?: "neutral" | "accent" | "ok" | "warn" | "err"; onRemove?: () => void; className?: string }) => (
  <span className={clsx("inline-flex h-6 items-center gap-1 rounded-md border px-2 text-xs whitespace-nowrap", {
    neutral: "border-border bg-raised text-fg",
    accent: "border-transparent bg-accent-soft text-accent",
    ok: "border-transparent bg-ok-soft text-ok",
    warn: "border-transparent bg-warn-soft text-warn",
    err: "border-transparent bg-err-soft text-err",
  }[tone], className)}>
    {children}
    {onRemove && (
      <button onClick={onRemove} className="-mr-1 rounded p-0.5 opacity-60 hover:opacity-100" aria-label="Remove"><X size={12} /></button>
    )}
  </span>
);

export const Dot = ({ color, className }: { color: number; className?: string }) => (
  <span className={clsx("inline-block size-2 shrink-0 rounded-full", className)} style={{ background: `var(--c${color}-dot)` }} />
);

export function SeatPill({ s, compact }: { s: Section; compact?: boolean }) {
  const { open, total, wait } = s.seats;
  if (open === 0)
    return <span className="tnum inline-flex items-center gap-1 font-mono text-[11px] text-err">Full{!compact && wait ? ` · WL ${wait}` : ""}</span>;
  const low = open <= 3 || open / total < 0.06;
  return (
    <span className={clsx("tnum font-mono text-[11px]", low ? "text-warn" : "text-muted")}>
      {open}<span className="text-faint">/{total}</span>
    </span>
  );
}

export function Sparkline({ values, w = 56, h = 16 }: { values: number[]; w?: number; h?: number }) {
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 1 - (v / max) * (h - 2)]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
  const last = pts[pts.length - 1];
  const low = values[values.length - 1] / max < 0.1;
  return (
    <svg width={w} height={h} className="overflow-visible" aria-hidden>
      <path d={`${d}L${w},${h}L0,${h}Z`} fill={low ? "var(--err-soft)" : "var(--grid)"} />
      <path d={d} fill="none" stroke={low ? "var(--err)" : "var(--muted)"} strokeWidth={1.25} />
      <circle cx={last[0]} cy={last[1]} r={2} fill={low ? "var(--err)" : "var(--fg)"} />
    </svg>
  );
}

export const Rating = ({ value }: { value: number | null }) =>
  value == null ? <span className="text-faint">–</span> : (
    <span className={clsx("tnum inline-flex items-center gap-0.5 font-mono text-[11px]", value >= 4 ? "text-ok" : value < 3 ? "text-err" : "text-fg")}>
      <Star size={10} className="fill-current" />{value.toFixed(1)}
    </span>
  );

export function GradeBar({ grades }: { grades: number[] }) {
  const tones = ["var(--ok)", "color-mix(in oklab, var(--ok) 55%, var(--warn))", "var(--warn)", "color-mix(in oklab, var(--warn) 45%, var(--err))", "var(--err)"];
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full">
        {grades.map((g, i) => <div key={i} style={{ width: `${g}%`, background: tones[i] }} />)}
      </div>
      <div className="tnum mt-1.5 flex justify-between font-mono text-[10px] text-muted">
        {["A", "B", "C", "D", "F"].map((l, i) => <span key={l}>{l} {grades[i]}%</span>)}
      </div>
    </div>
  );
}

export const DeliveryBadge = ({ s }: { s: Section }) =>
  s.delivery === "f2f" ? null : (
    <span className="rounded border border-border px-1 font-mono text-[10px] text-muted">
      {{ blended: "Blended", "online-sync": "Online sync", "online-async": "Online async" }[s.delivery]}
    </span>
  );

export const meetingSummary = (s: Section) =>
  s.meetings.length ? s.meetings.map((m) => `${daysLabel(m.days)} ${fmtRange(m.start, m.end)}`).join(" · ") : "No set times";
export const placeSummary = (s: Section) => [...new Set(s.meetings.map((m) => m.bldg).filter(Boolean))].join(", ");

// ---------- derived schedule stats ----------
export function useScheduleInfo(sectionIds?: string[], blocks?: Block[]) {
  const { s, active } = useStore();
  const ids = sectionIds ?? active.sections;
  const bl = blocks ?? active.blocks;
  return useMemo(() => {
    const items = itemsFor(ids, bl);
    const legs = walkLegs(items, { accessible: s.accessible, pace: s.pace });
    const probs = problems(ids, bl, { accessible: s.accessible, pace: s.pace });
    const secItems = items.filter((i) => i.kind === "section");
    const days = new Set(secItems.map((i) => i.day)).size;
    const earliest = secItems.length ? Math.min(...secItems.map((i) => i.start)) : null;
    const latest = secItems.length ? Math.max(...secItems.map((i) => i.end)) : null;
    const walkMin = legs.reduce((n, l) => n + l.walk, 0);
    const walkFt = legs.reduce((n, l) => n + l.feet, 0);
    return { items, legs, probs, credits: credits(ids), days, earliest, latest, walkMin, walkFt };
  }, [ids, bl, s.accessible, s.pace]);
}

// ---------- calendar ----------
type CalProps = {
  sectionIds: string[];
  blocks: Block[];
  ghost?: string | null;
  swapCourse?: string | null;
  highlight?: Set<string>;
  onItemClick?: (item: Item, el: HTMLElement) => void;
  onGhostClick?: (sectionId: string) => void;
  showWalks?: boolean;
  hourHeight?: number;
  selectedCourse?: string | null;
  className?: string;
};

export function Calendar({ sectionIds, blocks, ghost, swapCourse, highlight, onItemClick, onGhostClick, showWalks = true, hourHeight = 52, selectedCourse, className }: CalProps) {
  const { s } = useStore();
  const items = useMemo(() => itemsFor(sectionIds, blocks), [sectionIds, blocks]);
  const ghostIds = useMemo(() => {
    const g = new Set<string>();
    if (ghost && !sectionIds.includes(ghost)) g.add(ghost);
    if (swapCourse) sectionsOf(swapCourse).forEach((x) => !sectionIds.includes(x.id) && g.add(x.id));
    return [...g];
  }, [ghost, swapCourse, sectionIds]);
  const ghostItems = useMemo(() => itemsFor(ghostIds), [ghostIds]);
  const legs = useMemo(() => (showWalks ? walkLegs(items, { accessible: s.accessible, pace: s.pace }) : []), [items, showWalks, s.accessible, s.pace]);

  const all = [...items, ...ghostItems];
  const startH = Math.min(8, ...all.map((i) => Math.floor(i.start / 60)));
  const endH = Math.max(17, ...all.map((i) => Math.ceil(i.end / 60)));
  const y = (m: number) => ((m - startH * 60) / 60) * hourHeight;
  const hours = Array.from({ length: endH - startH + 1 }, (_, i) => startH + i);

  return (
    <div className={clsx("relative flex min-w-[560px] flex-col", className)}>
      <div className="sticky top-0 z-20 grid grid-cols-[44px_repeat(5,1fr)] border-b border-border bg-bg/90 backdrop-blur">
        <div />
        {DAYS.map((d) => (
          <div key={d} className="px-2 py-2 text-[11px] font-medium tracking-wide text-muted uppercase">{d}</div>
        ))}
      </div>
      <div className="relative grid grid-cols-[44px_repeat(5,1fr)]" style={{ height: y(endH * 60) }}>
        <div className="relative">
          {hours.slice(0, -1).map((h) => (
            <div key={h} className="tnum absolute right-2 -translate-y-1/2 font-mono text-[10px] text-faint" style={{ top: y(h * 60) }}>{h === startH ? "" : fmt(h * 60)}</div>
          ))}
        </div>
        {DAYS.map((_, d) => {
          const dayItems = items.filter((i) => i.day === d);
          const dayGhosts = ghostItems.filter((i) => i.day === d);
          const placed = layoutDay(dayItems);
          const placedGhosts = layoutDay(dayGhosts);
          return (
            <div key={d} className="relative border-l border-border">
              {hours.slice(1, -1).map((h) => <div key={h} className="absolute inset-x-0 border-t border-border/60" style={{ top: y(h * 60) }} />)}
              {placed.map(({ item, col, cols }) => (
                <Block key={item.key} item={item} top={y(item.start)} height={y(item.end) - y(item.start)} col={col} cols={cols}
                  dim={!!swapCourse && item.course?.code !== swapCourse}
                  selected={!!selectedCourse && item.course?.code === selectedCourse}
                  changed={!!item.sectionId && !!highlight?.has(item.sectionId)}
                  onClick={onItemClick} />
              ))}
              {placedGhosts.map(({ item, col, cols }) => {
                const clash = dayItems.some((o) => o.course?.code !== item.course?.code && o.start < item.end && item.start < o.end);
                return (
                  <button key={"g" + item.key} onClick={() => onGhostClick?.(item.sectionId!)}
                    className={clsx("fade-in absolute z-10 overflow-hidden rounded-md border border-dashed px-1.5 py-1 text-left text-[11px] backdrop-blur-[1px] transition-colors",
                      clash ? "border-err bg-err-soft text-err" : "hover:bg-raised")}
                    style={{ top: y(item.start) + 1, height: y(item.end) - y(item.start) - 2, left: `calc(${(col / cols) * 100}% + 2px)`, width: `calc(${100 / cols}% - 4px)`, ...(clash ? {} : { borderColor: `var(--c${item.course!.color}-bd)`, color: `var(--c${item.course!.color}-fg)`, background: `color-mix(in oklab, var(--c${item.course!.color}-bg) 55%, transparent)` }) }}>
                    <div className="font-mono font-medium">{item.section!.code}</div>
                    <div className="truncate opacity-80">{item.section!.profs.join(", ")}</div>
                    {clash && <div className="font-medium">Conflict</div>}
                  </button>
                );
              })}
              {legs.filter((l) => l.day === d).map((l) => <WalkPill key={l.from.key + l.to.key} leg={l} top={y(l.from.end + l.gap / 2)} />)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Block({ item, top, height, col, cols, dim, selected, changed, onClick }: { item: Item; top: number; height: number; col: number; cols: number; dim?: boolean; selected?: boolean; changed?: boolean; onClick?: (i: Item, el: HTMLElement) => void }) {
  const c = item.course?.color;
  const isBlock = item.kind === "block";
  return (
    <button
      onClick={(e) => onClick?.(item, e.currentTarget)}
      className={clsx("group absolute overflow-hidden rounded-md border px-1.5 py-1 text-left transition-[opacity,box-shadow] duration-150", dim && "opacity-35", isBlock && "stripes border-border bg-panel text-muted", selected && "ring-2 ring-fg/70", changed && "ring-2 ring-accent")}
      style={{ top: top + 1, height: height - 2, left: `calc(${(col / cols) * 100}% + 2px)`, width: `calc(${100 / cols}% - 4px)`, ...(isBlock ? {} : { background: `var(--c${c}-bg)`, borderColor: `var(--c${c}-bd)`, color: `var(--c${c}-fg)` }) }}>
      <div className="flex items-center gap-1 text-[11px] leading-tight">
        <span className={clsx("truncate font-semibold", !isBlock && "font-mono")}>{item.label}</span>
        {item.meeting?.kind && item.meeting.kind !== "Lec" && <span className="rounded bg-current/10 px-1 font-mono text-[9px]">{item.meeting.kind}</span>}
      </div>
      {height > 34 && <div className="tnum truncate font-mono text-[10px] opacity-75">{fmtRange(item.start, item.end)}</div>}
      {height > 50 && item.bldg && <div className="truncate text-[10px] opacity-75">{item.bldg} {item.room}</div>}
      {height > 66 && item.section && <div className="truncate text-[10px] opacity-60">{item.section.profs.join(", ")}</div>}
    </button>
  );
}

function WalkPill({ leg, top }: { leg: Leg; top: number }) {
  const tone = { ok: "text-muted border-border bg-raised", tight: "text-warn border-warn/40 bg-raised", impossible: "text-err border-err/50 bg-raised" }[leg.status];
  return (
    <div className="group absolute left-1/2 z-30 -translate-x-1/2 -translate-y-1/2" style={{ top }}>
      <div className={clsx("tnum flex h-[18px] items-center gap-1 rounded-full border px-1.5 font-mono text-[10px] whitespace-nowrap shadow-sm", tone)}>
        <Footprints size={10} />{leg.walk}m{leg.status !== "ok" && <span className="opacity-70">/{leg.gap}</span>}
      </div>
      <div className="pointer-events-none absolute top-full left-1/2 z-40 mt-1 hidden w-52 -translate-x-1/2 rounded-md border border-border bg-raised p-2 text-[11px] shadow-[var(--shadow)] group-hover:block">
        <div className="font-medium text-fg">{BUILDINGS[leg.from.bldg!]?.name} → {BUILDINGS[leg.to.bldg!]?.name}</div>
        <div className="tnum mt-0.5 text-muted">{leg.feet.toLocaleString()} ft · {leg.walk} min walk · {leg.gap} min between classes</div>
        {leg.status === "impossible" && <div className="mt-1 text-err">You'd arrive about {leg.walk - leg.gap} min late.</div>}
      </div>
    </div>
  );
}

// ---------- mini calendar (thumbnails) ----------
export function MiniCalendar({ sectionIds, blocks = [], highlight, className }: { sectionIds: string[]; blocks?: Block[]; highlight?: Set<string>; className?: string }) {
  const items = itemsFor(sectionIds, blocks);
  const legs = walkLegs(items);
  const s0 = 8 * 60, s1 = 18 * 60;
  const pct = (m: number) => ((Math.min(Math.max(m, s0), s1) - s0) / (s1 - s0)) * 100;
  return (
    <div className={clsx("grid h-full grid-cols-5 gap-[3px]", className)}>
      {[0, 1, 2, 3, 4].map((d) => (
        <div key={d} className="relative rounded-[3px] bg-panel">
          {items.filter((i) => i.day === d).map((i) => (
            <div key={i.key} className={clsx("absolute inset-x-[2px] rounded-[2px]", i.kind === "block" && "stripes bg-hover", i.sectionId && highlight?.has(i.sectionId) && "ring-1 ring-accent")}
              style={{ top: `${pct(i.start)}%`, height: `${pct(i.end) - pct(i.start)}%`, ...(i.course ? { background: `var(--c${i.course.color}-dot)` } : {}) }} />
          ))}
          {legs.filter((l) => l.day === d && l.status !== "ok").map((l) => (
            <div key={l.from.key} className={clsx("absolute inset-x-0 h-[2px]", l.status === "impossible" ? "bg-err" : "bg-warn")} style={{ top: `${pct(l.from.end)}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------- problems ----------
const SevIcon = ({ p }: { p: Problem }) =>
  p.severity === "error" ? <CircleX size={14} className="mt-px shrink-0 text-err" /> : p.severity === "warning" ? <TriangleAlert size={14} className="mt-px shrink-0 text-warn" /> : <Info size={14} className="mt-px shrink-0 text-muted" />;

export function ProblemList({ probs, dense }: { probs: Problem[]; dense?: boolean }) {
  const { d } = useStore();
  if (!probs.length)
    return <div className="flex items-center gap-2 px-3 py-6 text-muted"><CircleAlert size={14} className="text-ok" />No problems. This schedule works.</div>;
  return (
    <ul className="divide-y divide-border">
      {probs.map((p) => (
        <li key={p.id} className={clsx("group flex gap-2.5 px-3 hover:bg-hover", dense ? "py-2" : "py-2.5")}>
          <SevIcon p={p} />
          <button className="min-w-0 flex-1 text-left" onClick={() => p.sectionId && d({ type: "select", course: SECTION_BY_ID[p.sectionId].course })}>
            <div className="text-[12.5px] font-medium">{p.title}</div>
            <div className="tnum mt-0.5 text-[11.5px] text-muted">{p.detail}</div>
          </button>
          {p.fix?.swapTo && (
            <button onClick={() => d({ type: "add", section: p.fix!.swapTo! })}
              className="h-6 shrink-0 self-center rounded-md border border-border bg-raised px-2 text-[11px] font-medium hover:border-border-strong">
              {p.fix.label}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ProblemCounts({ probs }: { probs: Problem[] }) {
  const e = probs.filter((p) => p.severity === "error").length;
  const w = probs.filter((p) => p.severity === "warning").length;
  return (
    <span className="tnum inline-flex items-center gap-2 font-mono text-[11px]">
      <span className={clsx("inline-flex items-center gap-1", e ? "text-err" : "text-faint")}><CircleX size={12} />{e}</span>
      <span className={clsx("inline-flex items-center gap-1", w ? "text-warn" : "text-faint")}><TriangleAlert size={12} />{w}</span>
    </span>
  );
}

// ---------- course inspector ----------
export function CourseDetail({ code, onClose, compact }: { code: string; onClose?: () => void; compact?: boolean }) {
  const { s, d, active } = useStore();
  const c = COURSES[code];
  const secs = sectionsOf(code);
  const current = active.sections.find((id) => SECTION_BY_ID[id].course === code);
  const profs = [...new Set(secs.flatMap((x) => x.profs))];
  return (
    <div className="flex flex-col">
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Dot color={c.color} />
            <span className="font-mono text-[13px] font-semibold">{c.code}</span>
            <span className="tnum font-mono text-[11px] text-muted">{c.credits} cr</span>
            {c.geneds.map((g) => <Chip key={g} className="!h-5 !px-1.5 font-mono !text-[10px]">{g}</Chip>)}
          </div>
          <div className="mt-1 text-[15px] leading-snug font-medium text-balance">{c.title}</div>
        </div>
        {onClose && <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-hover hover:text-fg" aria-label="Close"><X size={16} /></button>}
      </div>
      <div className="flex gap-2 px-4 pb-3">
        {current ? (
          <button onClick={() => d({ type: "remove", course: code })} className="h-7 rounded-md border border-border bg-raised px-2.5 text-xs font-medium hover:border-border-strong">Remove from {active.name}</button>
        ) : (
          <button onClick={() => d({ type: "cart", course: code, on: !s.cart.includes(code) })} className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-raised px-2.5 text-xs font-medium hover:border-border-strong">
            <ShoppingBag size={13} />{s.cart.includes(code) ? "In cart" : "Add to cart"}
          </button>
        )}
      </div>
      {!compact && <p className="px-4 pb-3 text-[12.5px] leading-relaxed text-muted">{c.desc}</p>}
      {c.prereq && <p className="px-4 pb-3 text-[12px] text-muted"><span className="font-medium text-fg">Prerequisite:</span> {c.prereq}</p>}

      <SectionHeader>Sections <span className="font-normal text-faint">· hover to preview, click to {current ? "swap" : "add"}</span></SectionHeader>
      <div className="divide-y divide-border border-y border-border">
        {secs.map((sec) => {
          const isCur = sec.id === current;
          const clash = !isCur && sec.meetings.length > 0 && itemsFor([sec.id]).some((g) => itemsFor(active.sections.filter((x) => SECTION_BY_ID[x].course !== code), active.blocks).some((o) => o.day === g.day && o.start < g.end && g.start < o.end));
          return (
            <div key={sec.id} onMouseEnter={() => d({ type: "hover", section: sec.id })} onMouseLeave={() => d({ type: "hover", section: null })}
              className={clsx("group grid grid-cols-[44px_1fr_auto] items-center gap-x-2 px-4 py-2 hover:bg-hover", isCur && "bg-accent-soft/60")}>
              <span className="font-mono text-[12px] font-medium">{sec.code}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[12px]">
                  <span className="truncate">{sec.profs.join(", ")}</span>
                  <Rating value={profRating(sec)} />
                  <DeliveryBadge s={sec} />
                </div>
                <div className="tnum truncate font-mono text-[10.5px] text-muted">{meetingSummary(sec)}{placeSummary(sec) && ` · ${placeSummary(sec)}`}</div>
                {sec.note && <div className="truncate text-[10.5px] text-warn">{sec.note}</div>}
              </div>
              <div className="flex items-center gap-2">
                {sec.fillHistory && <Sparkline values={sec.fillHistory} w={36} h={14} />}
                <span className="w-12 text-right"><SeatPill s={sec} compact /></span>
                {isCur ? (
                  <span className="w-14 text-center text-[11px] text-accent">Current</span>
                ) : (
                  <button onClick={() => d({ type: "add", section: sec.id })}
                    className={clsx("h-6 w-14 rounded-md border text-[11px] font-medium", clash ? "border-err/40 text-err" : "border-border bg-raised hover:border-border-strong")}>
                    {clash ? "Clash" : current ? "Swap" : "Add"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <SectionHeader>Grades <span className="font-normal text-faint">· all sections, last 4 terms</span></SectionHeader>
      <div className="px-4 pb-1">
        <div className="tnum mb-2 font-mono text-[11px] text-muted">avg GPA <span className="text-fg">{c.avgGpa.toFixed(2)}</span></div>
        <GradeBar grades={c.grades} />
      </div>

      <SectionHeader>Instructors <span className="inline-flex items-center gap-1 font-normal text-faint"><Sparkles size={11} />review summaries</span></SectionHeader>
      <div className="flex flex-col gap-3 px-4 pb-5">
        {profs.map((p) => {
          const pr = PROFS[p];
          return (
            <div key={p} className="rounded-lg border border-border bg-raised p-3">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] font-medium">{p}</span>
                <span className="flex items-center gap-2"><Rating value={pr?.rating ?? null} /><span className="tnum font-mono text-[10px] text-faint">{pr?.reviews} reviews</span></span>
              </div>
              {pr && <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{pr.summary}</p>}
              {pr && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {pr.tags.map((t) => <Chip key={t.label} tone={t.tone === "good" ? "ok" : t.tone === "bad" ? "err" : "neutral"} className="!h-5 !text-[10.5px]">{t.label}</Chip>)}
                </div>
              )}
            </div>
          );
        })}
        <div className="text-[10.5px] text-faint">Summaries are generated from PlanetTerp reviews and link back to them. Mock data.</div>
      </div>
    </div>
  );
}

export const SectionHeader = ({ children }: { children: ReactNode }) => (
  <div className="px-4 pt-4 pb-2 text-[11px] font-medium tracking-wide text-muted uppercase">{children}</div>
);

// ---------- command palette ----------
export function CommandPalette({ extra }: { extra?: { label: string; hint?: string; run: () => void }[] }) {
  const { s, d } = useStore();
  const [q, setQ] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); d({ type: "palette", open: !s.paletteOpen }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s.paletteOpen, d]);
  const hits = useMemo(() => search(q).slice(0, 6), [q]);
  const close = () => { d({ type: "palette", open: false }); setQ(""); };
  const run = (fn: () => void) => { fn(); close(); };
  if (!s.paletteOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/25 px-4 pt-[14vh] backdrop-blur-[2px]" onMouseDown={close}>
      <Command shouldFilter={false} loop onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === "Escape" && close()}
        className="pop-in w-full max-w-[560px] overflow-hidden rounded-xl border border-border bg-raised shadow-[var(--shadow)]">
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search size={15} className="text-muted" />
          <Command.Input autoFocus value={q} onValueChange={setQ} placeholder="Search courses, @professor, gened:DSHU, or type a command…" className="h-11 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-faint" />
          <Kbd>esc</Kbd>
        </div>
        <Command.List className="scroll-thin max-h-[360px] overflow-y-auto p-1.5">
          <Command.Empty className="px-3 py-6 text-center text-muted">No matches. Try a course code like CMSC351.</Command.Empty>
          {hits.length > 0 && (
            <Command.Group heading="Courses" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-muted">
              {hits.map((h) => (
                <Command.Item key={h.course.code} value={h.course.code} onSelect={() => run(() => d({ type: "select", course: h.course.code }))} className="flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2">
                  <Dot color={h.course.color} />
                  <span className="w-[68px] font-mono text-[12px] font-medium">{h.course.code}</span>
                  <span className="flex-1 truncate">{h.course.title}</span>
                  <span className="tnum font-mono text-[11px] text-faint">{h.sections.length} sec</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}
          <Command.Group heading="Actions" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-muted">
            {[
              { label: s.accessible ? "Use standard walking routes" : "Use step-free walking routes", icon: <Accessibility size={14} />, run: () => d({ type: "accessible" }) },
              ...s.schedules.filter((x) => x.id !== s.activeId).map((x) => ({ label: `Switch to ${x.name}`, icon: <ArrowRightLeft size={14} />, run: () => d({ type: "setActive", id: x.id }) })),
              { label: "Toggle theme", icon: <Moon size={14} />, run: cycleTheme },
              ...(extra ?? []).map((x) => ({ ...x, icon: <Plus size={14} /> })),
            ]
              .filter((a) => !q || a.label.toLowerCase().includes(q.toLowerCase()))
              .map((a) => (
                <Command.Item key={a.label} value={a.label} onSelect={() => run(a.run)} className="flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2 text-fg">
                  <span className="text-muted">{a.icon}</span>{a.label}
                </Command.Item>
              ))}
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}

export function cycleTheme() {
  const el = document.documentElement;
  const cur = el.dataset.theme;
  const dark = cur ? cur === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  el.dataset.theme = dark ? "light" : "dark";
}

// ---------- toast ----------
export function Toast() {
  const { s } = useStore();
  const [shown, setShown] = useState(s.toast);
  useEffect(() => {
    if (!s.toast) return;
    setShown(s.toast);
    const t = setTimeout(() => setShown(null), 2200);
    return () => clearTimeout(t);
  }, [s.toast]);
  if (!shown) return null;
  return (
    <div key={shown.id} className="pop-in fixed right-4 bottom-16 z-50 rounded-lg border border-border bg-raised px-3 py-2 text-[12.5px] shadow-[var(--shadow)]">{shown.text}</div>
  );
}

// ---------- campus map (mock; the real one is MapLibre + campus tiles) ----------
export function CampusMap({ items, day, className }: { items: Item[]; day: Day; className?: string }) {
  const { s } = useStore();
  const bs = Object.values(BUILDINGS);
  const lat0 = Math.min(...bs.map((b) => b.lat)), lat1 = Math.max(...bs.map((b) => b.lat));
  const lng0 = Math.min(...bs.map((b) => b.lng)), lng1 = Math.max(...bs.map((b) => b.lng));
  const W = 400, H = 300, pad = 28;
  const kx = Math.cos((38.987 * Math.PI) / 180);
  const sx = (W - pad * 2) / ((lng1 - lng0) * kx), sy = (H - pad * 2) / (lat1 - lat0);
  const k = Math.min(sx, sy);
  const px = (lng: number) => pad + (lng - lng0) * kx * k;
  const py = (lat: number) => H - pad - (lat - lat0) * k;
  const stops = items.filter((i) => i.day === day && i.bldg).sort((a, b) => a.start - b.start);
  const legs = walkLegs(items, { accessible: s.accessible, pace: s.pace }).filter((l) => l.day === day);
  const legFor = (a: Item, b: Item) => legs.find((l) => l.from.key === a.key && l.to.key === b.key);
  const totalFt = stops.slice(1).reduce((n, st, i) => {
    const a = BUILDINGS[stops[i].bldg!], b = BUILDINGS[st.bldg!];
    const dx = (b.lng - a.lng) * kx * 111320, dy = (b.lat - a.lat) * 110540;
    return n + Math.hypot(dx, dy) * 1.35 * 3.281;
  }, 0);
  return (
    <div className={clsx("relative", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
        <defs>
          <pattern id="mapgrid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="var(--grid)" /></pattern>
        </defs>
        <rect width={W} height={H} fill="url(#mapgrid)" />
        {/* McKeldin Mall, roughly */}
        <rect x={px(-76.9452)} y={py(38.9866)} width={px(-76.9405) - px(-76.9452)} height={py(38.9851) - py(38.9866)} rx={6} fill="color-mix(in oklab, var(--ok) 12%, transparent)" />
        {bs.map((b) => (
          <g key={b.code}>
            <circle cx={px(b.lng)} cy={py(b.lat)} r={2.5} fill="var(--faint)" />
            <text x={px(b.lng) + 4} y={py(b.lat) + 3} fontSize={8} fill="var(--faint)" fontFamily="Geist Mono, monospace">{b.code}</text>
          </g>
        ))}
        {stops.slice(1).map((st, i) => {
          const a = BUILDINGS[stops[i].bldg!], b = BUILDINGS[st.bldg!];
          const lg = legFor(stops[i], st);
          const col = lg?.status === "impossible" ? "var(--err)" : lg?.status === "tight" ? "var(--warn)" : "var(--fg)";
          return <line key={i} x1={px(a.lng)} y1={py(a.lat)} x2={px(b.lng)} y2={py(b.lat)} stroke={col} strokeWidth={lg && lg.status !== "ok" ? 2 : 1.25} strokeDasharray={lg ? undefined : "3 3"} opacity={0.85} />;
        })}
        {stops.map((st, i) => {
          const b = BUILDINGS[st.bldg!];
          const color = st.course ? `var(--c${st.course.color}-dot)` : "var(--muted)";
          return (
            <g key={st.key}>
              <circle cx={px(b.lng)} cy={py(b.lat)} r={8} fill={color} stroke="var(--bg)" strokeWidth={2} />
              <text x={px(b.lng)} y={py(b.lat) + 3} fontSize={9} textAnchor="middle" fill="var(--bg)" fontWeight={600} fontFamily="Geist Mono, monospace">{i + 1}</text>
            </g>
          );
        })}
      </svg>
      <div className="tnum absolute bottom-2 left-2 rounded-md border border-border bg-raised/90 px-2 py-1 font-mono text-[10.5px] text-muted backdrop-blur">
        {DAYS[day]} · {stops.length} stops · {(totalFt / 5280).toFixed(2)} mi{s.accessible && " · step-free"}
      </div>
    </div>
  );
}

export const useHotkey = (key: string, fn: (e: KeyboardEvent) => void, deps: unknown[] = []) => {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === key) ref.current(e);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ...deps]);
};
