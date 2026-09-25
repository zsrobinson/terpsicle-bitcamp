# Prototype: app shell (throwaway)

**Question:** what should Terpsicle v2 feel like to use, and which layout makes it work?

Four structurally different variants share one mock UMD dataset and in-memory state:

| Key | Name | Idea |
|---|---|---|
| A | Workbench | Linear-style three panes: tool rail + panel, calendar, inspector |
| B | Canvas | The calendar is the whole app; search, cart, problems and map float over it |
| C | Catalog | Browse first; every section says whether it fits your week (time *and* walking) |
| D | Generate | Describe the week you want, then flip through ranked schedules with j/k |

```sh
npm install
npm run dev        # open http://localhost:5173/#A  (or ?variant=B)
npm run build      # dist/index.html (single file) + dist/artifact.html
```

Switch variants with the floating bar or ←/→. ⌘K opens the command palette everywhere.

Everything here is mock data. Course codes, gen-eds and buildings are real UMD ones; instructors, ratings, reviews, seats and grades are made up. Walking uses straight-line distance × 1.35 in place of the UMD GIS walking matrix.

`src/core.ts` holds the pure logic (walk legs, problems, search, generator) that would move into `packages/core`. The rest is throwaway.
