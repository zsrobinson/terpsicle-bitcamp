// PROTOTYPE: four structurally different app shells for Terpsicle v2, switchable via
// #A..#D (or ?variant=A) and the floating bar at the bottom. Mock data, in-memory state.
import { ChevronLeft, ChevronRight, Moon } from "lucide-react";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { StoreProvider } from "./store";
import "./styles.css";
import { CommandPalette, Toast, cycleTheme } from "./ui";
import { VariantA } from "./variants/A";
import { VariantB } from "./variants/B";
import { VariantC } from "./variants/C";
import { VariantD } from "./variants/D";

const VARIANTS = [
  { key: "A", name: "Workbench", blurb: "Three panes: tools, calendar, inspector", C: VariantA },
  { key: "B", name: "Canvas", blurb: "The calendar is the app; everything floats", C: VariantB },
  { key: "C", name: "Catalog", blurb: "Browse first; every section says if it fits", C: VariantC },
  { key: "D", name: "Generate", blurb: "Describe your week, flip through schedules", C: VariantD },
] as const;

const initial = () => {
  const fromHash = location.hash.slice(1).toUpperCase();
  const fromQuery = new URLSearchParams(location.search).get("variant")?.toUpperCase();
  const k = fromHash || fromQuery || "A";
  return Math.max(0, VARIANTS.findIndex((v) => v.key === k));
};

function App() {
  const [i, setI] = useState(initial);
  const v = VARIANTS[i];
  const go = (n: number) => {
    const next = (n + VARIANTS.length) % VARIANTS.length;
    setI(next);
    history.replaceState(null, "", "#" + VARIANTS[next].key);
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable]") || e.metaKey || e.ctrlKey) return;
      if (e.key === "ArrowLeft") go(i - 1);
      if (e.key === "ArrowRight") go(i + 1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  return (
    <StoreProvider>
      <div className="h-full"><v.C key={v.key} /></div>
      <CommandPalette extra={VARIANTS.map((x, n) => ({ label: `Show variant ${x.key}: ${x.name}`, run: () => go(n) }))} />
      <Toast />
      {/* prototype switcher: deliberately not part of the design */}
      <div className="fixed bottom-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-[#111] p-1 text-white shadow-[0_8px_30px_rgba(0,0,0,.35)] ring-1 ring-white/10" style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <button onClick={() => go(i - 1)} className="flex size-8 items-center justify-center rounded-full hover:bg-white/10" aria-label="Previous variant"><ChevronLeft size={16} /></button>
        <div className="min-w-[200px] px-2 text-center leading-tight max-sm:min-w-[120px]">
          <div className="text-[12.5px] font-medium"><span className="font-mono text-white/50">{v.key}</span> · {v.name}</div>
          <div className="text-[10.5px] text-white/55 max-sm:hidden">{v.blurb}</div>
        </div>
        <button onClick={() => go(i + 1)} className="flex size-8 items-center justify-center rounded-full hover:bg-white/10" aria-label="Next variant"><ChevronRight size={16} /></button>
        <span className="mx-1 h-5 w-px bg-white/15" />
        <button onClick={cycleTheme} className="flex size-8 items-center justify-center rounded-full hover:bg-white/10" aria-label="Toggle theme"><Moon size={14} /></button>
        <span className="pr-3 pl-1 font-mono text-[10px] text-white/45 max-md:hidden">prototype · mock data</span>
      </div>
    </StoreProvider>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
