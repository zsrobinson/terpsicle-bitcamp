// PROTOTYPE state: in-memory only, shared by every variant so switching keeps your schedule.
import { createContext, useContext, useReducer, type ReactNode } from "react";
import { DEFAULT_CART, DEFAULT_SCHEDULE, SECTION_BY_ID, type Block } from "./data";

export type Schedule = { id: string; name: string; sections: string[]; blocks: Block[] };

export type State = {
  schedules: Schedule[];
  activeId: string;
  cart: string[];
  selectedCourse: string | null;
  hover: string | null;
  accessible: boolean;
  pace: number;
  paletteOpen: boolean;
  toast: { id: number; text: string } | null;
};

export type Action =
  | { type: "add"; section: string }
  | { type: "remove"; course: string }
  | { type: "select"; course: string | null }
  | { type: "hover"; section: string | null }
  | { type: "setActive"; id: string }
  | { type: "cart"; course: string; on: boolean }
  | { type: "accessible" }
  | { type: "pace"; pace: number }
  | { type: "palette"; open: boolean }
  | { type: "apply"; sections: string[]; name?: string }
  | { type: "removeBlock"; id: string }
  | { type: "toast"; text: string };

const init: State = {
  schedules: [
    { id: "a", name: "Plan A", ...DEFAULT_SCHEDULE },
    { id: "b", name: "Plan B", sections: ["CMSC351-0301", "CMSC330-0201", "STAT400-0101", "ENGL393-0404", "ECON200-0101"], blocks: DEFAULT_SCHEDULE.blocks },
  ],
  activeId: "a",
  cart: DEFAULT_CART,
  selectedCourse: null,
  hover: null,
  accessible: false,
  pace: 1,
  paletteOpen: false,
  toast: null,
};

let toastId = 0;
function reducer(s: State, a: Action): State {
  const active = s.schedules.find((x) => x.id === s.activeId)!;
  const patch = (fn: (sch: Schedule) => Schedule) => ({ ...s, schedules: s.schedules.map((x) => (x.id === s.activeId ? fn(x) : x)) });
  const toast = (text: string) => ({ id: ++toastId, text });
  switch (a.type) {
    case "add": {
      const course = SECTION_BY_ID[a.section].course;
      const had = active.sections.find((id) => SECTION_BY_ID[id].course === course);
      const next = patch((x) => ({ ...x, sections: [...x.sections.filter((id) => SECTION_BY_ID[id].course !== course), a.section] }));
      return { ...next, hover: null, cart: s.cart.filter((c) => c !== course), toast: toast(had ? `Swapped ${course} to ${a.section.split("-")[1]}` : `Added ${a.section}`) };
    }
    case "remove":
      return { ...patch((x) => ({ ...x, sections: x.sections.filter((id) => SECTION_BY_ID[id].course !== a.course) })), selectedCourse: null, cart: s.cart.includes(a.course) ? s.cart : [...s.cart, a.course], toast: toast(`Moved ${a.course} back to your cart`) };
    case "removeBlock":
      return patch((x) => ({ ...x, blocks: x.blocks.filter((b) => b.id !== a.id) }));
    case "select":
      return { ...s, selectedCourse: a.course };
    case "hover":
      return s.hover === a.section ? s : { ...s, hover: a.section };
    case "setActive":
      return { ...s, activeId: a.id, selectedCourse: null };
    case "cart":
      return { ...s, cart: a.on ? [...new Set([...s.cart, a.course])] : s.cart.filter((c) => c !== a.course), toast: a.on ? toast(`${a.course} added to cart`) : s.toast };
    case "accessible":
      return { ...s, accessible: !s.accessible, toast: toast(!s.accessible ? "Using step-free routes" : "Using standard routes") };
    case "pace":
      return { ...s, pace: a.pace };
    case "palette":
      return { ...s, paletteOpen: a.open };
    case "apply":
      return { ...patch((x) => ({ ...x, sections: a.sections })), toast: toast(`Applied to ${active.name}`) };
    case "toast":
      return { ...s, toast: toast(a.text) };
  }
}

const Ctx = createContext<{ s: State; d: (a: Action) => void; active: Schedule } | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, d] = useReducer(reducer, init);
  const active = s.schedules.find((x) => x.id === s.activeId)!;
  return <Ctx.Provider value={{ s, d, active }}>{children}</Ctx.Provider>;
}
export const useStore = () => useContext(Ctx)!;
