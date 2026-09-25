// PROTOTYPE Variant A — "Workbench": Linear-style three panes. Rail + panel · calendar · inspector.
import clsx from "clsx";
import { CalendarDays, CircleAlert, Command as CmdIcon, Copy, Download, Image, Link2, Map, Search, Share2, ShoppingBag, Square } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { fmt, search } from "../core";
import { COURSES, DAYS, SECTION_BY_ID, TERM, type Day } from "../data";
import { useStore } from "../store";
import {
  Calendar, CampusMap, Chip, CourseDetail, Dot, Kbd, ProblemCounts, ProblemList, Rating, SeatPill, SectionHeader, useHotkey, useScheduleInfo,
} from "../ui";
import { profRating } from "../core";

type Tab = "search" | "cart" | "problems" | "map" | "blocks" | "export";

export function VariantA() {
  const { s, d, active } = useStore();
  const info = useScheduleInfo();
  const [tab, setTab] = useState<Tab>("search");
  useHotkey("/", (e) => { e.preventDefault(); setTab("search"); setTimeout(() => document.getElementById("a-search")?.focus()); });
  useHotkey("Escape", () => d({ type: "select", course: null }));

  const rail: { id: Tab; icon: ReactNode; label: string; badge?: number }[] = [
    { id: "search", icon: <Search size={16} />, label: "Search" },
    { id: "cart", icon: <ShoppingBag size={16} />, label: "Cart", badge: s.cart.length },
    { id: "problems", icon: <CircleAlert size={16} />, label: "Problems", badge: info.probs.filter((p) => p.severity !== "info").length },
    { id: "map", icon: <Map size={16} />, label: "Map" },
    { id: "blocks", icon: <Square size={16} />, label: "Blocks" },
    { id: "export", icon: <Share2 size={16} />, label: "Export" },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* top bar */}
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border px-3">
        <Logo />
        <span className="text-faint">/</span>
        <button className="rounded-md px-1.5 py-0.5 text-[12.5px] text-muted hover:bg-hover hover:text-fg">{TERM.name}</button>
        <span className="text-faint">/</span>
        <nav className="flex items-center gap-0.5">
          {s.schedules.map((x) => (
            <button key={x.id} onClick={() => d({ type: "setActive", id: x.id })}
              className={clsx("h-7 rounded-md px-2.5 text-[12.5px]", x.id === s.activeId ? "bg-hover font-medium text-fg" : "text-muted hover:text-fg")}>{x.name}</button>
          ))}
          <button className="h-7 rounded-md px-2 text-muted hover:bg-hover hover:text-fg" aria-label="New schedule">+</button>
        </nav>
        <div className="ml-auto hidden items-center gap-4 md:flex">
          <Stat label="Credits" value={info.credits} />
          <Stat label="Days" value={info.days} />
          <Stat label="First" value={info.earliest != null ? fmt(info.earliest) : "–"} />
          <Stat label="Walking" value={`${info.walkMin} min/wk`} />
          <ProblemCounts probs={info.probs} />
        </div>
        <button onClick={() => d({ type: "palette", open: true })} className="ml-auto flex h-7 items-center gap-2 rounded-md border border-border bg-raised px-2 text-[12px] text-muted hover:border-border-strong md:ml-2">
          <CmdIcon size={12} /> <span className="hidden sm:inline">Command</span> <Kbd>⌘K</Kbd>
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* rail */}
        <aside className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-panel py-2">
          {rail.map((r) => (
            <button key={r.id} onClick={() => setTab(r.id)} title={r.label}
              className={clsx("relative flex size-9 items-center justify-center rounded-md", tab === r.id ? "bg-raised text-fg shadow-sm ring-1 ring-border" : "text-muted hover:bg-hover hover:text-fg")}>
              {r.icon}
              {!!r.badge && <span className={clsx("tnum absolute -top-0.5 -right-0.5 min-w-[15px] rounded-full px-1 font-mono text-[9px] leading-[15px] text-accent-fg", r.id === "problems" ? "bg-err" : "bg-fg/70")}>{r.badge}</span>}
            </button>
          ))}
        </aside>

        {/* panel */}
        <aside className="hidden w-[300px] shrink-0 flex-col border-r border-border bg-panel lg:flex">
          {tab === "search" && <SearchPanel />}
          {tab === "cart" && <CartPanel />}
          {tab === "problems" && <Panel title="Problems" right={<ProblemCounts probs={info.probs} />}><ProblemList probs={info.probs} /></Panel>}
          {tab === "map" && <MapPanel />}
          {tab === "blocks" && <BlocksPanel />}
          {tab === "export" && <ExportPanel />}
        </aside>

        {/* calendar */}
        <main className="scroll-thin min-w-0 flex-1 overflow-auto">
          <Calendar sectionIds={active.sections} blocks={active.blocks} ghost={s.hover} swapCourse={s.selectedCourse} selectedCourse={s.selectedCourse}
            onItemClick={(i) => i.course && d({ type: "select", course: s.selectedCourse === i.course.code ? null : i.course.code })}
            onGhostClick={(id) => d({ type: "add", section: id })} className="pb-16" />
        </main>

        {/* inspector */}
        <aside className="scroll-thin hidden w-[380px] shrink-0 overflow-y-auto border-l border-border xl:block">
          {s.selectedCourse ? <CourseDetail code={s.selectedCourse} onClose={() => d({ type: "select", course: null })} /> : <Overview />}
        </aside>
      </div>
    </div>
  );
}

