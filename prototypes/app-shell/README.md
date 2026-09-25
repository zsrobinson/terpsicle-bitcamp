# Prototype: app shell (throwaway)

## Round 3: final design review

`review.html` is a review page: one open question per screen, each option previewed live in the
Drill-in app (round 2, variant 1) with only that one design field changed (`src/review/design.ts`).
Answers are saved to the artifact's database (collection `answers`, one doc per question).

```sh
npm run dev:review     # opens /review.html
npm run build:review   # dist-review/review.html + dist-review/artifact.html
```


## Round 2 (current)

**Question:** in the Workbench layout, *where should details open* so people always know where to look?

Everything is shared except that one decision:

| # | Name | Details open… |
|---|---|---|
| 1 | Drill in | inside the left sidebar, replacing the list, with a Back button (only a left sidebar) |
| 2 | Side by side | in a second column next to the list you came from |
| 3 | On the right | in a right panel that exists only while you're looking at something |
| 4 | Pop over | in a card floating next to whatever you clicked |

Shared, based on round-1 feedback:
- plans in the top bar (rename, duplicate, delete, undo);
- labeled tabs (Plan, Search, Problems, Travel, Blocks, Export);
- travel time instead of walking, with pace, step-free and buffer settings and the math shown;
- every section says whether it fits;
- simpler seats and grades;
- tooltips that reveal shortcuts;
- no command palette and no natural-language input.

Round 1 (four whole-app layouts: Workbench, Canvas, Catalog, Generate) is in commit `77d0e9c`. Workbench won.

```sh
npm install
npm run dev        # http://localhost:5173/#1  (or ?variant=3)
npm run build      # dist/index.html (single file) + dist/artifact.html
```

Switch variants with the floating bar or ←/→.

Everything here is mock data. Course codes, gen-eds and buildings are real UMD ones; instructors, ratings, reviews, seats and grades are made up. Travel time uses straight-line distance × 1.35 in place of the UMD GIS matrix.

`src/core.ts` is the pure logic (connections, problems, fit, search) that would move into `packages/core`. The rest is throwaway.
