# Safety & Reliability Fixes — Design

**Status:** Approved for planning
**Author:** Claude Code (with Fitra)
**Date:** 2026-07-10

## Context

An audit of the current app (post-M4, in daily production use at
`financial.epslab.id`) surfaced several rough edges around data safety and
honesty of the UI. This is the first of four planned improvement batches
(safety/reliability → auto-sync & recurring automation → PWA → new analytics
features), sequenced by risk/effort. This spec covers only the first batch.

Three issues, in one batch because each is small and none depends on the
others:

1. Deleting a transaction has no confirmation — one misclick permanently
   loses a record. Category archive and recurring-rule delete already guard
   with `window.confirm`; transaction delete doesn't, which is an
   inconsistency as well as a risk.
2. `DashboardScreen` queries default to `[]` on both loading and error, so a
   failed query (e.g. a Dexie error) renders identically to "no transactions
   yet" — the user has no way to know the dashboard is lying to them.
3. `Budget.rollover` is a schema field with no UI and no consuming logic —
   dead weight that should become a real feature: unspent (or overspent)
   budget carries forward into the next month, per category, opt-in.

## 1. Confirm transaction delete

**File:** `src/features/transactions/TransactionsScreen.tsx`

Wrap the existing delete handler in `window.confirm('Hapus transaksi ini?')`,
matching the exact pattern already used for category archive and recurring
rule delete in this codebase. No new component, no new state — one guard
clause before the existing delete mutation call.

## 2. Dashboard loading/error states

**File:** `src/features/dashboard/DashboardScreen.tsx` (and any hooks it
composes: `useTransactions`/`useBudgets`/`useCategories`/`useAllTransactions`)

Currently every query result is read with a `?? []` fallback that collapses
`isLoading`, `isError`, and "genuinely empty" into the same rendered state.

Change: check `isLoading`/`isError` from each query the dashboard depends on
before falling back to computing `calculateMonthSummary`.

- **Loading:** render the existing skeleton/placeholder treatment already
  used elsewhere in the app if one exists; otherwise a simple centered "Memuat
  data…" state. Do not compute or render stat tiles/charts with partial data.
- **Error:** render a short message ("Gagal memuat data dashboard.") with a
  retry button that calls the query's `refetch`. Do not silently fall back to
  an empty summary.
- **Genuinely empty** (queries succeeded, zero rows): unchanged — this is
  today's normal first-run empty state and stays as-is.

This only touches presentation/state-gating in the dashboard feature; no
change to the query hooks' data-fetching behavior itself.

## 3. Budget rollover

### Schema change

**File:** `src/domain/schemas.ts`

Add one optional field to `Budget`:

```ts
export const Budget = z.object({
  id: Id,
  month: MonthKey,
  categoryId: Id,
  amount: Rupiah,
  rollover: z.boolean().default(false),
  rolloverSince: MonthKey.optional(), // month rollover was (most recently) turned on
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().optional(),
});
```

Bump `SCHEMA_VERSION` to `4`. `rolloverSince` is additive/optional so the
existing backup/import Zod validation accepts old backups unchanged
(`rolloverSince` simply absent, `rollover` defaults false).

### Semantics

- `rolloverSince` is set to the current month whenever a category's `rollover`
  flag transitions **off → on**. Turning it off clears `rolloverSince`.
  Turning it on again later re-stamps it to that (new) month — history before
  a rollover-start point never counts.
- For a given category and month `M` where `rollover` is on:
  - If `M === rolloverSince`: **effective budget = base budget of `M`** (no
    carry-in; this is the starting month).
  - If `M > rolloverSince`: **effective budget of `M` = base budget of `M` +
    (effective budget of `M-1` − spent in `M-1`)**, recursively — i.e. a full
    chain back to `rolloverSince`, not just one month back. A prior deficit
    reduces the current month's effective budget (can go negative); a prior
    surplus increases it.
  - If `rollover` is off for `M` (never enabled, or `M < rolloverSince` in a
    weird edit-history case): effective budget = base budget of `M`, exactly
    like today.
- This changes only the **budget** side of the comparison. `spent` per
  category is unchanged (still `expenseSpentByCategory`/netted per month).