export const Logo = () => (
  <div className="flex items-center gap-2">
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <rect x="1" y="1" width="16" height="16" rx="4.5" fill="var(--accent)" />
      <rect x="5" y="4.5" width="3" height="5" rx="1" fill="var(--accent-fg)" />
      <rect x="10" y="7.5" width="3" height="6" rx="1" fill="var(--accent-fg)" opacity=".7" />
    </svg>
    <span className="text-[13.5px] font-semibold tracking-tight">terpsicle</span>
  </div>
);

const Stat = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="flex items-baseline gap-1.5 text-[12px]"><span className="text-muted">{label}</span><span className="tnum font-mono font-medium">{value}</span></div>
);

function Panel({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3 text-[12.5px] font-medium">{title}{right}</div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

function SearchPanel() {
  const { s, d } = useStore();
  const [q, setQ] = useState("");
  const hits = useMemo(() => search(q), [q]);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border p-2">
        <div className="flex h-8 items-center gap-2 rounded-md border border-border bg-raised px-2 focus-within:border-border-strong">
          <Search size={13} className="text-muted" />
          <input id="a-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search courses" className="flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-faint" />
          <Kbd>/</Kbd>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {["gened:DSHU", "@okafor", "open", "cmsc 3"].map((ex) => (
            <button key={ex} onClick={() => setQ(ex)} className="rounded border border-border px-1.5 font-mono text-[10.5px] text-muted hover:border-border-strong hover:text-fg">{ex}</button>
          ))}
        </div>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        {hits.map(({ course: c, sections }) => {
          const best = Math.max(...sections.map((x) => profRating(x) ?? 0));
          const open = sections.filter((x) => x.seats.open > 0).length;
          return (
            <button key={c.code} onClick={() => d({ type: "select", course: c.code })}
              className={clsx("block w-full border-b border-border px-3 py-2 text-left hover:bg-hover", s.selectedCourse === c.code && "bg-hover")}>
              <div className="flex items-center gap-2">
                <Dot color={c.color} />
                <span className="font-mono text-[12px] font-semibold">{c.code}</span>
                <span className="tnum font-mono text-[10.5px] text-faint">{c.credits}cr</span>
                <span className="ml-auto"><Rating value={best || null} /></span>
              </div>
              <div className="mt-0.5 truncate pl-4 text-[12px] text-muted">{c.title}</div>
              <div className="tnum mt-1 flex items-center gap-1.5 pl-4 font-mono text-[10.5px] text-faint">
                {open}/{sections.length} open · GPA {c.avgGpa.toFixed(2)}
                {c.geneds.map((g) => <span key={g} className="rounded border border-border px-1 text-muted">{g}</span>)}
              </div>
            </button>
          );
        })}
        {!hits.length && <div className="p-4 text-muted">No courses match “{q}”.</div>}
      </div>
    </div>
  );
}

function CartPanel() {
  const { s, d } = useStore();
  return (
    <Panel title="Cart" right={<span className="tnum font-mono text-[11px] text-muted">{s.cart.length} courses</span>}>
      <p className="px-3 pt-3 text-[12px] text-muted">Courses you're considering. Click one to see its sections as ghosts on the calendar, then click a ghost to place it.</p>
      <div className="mt-2">
        {s.cart.map((code) => (
          <button key={code} onClick={() => d({ type: "select", course: code })} className={clsx("flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-hover", s.selectedCourse === code && "bg-hover")}>
            <Dot color={COURSES[code].color} />
            <span className="font-mono text-[12px] font-semibold">{code}</span>
            <span className="flex-1 truncate text-[12px] text-muted">{COURSES[code].title}</span>
          </button>
        ))}
      </div>
    </Panel>
  );
}

function MapPanel() {
  const info = useScheduleInfo();
  const [day, setDay] = useState<Day>(0);
  const dayLegs = info.legs.filter((l) => l.day === day);
  return (
    <Panel title="Walking">
      <div className="flex gap-1 p-2">
        {DAYS.map((n, i) => (
          <button key={n} onClick={() => setDay(i as Day)} className={clsx("h-7 flex-1 rounded-md text-[11.5px]", day === i ? "bg-raised font-medium shadow-sm ring-1 ring-border" : "text-muted hover:bg-hover")}>{n}</button>
        ))}
      </div>
      <CampusMap items={info.items} day={day} className="mx-2 aspect-[4/3] overflow-hidden rounded-lg border border-border bg-bg" />
      <SectionHeader>Legs</SectionHeader>
      <ul className="px-3 pb-3">
        {dayLegs.map((l) => (
          <li key={l.from.key} className="flex items-center gap-2 py-1.5 text-[12px]">
            <span className={clsx("size-1.5 rounded-full", { ok: "bg-ok", tight: "bg-warn", impossible: "bg-err" }[l.status])} />
            <span className="font-mono">{l.from.bldg} → {l.to.bldg}</span>
            <span className="tnum ml-auto font-mono text-muted">{l.walk}/{l.gap} min</span>
          </li>
        ))}
        {!dayLegs.length && <li className="py-1.5 text-muted">No back-to-back walks this day.</li>}
      </ul>
    </Panel>
  );
}

function BlocksPanel() {
  const { d, active } = useStore();
  return (
    <Panel title="Blocks">
      <p className="px-3 pt-3 text-[12px] text-muted">Time you want kept free. Blocks with a place count in walking checks.</p>
      {active.blocks.map((b) => (
        <div key={b.id} className="mx-3 mt-2 flex items-center gap-2 rounded-md border border-border bg-raised p-2 text-[12px]">
          <span className="stripes size-4 rounded border border-border" />
          <div className="flex-1"><div className="font-medium">{b.label}</div><div className="tnum font-mono text-[10.5px] text-muted">{b.days.map((x) => DAYS[x]).join(", ")} {fmt(b.start)}–{fmt(b.end)}</div></div>
          <button onClick={() => d({ type: "removeBlock", id: b.id })} className="text-[11px] text-muted hover:text-fg">Remove</button>
        </div>
      ))}
      <button className="mx-3 mt-2 h-8 w-[calc(100%-24px)] rounded-md border border-dashed border-border text-[12px] text-muted hover:border-border-strong hover:text-fg">+ Drag on the calendar to add a block</button>
    </Panel>
  );
}

function ExportPanel() {
  const { d, active } = useStore();
  const codes = active.sections.map((id) => id.replace("-", " ")).join("\n");
  const rows: { icon: ReactNode; label: string; hint: string; run: () => void }[] = [
    { icon: <Copy size={14} />, label: "Copy section codes", hint: "In registration order", run: () => { navigator.clipboard?.writeText(codes).catch(() => {}); d({ type: "toast", text: "Copied 5 section codes" }); } },
    { icon: <Link2 size={14} />, label: "Copy share link", hint: "Schedule lives in the URL", run: () => d({ type: "toast", text: "Link copied (prototype)" }) },
    { icon: <CalendarDays size={14} />, label: "Add to calendar (.ics)", hint: "Skips breaks, includes finals", run: () => d({ type: "toast", text: "Would download terpsicle-spring-2027.ics" }) },
    { icon: <Image size={14} />, label: "Save as image", hint: "For the group chat", run: () => d({ type: "toast", text: "Would save a PNG" }) },
    { icon: <Download size={14} />, label: "Subscribe (webcal)", hint: "Room changes sync automatically", run: () => d({ type: "toast", text: "Needs an account (later)" }) },
  ];
  return (
    <Panel title="Export">
      <div className="p-2">
        {rows.map((r) => (
          <button key={r.label} onClick={r.run} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-hover">
            <span className="text-muted">{r.icon}</span>
            <span className="flex-1"><span className="block text-[12.5px]">{r.label}</span><span className="block text-[11px] text-muted">{r.hint}</span></span>
          </button>
        ))}
      </div>
      <SectionHeader>Codes</SectionHeader>
      <pre className="mx-3 rounded-md border border-border bg-raised p-2 font-mono text-[11.5px] leading-relaxed">{codes}</pre>
    </Panel>
  );
}

function Overview() {
  const { d, active } = useStore();
  const info = useScheduleInfo();
  return (
    <div>
      <div className="px-4 pt-4">
        <div className="text-[11px] font-medium tracking-wide text-muted uppercase">{active.name} · {TERM.name}</div>
        <div className="tnum mt-2 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border">
          {[["Credits", info.credits], ["Days", info.days], ["Walk / wk", `${info.walkMin}m`]].map(([k, v]) => (
            <div key={k} className="bg-raised px-3 py-2"><div className="text-[11px] text-muted">{k}</div><div className="font-mono text-[15px] font-medium">{v}</div></div>
          ))}
        </div>
      </div>
      <SectionHeader>Courses</SectionHeader>
      <div className="divide-y divide-border border-y border-border">
        {active.sections.map((id) => {
          const sec = SECTION_BY_ID[id];
          const c = COURSES[sec.course];
          return (
            <button key={id} onClick={() => d({ type: "select", course: c.code })} className="grid w-full grid-cols-[1fr_auto] gap-x-2 px-4 py-2 text-left hover:bg-hover">
              <span className="flex items-center gap-2"><Dot color={c.color} /><span className="font-mono text-[12px] font-semibold">{c.code}</span><span className="font-mono text-[11px] text-muted">{sec.code}</span></span>
              <SeatPill s={sec} />
              <span className="truncate pl-4 text-[11.5px] text-muted">{sec.profs.join(", ")}</span>
              <Rating value={profRating(sec)} />
            </button>
          );
        })}
      </div>
      <SectionHeader>Problems</SectionHeader>
      <div className="border-y border-border"><ProblemList probs={info.probs} dense /></div>
      <p className="px-4 py-3 text-[11px] text-faint">Click any class to see its other sections as ghosts. <Chip className="!h-5 !text-[10.5px]">Esc</Chip> clears.</p>
    </div>
  );
}
