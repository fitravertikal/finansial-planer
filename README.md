# Finansial Planer

Personal financial planner — a **local-first** web app for tracking detailed
expenses and monthly budgets, in IDR. Data stays in your browser; no server,
no login.

See [`docs/PLAN.md`](docs/PLAN.md) for the full v1 plan (scope, finance domain
model, architecture, milestones).

## Status

**M1 — skeleton & data layer** (this scaffold):

- Vite + React + TypeScript + Tailwind, static build.
- Domain layer (`src/domain/`): Zod schemas, IDR money helpers, date/month
  helpers, and pure budget logic — all framework- and storage-free.
- Data layer (`src/data/`): Dexie/IndexedDB with a repository interface (the
  seam for future sync), default-category seeding, and JSON export/import.
- Tests (`*.test.ts`) cover the budget math (incl. the July-2026 worked
  example from the plan), money/date helpers, and backup round-trip.

Next: M2 transaction tracking → M3 budgeting → M4 dashboard.

## Develop

```bash
npm install
npm run dev        # start the dev server
npm run test       # watch-mode tests
npm run test:run   # single test run
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run build      # typecheck + static production build
```

## Architecture notes

- **Money is integer rupiah**, never floats — no rounding drift.
- **All budget math is pure** (`src/domain/budget.ts`) so it's testable and
  reusable; the dashboard derives every number on read (no stored aggregates).
- **Repository layer** (`src/data/repositories/`) keeps the UI independent of
  IndexedDB, so cloud sync can be added later without a rewrite.
- **Zod schemas** are the single source of both TypeScript types and runtime
  validation (forms *and* import).