- Consumers (`calculateMonthSummary`'s `CategoryStatus.budget`/`remaining`/
  `pctUsed`/`status`, and `BudgetsScreen`'s per-category rows) use the
  effective budget wherever they currently use `Budget.amount` directly.

### Domain logic

**File:** `src/domain/budget.ts`

New pure function:

```ts
/**
 * Effective budget for (categoryId, month) given full budget history for
 * that category. Walks back the rollover chain from `month` to
 * `rolloverSince` (inclusive), summing each month's (base budget − spent).
 * Returns the plain base amount when rollover is off or `rolloverSince`
 * is unset/unreachable (no history for an intervening month = chain stops
 * there and that month contributes 0 carry, treated as base-only).
 */
export function effectiveBudget(
  month: string,
  categoryId: string,
  budgetsByMonth: Map<string, Budget>, // this category's budgets, keyed by month
  spentByMonth: Map<string, number>,   // this category's netted spend, keyed by month
): number
```

`calculateMonthSummary` gains a variant (or an added parameter) that accepts
full multi-month budget/spend history for rollover-enabled categories so it
can call `effectiveBudget` instead of reading `amount` directly. Non-rollover
categories are unaffected and skip the walk entirely (cheap: the recursion
only triggers for categories that opted in).

### UI

**File:** `src/features/budgets/BudgetsScreen.tsx`

- Add a toggle per category row: "Bawa sisa ke bulan depan" (bound to
  `Budget.rollover`). Toggling on/off updates `rolloverSince` per the
  semantics above via the existing budget-save path (`onBlur`-style save
  already in place; the toggle saves immediately on change, not on blur).
- When a category's effective budget differs from its base `amount` (i.e.
  rollover is on and carry ≠ 0), show a small inline badge next to the amount,
  e.g. "termasuk carry-over +Rp300.000" or "carry-over −Rp150.000", so the
  number showing in progress bars is never a mystery.

**File:** `src/features/dashboard/DashboardScreen.tsx` — per-category rows
already rendered from `CategoryStatus` pick up the effective budget
automatically once `calculateMonthSummary` is updated; add the same
carry-over badge treatment for consistency where category rows are listed.

### Testing

**File:** `src/domain/budget.test.ts`

- 3-month surplus chain (each month underspends; month 3's effective budget =
  base + accumulated surplus from months 1–2).
- 3-month deficit chain (each month overspends; effective budget goes
  negative/shrinks over time).
- Mixed surplus-then-deficit chain.
- Rollover enabled mid-history: `rolloverSince = M`; month `M-1`'s actual
  spend must NOT affect `M`'s effective budget.
- Rollover disabled then re-enabled later: new `rolloverSince` resets the
  chain; pre-disable history is excluded.
- Category with no budget set in an intervening month while rollover is on
  (edge case: chain should treat the missing month's base as 0; that month's
  actual spend, if any, still counts and reduces the carried-forward amount
  — i.e. the month contributes `0 − spent` to the chain, without throwing).

Plus one or two thin component-level checks (or a manual verification step)
confirming `TransactionsScreen` shows a confirm dialog and `DashboardScreen`
shows distinct loading/error/empty states.

## Out of scope

- Auto-sync, recurring auto-posting, PWA, and new analytics (net worth,
  savings goals, spend pace) are separate, later batches — not touched here.
- No change to the sync Worker/backend (Hermes-owned infra) — this batch is
  entirely client-side domain + UI.
- No UI for editing `rolloverSince` directly; it's system-managed, derived
  only from the on/off toggle transitions.

## Risks / considerations

- `effectiveBudget`'s recursive walk is O(months since `rolloverSince`) per
  category per render; for a personal app with a rollover chain of a few
  months to a few years this is negligible, but the implementation should
  memoize or compute once per month-view rather than recompute per
  keystroke/re-render.
- Schema/version bump (`SCHEMA_VERSION` 3 → 4) is additive-only; verify
  `BackupFile` round-trip tests (`src/data/backup.test.ts`) still pass
  unchanged since old backups simply lack `rolloverSince`.
