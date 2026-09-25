// PROTOTYPE logic. Pure functions, no DOM: the shape we'd lift into packages/core.
import {
  BUILDINGS, COURSES, PROFS, SECTIONS, SECTION_BY_ID, sectionsOf,
  type Block, type Course, type Day, type Meeting, type Section,
} from "./data";

// ---------- time ----------
export const fmt = (m: number) => {
  const h = Math.floor(m / 60), mm = m % 60;
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}${mm ? ":" + String(mm).padStart(2, "0") : ""}${h < 12 ? "am" : "pm"}`;
};
export const fmtRange = (a: number, b: number) => `${fmt(a)}–${fmt(b)}`;
export const daysLabel = (days: Day[]) => days.map((d) => ["M", "Tu", "W", "Th", "F"][d]).join("");

// ---------- walking ----------
// Real version: precomputed matrix from UMD's GIS routing network. Here: haversine × detour factor.
export const PACE_FT_PER_MIN = 287;
export function walkFeet(a?: string, b?: string, accessible = false): number | null {
  if (!a || !b) return null;
  if (a === b) return 0;
  const A = BUILDINGS[a], B = BUILDINGS[b];
  if (!A || !B) return null;
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (B.lat - A.lat) * toR, dLng = (B.lng - A.lng) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(A.lat * toR) * Math.cos(B.lat * toR) * Math.sin(dLng / 2) ** 2;
  const meters = 2 * R * Math.asin(Math.sqrt(h)) * (accessible ? 1.55 : 1.35);
  return Math.round(meters * 3.281);
}
export const walkMinutes = (ft: number, paceMult = 1) => Math.max(1, Math.round(ft / (PACE_FT_PER_MIN * paceMult)));

// ---------- schedule items ----------
export type Item = {
  key: string;
  kind: "section" | "block";
  sectionId?: string;
  course?: Course;
  section?: Section;
  block?: Block;
  meeting?: Meeting;
  day: Day;
  start: number;
  end: number;
  bldg?: string;
  room?: string;
  label: string;
};

export function itemsFor(sectionIds: string[], blocks: Block[] = []): Item[] {
  const out: Item[] = [];
  for (const id of sectionIds) {
    const s = SECTION_BY_ID[id];
    if (!s) continue;
    s.meetings.forEach((m, mi) =>
      m.days.forEach((d) =>
        out.push({ key: `${id}:${mi}:${d}`, kind: "section", sectionId: id, section: s, course: COURSES[s.course], meeting: m, day: d, start: m.start, end: m.end, bldg: m.bldg, room: m.room, label: s.course }),
      ),
    );
  }
  for (const b of blocks)
    b.days.forEach((d) => out.push({ key: `${b.id}:${d}`, kind: "block", block: b, day: d, start: b.start, end: b.end, bldg: b.bldg, label: b.label }));
  return out;
}

const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) => a.start < b.end && b.start < a.end;

/** Column layout for overlapping items in one day. */
export function layoutDay(items: Item[]) {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const placed: { item: Item; col: number; cols: number }[] = [];
  let cluster: typeof placed = [];
  let clusterEnd = -1;
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((p) => p.col + 1));
    cluster.forEach((p) => (p.cols = cols));
    cluster = [];
  };
  for (const item of sorted) {
    if (item.start >= clusterEnd) { flush(); clusterEnd = -1; }
    const used = new Set(cluster.filter((p) => overlaps(p.item, item)).map((p) => p.col));
    let col = 0;
    while (used.has(col)) col++;
    const p = { item, col, cols: 1 };
    cluster.push(p); placed.push(p);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flush();
  return placed;
}

// ---------- walking legs ----------
export type Leg = {
  day: Day; from: Item; to: Item; gap: number; feet: number; walk: number;
  status: "ok" | "tight" | "impossible";
};
export function walkLegs(items: Item[], opts: { accessible?: boolean; pace?: number } = {}): Leg[] {
  const legs: Leg[] = [];
  for (let d = 0 as Day; d < 5; d = (d + 1) as Day) {
    const day = items.filter((i) => i.day === d && i.bldg).sort((a, b) => a.start - b.start);
    for (let i = 0; i + 1 < day.length; i++) {
      const a = day[i], b = day[i + 1];
      const gap = b.start - a.end;
      if (gap < 0 || gap > 45) continue;
      const feet = walkFeet(a.bldg, b.bldg, opts.accessible);
      if (feet == null || feet === 0) continue;
      const walk = walkMinutes(feet, opts.pace ?? 1);
      const status = walk > gap ? "impossible" : walk >= gap * 0.7 ? "tight" : "ok";
      legs.push({ day: d, from: a, to: b, gap, feet, walk, status });
    }
  }
  return legs;
}

// ---------- problems (the linter) ----------
export type Problem = {
  id: string;
  severity: "error" | "warning" | "info";
  title: string;
  detail: string;
  sectionId?: string;
  fix?: { label: string; swapTo?: string };
};

const DN = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export function problems(sectionIds: string[], blocks: Block[], opts: { accessible?: boolean; pace?: number } = {}): Problem[] {
  const out: Problem[] = [];
  const items = itemsFor(sectionIds, blocks);
  // overlaps
  const seen = new Set<string>();
  for (const a of items)
    for (const b of items) {
      if (a.key >= b.key || a.day !== b.day || !overlaps(a, b)) continue;
      const k = [a.label, b.label].sort().join("|");
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ id: "ov" + k, severity: "error", title: `${a.label} overlaps ${b.label}`, detail: `${DN[a.day]} ${fmtRange(Math.max(a.start, b.start), Math.min(a.end, b.end))}`, sectionId: a.sectionId ?? b.sectionId, fix: bestSwap(sectionIds, blocks, (a.sectionId ?? b.sectionId)!, opts) });
    }
  // walks, grouped by from/to pair
  const legs = walkLegs(items, opts).filter((l) => l.status !== "ok");
  const byPair = new Map<string, Leg[]>();
  for (const l of legs) {
    const k = `${l.from.label}→${l.to.label}`;
    byPair.set(k, [...(byPair.get(k) ?? []), l]);
  }
  for (const [k, ls] of byPair) {
    const l = ls[0];
    const sid = l.to.sectionId ?? l.from.sectionId;
    out.push({
      id: "walk" + k,
      severity: l.status === "impossible" ? "error" : "warning",
      title: l.status === "impossible" ? `Can't make it from ${l.from.label} to ${l.to.label}` : `Tight walk: ${l.from.label} to ${l.to.label}`,
      detail: `${l.from.bldg} → ${l.to.bldg} · ${l.walk} min walk, ${l.gap} min gap · ${ls.map((x) => DN[x.day]).join(", ")}`,
      sectionId: sid,
      fix: sid ? bestSwap(sectionIds, blocks, sid, opts) : undefined,
    });
  }
  // seats, notes, delivery
  for (const id of sectionIds) {
    const s = SECTION_BY_ID[id];
    if (!s) continue;
    if (s.seats.open === 0)
      out.push({ id: "full" + id, severity: "warning", title: `${id} is full`, detail: `Waitlist ${s.seats.wait}${s.seats.hold ? ` · Holdfile ${s.seats.hold}` : ""}`, sectionId: id, fix: bestSwap(sectionIds, blocks, id, opts) });
    else if (s.seats.open <= 3)
      out.push({ id: "low" + id, severity: "warning", title: `${id}: ${s.seats.open} seat${s.seats.open === 1 ? "" : "s"} left`, detail: `Filled ${Math.round(100 - (100 * s.seats.open) / s.seats.total)}% · usually fills in the first days of registration`, sectionId: id });
    if (s.note && /restricted/i.test(s.note))
      out.push({ id: "res" + id, severity: "warning", title: `${id} is restricted`, detail: s.note, sectionId: id });
    if (s.delivery === "online-async")
      out.push({ id: "async" + id, severity: "info", title: `${id} is online, asynchronous`, detail: "No meeting times. Work happens on ELMS.", sectionId: id });
  }
  // exams
  const exams = new Map<string, string[]>();
  for (const id of sectionIds) {
    const c = COURSES[SECTION_BY_ID[id]?.course];
    if (c?.exam) exams.set(c.exam, [...(exams.get(c.exam) ?? []), c.code]);
  }
  for (const [slot, cs] of exams)
    if (cs.length > 1) out.push({ id: "exam" + slot, severity: "error", title: `Final exam clash: ${cs.join(" & ")}`, detail: `Both common exams are ${slot}. The registrar schedules a make-up for one.` });
  // credits
  const cr = credits(sectionIds);
  if (cr > 18) out.push({ id: "cr", severity: "warning", title: `${cr} credits`, detail: "Above the usual registration limit." });
  const order = { error: 0, warning: 1, info: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

export const credits = (ids: string[]) => ids.reduce((n, id) => n + (COURSES[SECTION_BY_ID[id]?.course]?.credits ?? 0), 0);

/** Try every other section of the same course; return the first that removes the problem count. */
function bestSwap(ids: string[], blocks: Block[], sid: string, opts: { accessible?: boolean; pace?: number }) {
  const s = SECTION_BY_ID[sid];
  if (!s) return undefined;
  const base = hardCount(ids, blocks, opts);
  let best: { id: string; n: number } | null = null;
  for (const alt of sectionsOf(s.course)) {
    if (alt.id === sid || alt.seats.open === 0) continue;
    const n = hardCount(ids.map((x) => (x === sid ? alt.id : x)), blocks, opts);
    if (n < base && (!best || n < best.n)) best = { id: alt.id, n };
  }
  return best ? { label: `Swap to ${best.id.split("-")[1]}`, swapTo: best.id } : undefined;
}
function hardCount(ids: string[], blocks: Block[], opts: { accessible?: boolean; pace?: number }) {
  const items = itemsFor(ids, blocks);
  let n = 0;
  for (const a of items) for (const b of items) if (a.key < b.key && a.day === b.day && overlaps(a, b)) n += 2;
  n += walkLegs(items, opts).reduce((k, l) => k + (l.status === "impossible" ? 2 : l.status === "tight" ? 1 : 0), 0);
  return n;
}

export function conflictsWith(sectionIds: string[], blocks: Block[], candidate: string): boolean {
  const s = SECTION_BY_ID[candidate];
  const others = itemsFor(sectionIds.filter((id) => SECTION_BY_ID[id]?.course !== s?.course), blocks);
  return itemsFor([candidate]).some((c) => others.some((o) => o.day === c.day && overlaps(o, c)));
}

// ---------- search ----------
export type SearchHit = { course: Course; sections: Section[]; score: number };
export function search(q: string): SearchHit[] {
  const tokens = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const gened = tokens.filter((t) => t.startsWith("gened:")).map((t) => t.slice(6).toUpperCase());
  const prof = tokens.filter((t) => t.startsWith("@")).map((t) => t.slice(1));
  const openOnly = tokens.includes("open");
  const words = tokens.filter((t) => !t.startsWith("gened:") && !t.startsWith("@") && t !== "open");
  const out: SearchHit[] = [];
  for (const c of Object.values(COURSES)) {
    let secs = sectionsOf(c.code);
    if (openOnly) secs = secs.filter((s) => s.seats.open > 0);
    if (prof.length) secs = secs.filter((s) => s.profs.some((p) => prof.every((w) => p.toLowerCase().includes(w))));
    if (!secs.length) continue;
    if (gened.length && !gened.every((g) => c.geneds.includes(g))) continue;
    const hay = `${c.code} ${c.code.slice(0, 4)} ${c.code.slice(4)} ${c.title} ${c.geneds.join(" ")}`.toLowerCase();
    let score = 0;
    for (const w of words) {
      if (c.code.toLowerCase().startsWith(w)) score += 3;
      else if (hay.includes(w)) score += 1;
      else if (fuzzy(w, hay)) score += 0.5;
      else { score = -1; break; }
    }
    if (score >= 0) out.push({ course: c, sections: secs, score });
  }
  return out.sort((a, b) => b.score - a.score || a.course.code.localeCompare(b.course.code));
}
const fuzzy = (w: string, hay: string) => {
  let i = 0;
  for (const ch of hay) if (ch === w[i]) i++;
  return i === w.length && w.length > 2;
};

export const profRating = (s: Section) => {
  const rs = s.profs.map((p) => PROFS[p]?.rating).filter(Boolean) as number[];
  return rs.length ? rs.reduce((a, b) => a + b) / rs.length : null;
};

// ---------- generator ----------
export type Constraints = {
  noBefore?: number; // minutes
  noAfter?: number;
  daysOff: Day[];
  openOnly: boolean;
  noImpossibleWalks: boolean;
};
export type Preset = "compact" | "late" | "profs" | "walking" | "seats";
export const PRESETS: Record<Preset, string> = {
  compact: "Compact days",
  late: "Late starts",
  profs: "Best professors",
  walking: "Least walking",
  seats: "Safest seats",
};
export type Result = { sections: string[]; score: number; stats: { days: number; span: number; walk: number; minOpen: number; rating: number; earliest: number } };

export function generate(required: string[], optional: string[], blocks: Block[], c: Constraints, preset: Preset, limit = 40): { results: Result[]; explored: number; hints: string[] } {
  const courses = [...required, ...optional];
  const cands = courses.map((code) =>
    sectionsOf(code).filter((s) => {
      if (c.openOnly && s.seats.open === 0) return false;
      return s.meetings.every((m) => (c.noBefore == null || m.start >= c.noBefore) && (c.noAfter == null || m.end <= c.noAfter) && !m.days.some((d) => c.daysOff.includes(d)));
    }),
  );
  const results: Result[] = [];
  let explored = 0;
  const pick: string[] = [];
  const rec = (i: number) => {
    explored++;
    if (i === courses.length) {
      if (!pick.length) return;
      const items = itemsFor(pick, blocks);
      const legs = walkLegs(items);
      if (c.noImpossibleWalks && legs.some((l) => l.status === "impossible")) return;
      results.push(scoreOf([...pick], items, legs, preset));
      return;
    }
    const isOptional = i >= required.length;
    for (const s of cands[i]) {
      if (conflictsWith(pick, blocks, s.id)) continue;
      pick.push(s.id); rec(i + 1); pick.pop();
    }
    if (isOptional) rec(i + 1);
  };
  rec(0);
  results.sort((a, b) => b.sections.length - a.sections.length || b.score - a.score);
  const hints: string[] = [];
  if (!results.length) {
    if (c.noBefore != null) hints.push("Allow earlier classes");
    if (c.daysOff.length) hints.push("Drop a day off");
    if (c.openOnly) hints.push("Include full sections");
    if (c.noImpossibleWalks) hints.push("Allow tight walks");
  }
  return { results: results.slice(0, limit), explored, hints };
}

function scoreOf(ids: string[], items: Item[], legs: Leg[], preset: Preset): Result {
  const days = new Set(items.map((i) => i.day)).size;
  let span = 0;
  for (let d = 0; d < 5; d++) {
    const di = items.filter((i) => i.day === d);
    if (di.length) span += Math.max(...di.map((i) => i.end)) - Math.min(...di.map((i) => i.start));
  }
  const walk = legs.reduce((n, l) => n + l.walk, 0);
  const secs = ids.map((id) => SECTION_BY_ID[id]);
  const minOpen = Math.min(...secs.map((s) => s.seats.open));
  const rs = secs.map(profRating).filter((x): x is number => x != null);
  const rating = rs.length ? rs.reduce((a, b) => a + b) / rs.length : 0;
  const earliest = Math.min(...items.filter((i) => i.kind === "section").map((i) => i.start), 24 * 60);
  const score = {
    compact: -span - days * 60,
    late: earliest,
    profs: rating * 100,
    walking: -walk,
    seats: minOpen,
  }[preset];
  return { sections: ids, score, stats: { days, span, walk, minOpen, rating, earliest } };
}

// ---------- "natural language" (mocked: regex, the real one is an LLM → same chips) ----------
export function parseConstraints(text: string): Partial<Constraints> & { chips: string[] } {
  const t = text.toLowerCase();
  const out: Partial<Constraints> & { chips: string[] } = { chips: [] };
  const before = t.match(/(?:no|nothing)\s+(?:classes\s+)?before\s+(\d{1,2})(?::(\d\d))?\s*(am|pm)?/);
  if (before) {
    let h = +before[1];
    if (before[3] === "pm" && h < 12) h += 12;
    out.noBefore = h * 60 + (before[2] ? +before[2] : 0);
    out.chips.push(`Start after ${fmt(out.noBefore)}`);
  }
  const after = t.match(/(?:no|nothing)\s+(?:classes\s+)?after\s+(\d{1,2})(?::(\d\d))?\s*(am|pm)?/);
  if (after) {
    let h = +after[1];
    if (after[3] !== "am" && h < 12) h += 12;
    out.noAfter = h * 60 + (after[2] ? +after[2] : 0);
    out.chips.push(`End by ${fmt(out.noAfter)}`);
  }
  const dayNames: [RegExp, Day][] = [[/mondays?/, 0], [/tuesdays?/, 1], [/wednesdays?/, 2], [/thursdays?/, 3], [/fridays?/, 4]];
  const off: Day[] = [];
  for (const [re, d] of dayNames) if (new RegExp(re.source + "\\s+(off|free)|(no|free)\\s+" + re.source).test(t)) off.push(d);
  if (off.length) { out.daysOff = off; out.chips.push(`${off.map((d) => DN[d]).join(", ")} off`); }
  if (/open|not full|available/.test(t)) { out.openOnly = true; out.chips.push("Open seats only"); }
  if (/walk|rush|sprint/.test(t)) { out.noImpossibleWalks = true; out.chips.push("No impossible walks"); }
  return out;
}

export { SECTIONS };
