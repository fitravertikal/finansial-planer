# Safety & Reliability Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three safety/honesty gaps in the finansial-planer app: unconfirmed transaction deletion, a dashboard that silently hides loading/error states behind an empty-data fallback, and a half-wired `Budget.rollover` field — turned into a real chained carry-over budget feature.

**Architecture:** All changes are client-side only (no changes to the Cloudflare Worker sync backend). Task 1 and Task 2 are small, isolated UI fixes. Tasks 3–7 build the rollover feature bottom-up: schema → pure domain logic (with the recursive chain walk) → repo/hook plumbing to fetch multi-month history → UI (toggle + carry-over badge) in Budgets and Dashboard.

**Tech Stack:** Vite + React 18 + TypeScript (strict) + Tailwind + Dexie (IndexedDB) + Zod + TanStack Query + Vitest.

## Global Constraints

- Money is always whole IDR (integer), never a float — every new number stays an integer.
- All budget/rollover math must be pure functions in `src/domain/` — no React, no Dexie imports there.
- Zod schemas remain the single source of truth for both TypeScript types and runtime validation; any schema change must keep old backups (missing new optional fields) valid.
- Follow existing UI patterns exactly: `window.confirm(...)` for destructive actions (see `CategoriesScreen.tsx:97`), Tailwind utility classes matching neighboring markup, no new dependencies.
- `SCHEMA_VERSION` in `src/domain/schemas.ts` bumps from `3` to `4` as part of this work (additive field only, no data migration needed).
- Run `npm run typecheck`, `npm run test:run`, and `npm run lint` before every commit that touches source files.

---

### Task 1: Confirm before deleting a transaction

**Files:**
- Modify: `src/features/transactions/TransactionsScreen.tsx:118-124`

**Interfaces:**
- Consumes: existing `del` mutation object from `useDeleteTransaction()` (already imported in this file), specifically `del.mutate(id: string)`.
- Produces: nothing new consumed by other tasks.

- [ ] **Step 1: Add the confirm guard**

Change the delete button's `onClick` at `TransactionsScreen.tsx:119` from:

```tsx
<button
  onClick={() => del.mutate(t.id)}
  aria-label="Hapus"
  className="text-gray-300 hover:text-red-500"
>
  ✕
</button>
```

to:

```tsx
<button
  onClick={() => {
    if (window.confirm('Hapus transaksi ini?')) del.mutate(t.id);
  }}
  aria-label="Hapus"
  className="text-gray-300 hover:text-red-500"
>
  ✕
</button>
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`

In the browser: open Transactions for a month with at least one row, click the ✕ button, confirm a native `confirm()` dialog appears with the text "Hapus transaksi ini?", clicking Cancel leaves the row in place, clicking OK removes it.

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0 with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/transactions/TransactionsScreen.tsx
git commit -m "fix: confirm before deleting a transaction"
```

---

### Task 2: Dashboard shows honest loading/error states

**Files:**
- Modify: `src/features/dashboard/DashboardScreen.tsx`

**Interfaces:**
- Consumes: `useActiveCategories()`, `useTransactions(month)`, `useBudgets(month)`, `useAllTransactions()` — each a TanStack Query hook already imported in this file, each returning `{ data, isLoading, isError, refetch }` (standard `useQuery` result shape; `data` defaults to `undefined` when not yet loaded, not `[]` — the current code's `data: x = []` destructuring pattern is what hides the loading/error distinction).
- Produces: nothing new consumed by other tasks.

- [ ] **Step 1: Track loading/error across all four queries**

At the top of `DashboardScreen`, replace the destructuring at lines 29–33:

```tsx
const { data: categories = [] } = useActiveCategories();
const { data: txns = [] } = useTransactions(month);
const { data: budgets = [] } = useBudgets(month);

const { data: allTxns = [] } = useAllTransactions();
```

with:

```tsx
const categoriesQ = useActiveCategories();
const txnsQ = useTransactions(month);
const budgetsQ = useBudgets(month);
const allTxnsQ = useAllTransactions();

const categories = categoriesQ.data ?? [];
const txns = txnsQ.data ?? [];
const budgets = budgetsQ.data ?? [];
const allTxns = allTxnsQ.data ?? [];

const isLoading = categoriesQ.isLoading || txnsQ.isLoading || budgetsQ.isLoading || allTxnsQ.isLoading;
const isError = categoriesQ.isError || txnsQ.isError || budgetsQ.isError || allTxnsQ.isError;

function retryAll() {
  categoriesQ.refetch();
  txnsQ.refetch();
  budgetsQ.refetch();
  allTxnsQ.refetch();
}
```

- [ ] **Step 2: Gate the render on loading/error before computing the summary**

The rest of the function (from `const catMap = ...` at line 35 through the end of the `useMemo`/`slices` block) stays exactly as-is — those still need `categories`/`txns`/`budgets`/`allTxns` in scope, which the Step 1 change preserves. But wrap the final `return` in three cases. Change:

```tsx
  const netPositive = s.net >= 0;

  return (
    <div className="space-y-5">
```

to:

```tsx
  const netPositive = s.net >= 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray-400">
        Memuat data…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-gray-500">Gagal memuat data dashboard.</p>
        <button
          onClick={retryAll}
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
```

Note: the `useMemo` calls for `s`, `trend`, and `slices` run unconditionally before this check (React hooks can't be called after an early return), which is already the case in the current code — no reordering needed, just make sure the new `if` blocks are placed after all hook calls and before the final JSX return, exactly where the old `return` began.

- [ ] **Step 3: Manual verification of loading state**

Run: `npm run dev`. Loading state is very brief with Dexie (typically single-digit ms), so to observe it reliably: open browser DevTools → Network tab → throttle to "Slow 3G" is not applicable (local IndexedDB, not network) — instead, temporarily add `await new Promise((r) => setTimeout(r, 2000));` at the top of `transactionRepo.byMonth` in `src/data/repositories/dexie/repos.ts`, reload the Dashboard tab, confirm "Memuat data…" shows for ~2s then the normal dashboard renders. Remove the temporary delay afterward.

- [ ] **Step 4: Manual verification of error state**

With the app running, open DevTools console and run:
```js
indexedDB.deleteDatabase('FinansialPlanerDB')
```
(check `src/data/db.ts` for the actual DB name used by `Dexie` if this doesn't match), then reload while the app is mid-query — or simpler: temporarily throw inside `transactionRepo.byMonth` (`throw new Error('test')`), reload the Dashboard tab, confirm "Gagal memuat data dashboard." with a "Coba lagi" button renders instead of a blank/empty dashboard. Remove the temporary throw afterward.

- [ ] **Step 5: Typecheck, lint, and test**

Run: `npm run typecheck && npm run lint && npm run test:run`
Expected: all exit 0. (No existing test file covers `DashboardScreen` directly; this step verifies nothing else broke.)

- [ ] **Step 6: Commit**

```bash
git add src/features/dashboard/DashboardScreen.tsx
git commit -m "fix: dashboard shows loading/error states instead of silently rendering empty"
```

---

### Task 3: Add `rolloverSince` to the Budget schema

**Files:**
- Modify: `src/domain/schemas.ts:61-71` (the `Budget` object and `SCHEMA_VERSION`)

**Interfaces:**
- Produces: `Budget.rolloverSince?: string` (a `MonthKey`-shaped optional string, e.g. `'2026-07'`), and `SCHEMA_VERSION = 4`. Task 4 (`effectiveBudget`) and Task 6 (UI toggle) both read/write this field.

- [ ] **Step 1: Add the field to the schema**

In `src/domain/schemas.ts`, change:

```ts
export const Budget = z.object({
  id: Id,
  month: MonthKey,
  categoryId: Id,
  amount: Rupiah,
  rollover: z.boolean().default(false), // wired for later; not surfaced in v1
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().optional(), // sync tombstone
});
```

to:

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
  deletedAt: z.string().datetime().optional(), // sync tombstone
});
```

- [ ] **Step 2: Bump the schema version**

Change `export const SCHEMA_VERSION = 3;` to `export const SCHEMA_VERSION = 4;`.

- [ ] **Step 3: Run the existing test suite to confirm no regression**

Run: `npm run test:run`
Expected: all 36 existing tests still pass (the new field is optional, so every existing `budget()` test fixture in `budget.test.ts` and `merge.test.ts` remains valid without changes).

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/domain/schemas.ts
git commit -m "feat: add rolloverSince field to Budget schema (v4)"
```

---

### Task 4: `effectiveBudget` pure function with chained rollover

**Files:**
- Modify: `src/domain/budget.ts`
- Test: `src/domain/budget.test.ts`

**Interfaces:**
- Consumes: `Budget` type from `./schemas` (has `month`, `categoryId`, `amount`, `rollover`, `rolloverSince` per Task 3).
- Produces:
  ```ts
  export function effectiveBudget(
    month: string,
    categoryId: string,
    budgetsByMonth: Map<string, Budget>,
    spentByMonth: Map<string, number>,
  ): number
  ```
  Task 5 (`calculateMonthSummary` integration) and Task 6/7 (UI) call this directly.

- [ ] **Step 1: Write the failing tests**

Add to `src/domain/budget.test.ts` (append a new `describe` block; needs `effectiveBudget` imported — add it to the existing import at the top of the file: change `import { calculateCategoryStatus, calculateMonthSummary, expenseSpentByCategory, monthlyTotals } from './budget';` to also include `effectiveBudget`):

```ts
describe('effectiveBudget', () => {
  const CAT = 'cat-makan';

  function b(month: string, amount: number, rollover: boolean, rolloverSince?: string): Budget {
    return {
      id: budgetId(month, CAT),
      month,
      categoryId: CAT,
      amount,
      rollover,
      rolloverSince,
      createdAt: NOW,
      updatedAt: NOW,
    };
  }

  it('rollover off => effective budget is just the base amount', () => {
    const budgets = new Map([['2026-07', b('2026-07', 1_000_000, false)]]);
    const spent = new Map([['2026-07', 1_000_000_000]]); // irrelevant when rollover is off
    expect(effectiveBudget('2026-07', CAT, budgets, spent)).toBe(1_000_000);
  });

  it('starting month (month === rolloverSince) => base amount, no carry-in', () => {
    const budgets = new Map([['2026-07', b('2026-07', 1_000_000, true, '2026-07')]]);
    const spent = new Map([['2026-07', 700_000]]);
    expect(effectiveBudget('2026-07', CAT, budgets, spent)).toBe(1_000_000);
  });

  it('one month of surplus carries forward', () => {
    const budgets = new Map([
      ['2026-06', b('2026-06', 1_000_000, true, '2026-06')],
      ['2026-07', b('2026-07', 1_000_000, true, '2026-06')],
    ]);
    const spent = new Map([
      ['2026-06', 700_000], // 300k surplus
      ['2026-07', 0],
    ]);
    // July = 1,000,000 base + (1,000,000 - 700,000) carried from June = 1,300,000
    expect(effectiveBudget('2026-07', CAT, budgets, spent)).toBe(1_300_000);
  });

  it('3-month surplus chain accumulates', () => {
    const budgets = new Map([
      ['2026-05', b('2026-05', 1_000_000, true, '2026-05')],
      ['2026-06', b('2026-06', 1_000_000, true, '2026-05')],
      ['2026-07', b('2026-07', 1_000_000, true, '2026-05')],
    ]);
    const spent = new Map([
      ['2026-05', 800_000], // +200k
      ['2026-06', 900_000], // +100k on top of carried 1,200,000 => effective 1,200,000, spend 900k => +300k surplus
      ['2026-07', 0],
    ]);
    // May: effective 1,000,000 (start month)
    // June: 1,000,000 + (1,000,000 - 800,000) = 1,200,000 effective; spent 900,000 => surplus 300,000
    // July: 1,000,000 + (1,200,000 - 900,000) = 1,300,000
    expect(effectiveBudget('2026-07', CAT, budgets, spent)).toBe(1_300_000);
  });

  it('deficit chain reduces (can go negative) effective budget', () => {
    const budgets = new Map([
      ['2026-06', b('2026-06', 500_000, true, '2026-06')],
      ['2026-07', b('2026-07', 500_000, true, '2026-06')],
    ]);
    const spent = new Map([
      ['2026-06', 700_000], // 200k over
      ['2026-07', 0],
    ]);
    // July = 500,000 + (500,000 - 700,000) = 300,000
    expect(effectiveBudget('2026-07', CAT, budgets, spent)).toBe(300_000);
  });

  it('rollover enabled mid-history: prior-to-rolloverSince spend is ignored', () => {
    const budgets = new Map([
      ['2026-06', b('2026-06', 500_000, false)], // rollover was off in June
      ['2026-07', b('2026-07', 500_000, true, '2026-07')], // turned on starting July
    ]);
    const spent = new Map([
      ['2026-06', 5_000_000], // wildly over budget in June, but must NOT affect July
      ['2026-07', 0],
    ]);
    expect(effectiveBudget('2026-07', CAT, budgets, spent)).toBe(500_000);
  });

  it('missing budget row for an intervening month treats its base as 0, spend still counts', () => {
    const budgets = new Map([
      ['2026-06', b('2026-06', 1_000_000, true, '2026-06')],
      // 2026-07: no Budget row at all (category had no budget set that month)
      ['2026-08', b('2026-08', 1_000_000, true, '2026-06')],
    ]);
    const spent = new Map([
      ['2026-06', 800_000], // +200k
      ['2026-07', 100_000], // no budget row => base 0, so this month contributes 0 - 100,000 = -100,000
      ['2026-08', 0],
    ]);
    // June: effective 1,000,000 (start), surplus 200,000
    // July: base 0 + carried 200,000 = 200,000 effective; spent 100,000 => surplus 100,000
    // August: 1,000,000 + 100,000 = 1,100,000
    expect(effectiveBudget('2026-08', CAT, budgets, spent)).toBe(1_100_000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/domain/budget.test.ts`
Expected: FAIL — `effectiveBudget is not defined` / not exported from `./budget`.

- [ ] **Step 3: Implement `effectiveBudget`**

In `src/domain/budget.ts`, add (near `calculateCategoryStatus`, after the `expenseContribution` helper — anywhere before `calculateMonthSummary` is fine since it doesn't depend on it):

```ts
/**
 * Effective budget for (categoryId, month) given the category's rollover
 * start point. Walks back to `rolloverSince` (inclusive), accumulating each
 * month's (base budget − spent). A month with no Budget row contributes a
 * base of 0; its recorded spend still counts against the chain, so a gap in
 * the history doesn't break the walk.
 */
function walkRollover(
  month: string,
  rolloverSince: string,
  budgetsByMonth: Map<string, Budget>,
  spentByMonth: Map<string, number>,
): number {
  const base = budgetsByMonth.get(month)?.amount ?? 0;
  if (month <= rolloverSince) return base;

  const prevMonthKey = addMonths(month, -1);
  const prevEffective = walkRollover(prevMonthKey, rolloverSince, budgetsByMonth, spentByMonth);
  const prevSpent = spentByMonth.get(prevMonthKey) ?? 0;
  return base + (prevEffective - prevSpent);
}

/**
 * Effective budget for (categoryId, month), accounting for chained rollover.
 * Rollover on/off and its start month are read from `month`'s own Budget row
 * (rollover is a per-category setting the user toggles going forward; the
 * row for the month being viewed is authoritative for whether the chain
 * applies to it). Returns the plain base amount when rollover is off.
 * `categoryId` isn't read directly (the caller already scopes `budgetsByMonth`
 * / `spentByMonth` to one category) but is kept in the signature for call-site
 * clarity and symmetry with `expenseSpentByCategory`.
 */
export function effectiveBudget(
  month: string,
  categoryId: string,
  budgetsByMonth: Map<string, Budget>,
  spentByMonth: Map<string, number>,
): number {
  const current = budgetsByMonth.get(month);
  if (!current?.rollover || !current.rolloverSince) return current?.amount ?? 0;
  return walkRollover(month, current.rolloverSince, budgetsByMonth, spentByMonth);
}
```

This requires `addMonths` to be imported into `budget.ts`. Add to the top of the file:

```ts
import { addMonths } from './dates';
```

(placed alongside the existing `import type { Budget, Category, Transaction } from './schemas';` line).

Trace the "missing budget row" test against this implementation to confirm the chain survives a gap: `effectiveBudget('2026-08', ...)` reads August's row (`rollover: true`, `rolloverSince: '2026-06'`) and calls `walkRollover('2026-08', '2026-06', ...)`. That computes `base(Aug) = 1,000,000`, recurses to `walkRollover('2026-07', '2026-06', ...)` → `base(Jul) = 0` (no row for July), recurses to `walkRollover('2026-06', '2026-06', ...)` → `month <= rolloverSince` → returns `base(Jun) = 1,000,000` (start month, no carry-in). Unwinding: July = `0 + (1,000,000 − spent[Jun]=800,000) = 200,000`. August = `1,000,000 + (200,000 − spent[Jul]=100,000) = 1,100,000` — matches the test's expected `1,100,000`.

If `npm run lint` (Step 5) flags `categoryId` as an unused parameter, rename it to `_categoryId` and update the one call site added in this step; leave it as `categoryId` if lint is silent (unused non-last parameters are commonly exempted by TypeScript ESLint configs).

- [ ] **Step 4: Re-run the tests**

Run: `npx vitest run src/domain/budget.test.ts`
Expected: all tests in the `effectiveBudget` describe block PASS (the trace for the "missing budget row" case is already worked through in Step 3).

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0.

- [ ] **Step 6: Full test suite**

Run: `npm run test:run`
Expected: all tests pass (existing 36 + new `effectiveBudget` tests).

- [ ] **Step 7: Commit**

```bash
git add src/domain/budget.ts src/domain/budget.test.ts
git commit -m "feat: effectiveBudget pure function with chained rollover"
```

---

### Task 5: Wire `effectiveBudget` into `calculateMonthSummary`

**Files:**
- Modify: `src/domain/budget.ts`
- Test: `src/domain/budget.test.ts`

**Interfaces:**
- Consumes: `effectiveBudget` from Task 4.
- Produces: `calculateMonthSummary` gains a new optional 5th parameter `history?: { budgets: Budget[]; txns: Transaction[] }`. When omitted, behavior is byte-for-byte identical to today (every pre-existing test in `budget.test.ts` must keep passing unchanged — this is the regression guard). When provided, any category with `rollover: true` for `month` uses its effective (carried) budget instead of the raw `Budget.amount` for `CategoryStatus.budget`/`remaining`/`pctUsed`/`status`/`totalBudget`/`budgetedExpense`/`remainingToSpend`/`adherence`.
  Task 6 (BudgetsScreen) and Task 7 (DashboardScreen) call `calculateMonthSummary(month, txns, budgets, categories, history)` passing multi-month data.

- [ ] **Step 1: Write the failing test**

Add to `src/domain/budget.test.ts`, a new `describe` block:

```ts
describe('calculateMonthSummary with rollover history', () => {
  it('uses effective (carried) budget for a rollover category, base amount otherwise', () => {
    const categories = [expenseCat('cat-makan'), expenseCat('cat-transport')];

    const juneMakan: Budget = {
      id: budgetId('2026-06', 'cat-makan'),
      month: '2026-06',
      categoryId: 'cat-makan',
      amount: 1_000_000,
      rollover: true,
      rolloverSince: '2026-06',
      createdAt: NOW,
      updatedAt: NOW,
    };
    const julyMakan: Budget = {
      id: budgetId('2026-07', 'cat-makan'),
      month: '2026-07',
      categoryId: 'cat-makan',
      amount: 1_000_000,
      rollover: true,
      rolloverSince: '2026-06',
      createdAt: NOW,
      updatedAt: NOW,
    };
    const julyTransport = budget('cat-transport', 500_000); // rollover: false

    const juneTxns = [
      txn({ type: 'expense', categoryId: 'cat-makan', amount: 700_000, month: '2026-06', date: '2026-06-10' }),
    ];
    const julyTxns = [
      txn({ type: 'expense', categoryId: 'cat-makan', amount: 200_000 }),
      txn({ type: 'expense', categoryId: 'cat-transport', amount: 100_000 }),
    ];

    const s = calculateMonthSummary(
      '2026-07',
      julyTxns,
      [julyMakan, julyTransport],
      categories,
      { budgets: [juneMakan, julyMakan, julyTransport], txns: [...juneTxns, ...julyTxns] },
    );

    const makan = s.categories.find((c) => c.categoryId === 'cat-makan')!;
    // July effective budget = 1,000,000 base + (1,000,000 - 700,000 spent in June) = 1,300,000
    expect(makan.budget).toBe(1_300_000);
    expect(makan.remaining).toBe(1_300_000 - 200_000);

    const transport = s.categories.find((c) => c.categoryId === 'cat-transport')!;
    // rollover off => unaffected, plain base amount
    expect(transport.budget).toBe(500_000);
  });

  it('omitting history leaves behavior identical to plain Budget.amount', () => {
    const categories = [expenseCat('cat-makan')];
    const b = budget('cat-makan', 1_000_000); // rollover: false
    const txns = [txn({ type: 'expense', categoryId: 'cat-makan', amount: 400_000 })];
    const s = calculateMonthSummary('2026-07', txns, [b], categories);
    const makan = s.categories.find((c) => c.categoryId === 'cat-makan')!;
    expect(makan.budget).toBe(1_000_000);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/domain/budget.test.ts`
Expected: FAIL — `calculateMonthSummary` doesn't yet accept a 5th argument, or `makan.budget` doesn't reflect carry-over (TypeScript may not error since the extra arg would just be ignored at runtime prior to the change; confirm the assertion `expect(makan.budget).toBe(1_300_000)` fails with the actual value `1_000_000`).

- [ ] **Step 3: Implement the wiring**

In `src/domain/budget.ts`, change the `calculateMonthSummary` signature and the loop that builds `budgetByCategory`:

```ts
export function calculateMonthSummary(
  month: string,
  txns: Transaction[],
  budgets: Budget[],
  categories: Category[],
  history?: { budgets: Budget[]; txns: Transaction[] },
): MonthSummary {
```

Then, after the existing `budgetByCategory` construction loop (`for (const b of budgets) { if (b.month === month) budgetByCategory.set(b.categoryId, b.amount); }`), add logic that overrides entries for rollover categories when `history` is provided:

```ts
  const budgetByCategory = new Map<string, number>();
  for (const b of budgets) {
    if (b.month === month) budgetByCategory.set(b.categoryId, b.amount);
  }

  if (history) {
    const rolloverCategoryIds = new Set(
      budgets.filter((b) => b.month === month && b.rollover).map((b) => b.categoryId),
    );
    for (const categoryId of rolloverCategoryIds) {
      const budgetsByMonth = new Map(
        history.budgets.filter((b) => b.categoryId === categoryId).map((b) => [b.month, b]),
      );
      const spentByMonth = new Map<string, number>();
      for (const t of history.txns) {
        if (t.categoryId !== categoryId || t.isTransfer || t.type !== 'expense') continue;
        spentByMonth.set(t.month, (spentByMonth.get(t.month) ?? 0) + expenseContribution(t));
      }
      budgetByCategory.set(categoryId, effectiveBudget(month, categoryId, budgetsByMonth, spentByMonth));
    }
  }
```

This must be placed after the `budgetByCategory` initial loop and before it's used to build `expenseCategoryIds`/`rows` further down — check the existing function body in `src/domain/budget.ts` for the exact insertion point (immediately after the loop that reads `for (const b of budgets)`).

- [ ] **Step 4: Re-run tests**

Run: `npx vitest run src/domain/budget.test.ts`
Expected: PASS, including both new tests and all pre-existing ones (the "July 2026 worked example" tests call `calculateMonthSummary` without a 5th argument, so they must be completely unaffected).

- [ ] **Step 5: Typecheck, lint, full test suite**

Run: `npm run typecheck && npm run lint && npm run test:run`
Expected: all exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/domain/budget.ts src/domain/budget.test.ts
git commit -m "feat: calculateMonthSummary applies chained rollover when history is provided"
```

---

### Task 6: `BudgetRepo.all()` + `useAllBudgets()` hook

**Files:**
- Modify: `src/data/repositories/types.ts`
- Modify: `src/data/repositories/dexie/repos.ts`
- Modify: `src/hooks/useBudgets.ts`

**Interfaces:**
- Consumes: `FinansialDB` (Dexie instance) already imported in `repos.ts`; the `live()` helper already defined there (`repos.ts:12`).
- Produces: `BudgetRepo.all(): Promise<Budget[]>` and `useAllBudgets(): UseQueryResult<Budget[]>`. Task 7 (BudgetsScreen) and Task 8 (DashboardScreen) both call `useAllBudgets()` to get full multi-month history for the rollover walk.

- [ ] **Step 1: Add `all()` to the `BudgetRepo` interface**

In `src/data/repositories/types.ts`, change:

```ts
export interface BudgetRepo {
  byMonth(month: string): Promise<Budget[]>;
  upsert(budget: Budget): Promise<void>;
}
```

to:

```ts
export interface BudgetRepo {
  byMonth(month: string): Promise<Budget[]>;
  all(): Promise<Budget[]>;
  upsert(budget: Budget): Promise<void>;
}
```

- [ ] **Step 2: Implement it in the Dexie repo**

In `src/data/repositories/dexie/repos.ts`, change `createBudgetRepo`:

```ts
export function createBudgetRepo(db: FinansialDB): BudgetRepo {
  return {
    byMonth: async (month: string) =>
      live(await db.budgets.where('month').equals(month).toArray()),
    all: async () => live(await db.budgets.toArray()),
    upsert: async (budget: Budget) => {
      await db.budgets.put(budget);
    },
  };
}
```

- [ ] **Step 3: Add the `useAllBudgets` hook**

In `src/hooks/useBudgets.ts`, add alongside the existing `useBudgets`:

```ts
/** Every budget across every month — for the rollover carry-over walk. */
export function useAllBudgets() {
  return useQuery({ queryKey: [...KEY, 'all'], queryFn: () => budgetRepo.all() });
}
```

(matches the exact pattern of `useAllTransactions` in `src/hooks/useTransactions.ts:19-21`).

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: exit 0 (confirms `budgetRepo` — the composed instance from `src/data/index.ts` — satisfies the updated `BudgetRepo` interface; if `src/data/index.ts` constructs the repo via `createBudgetRepo(db)` this is automatic with no further changes needed — verify by reading `src/data/index.ts` if typecheck fails).

- [ ] **Step 5: Run existing repo/backup tests**

Run: `npm run test:run`
Expected: all pass — `src/data/backup.test.ts` doesn't need changes since it round-trips via the `BackupFile` Zod schema, not the repo interface directly.

- [ ] **Step 6: Commit**

```bash
git add src/data/repositories/types.ts src/data/repositories/dexie/repos.ts src/hooks/useBudgets.ts
git commit -m "feat: add BudgetRepo.all() and useAllBudgets() hook"
```

---

### Task 7: Rollover toggle + carry-over badge in BudgetsScreen

**Files:**
- Modify: `src/features/budgets/model.ts`
- Modify: `src/features/budgets/BudgetsScreen.tsx`

**Interfaces:**
- Consumes: `useAllBudgets()` (Task 6), `useAllTransactions()` (already exists in `src/hooks/useTransactions.ts`), `calculateMonthSummary(month, txns, budgets, categories, history)` (Task 5), `effectiveBudget` (Task 4, for the per-row carry-over badge computation), `makeBudget` (existing, in `src/features/budgets/model.ts`).
- Produces: nothing new consumed by later tasks — this is a leaf UI task alongside Task 8.

- [ ] **Step 1: Extend `makeBudget` to accept a rollover toggle**

In `src/features/budgets/model.ts`, change:

```ts
import { Budget, budgetId } from '../../domain/schemas';

/** Build/patch a monthly per-category budget row, validated via Zod. */
export function makeBudget(
  month: string,
  categoryId: string,
  amount: number,
  existing?: Budget,
): Budget {
  const now = new Date().toISOString();
  return Budget.parse({
    id: budgetId(month, categoryId),
    month,
    categoryId,
    amount,
    rollover: existing?.rollover ?? false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}
```

to:

```ts
import { Budget, budgetId } from '../../domain/schemas';

/**
 * Build/patch a monthly per-category budget row, validated via Zod.
 * Pass `rolloverOverride` to explicitly turn rollover on/off (e.g. from a UI
 * toggle); omit it to preserve `existing`'s rollover state unchanged. Turning
 * rollover on (false -> true) stamps `rolloverSince` to `month`; turning it
 * off clears `rolloverSince` entirely — a later re-enable starts a fresh chain.
 */
export function makeBudget(
  month: string,
  categoryId: string,
  amount: number,
  existing?: Budget,
  rolloverOverride?: boolean,
): Budget {
  const now = new Date().toISOString();
  const rollover = rolloverOverride ?? existing?.rollover ?? false;
  const wasOn = existing?.rollover ?? false;
  const rolloverSince = rollover ? (wasOn ? existing?.rolloverSince : month) : undefined;
  return Budget.parse({
    id: budgetId(month, categoryId),
    month,
    categoryId,
    amount,
    rollover,
    rolloverSince,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}
```

- [ ] **Step 2: Write a test for the new `makeBudget` behavior**

Create `src/features/budgets/model.test.ts` (new file — no test currently exists for this model):

```ts
import { describe, expect, it } from 'vitest';
import { makeBudget } from './model';

describe('makeBudget rollover toggling', () => {
  it('turning rollover on for the first time stamps rolloverSince to the current month', () => {
    const b = makeBudget('2026-07', 'cat-makan', 1_000_000, undefined, true);
    expect(b.rollover).toBe(true);
    expect(b.rolloverSince).toBe('2026-07');
  });

  it('leaving rollover on (already on) preserves the original rolloverSince', () => {
    const existing = makeBudget('2026-06', 'cat-makan', 1_000_000, undefined, true);
    const b = makeBudget('2026-07', 'cat-makan', 1_000_000, existing, true);
    expect(b.rolloverSince).toBe('2026-06');
  });

  it('turning rollover off clears rolloverSince', () => {
    const existing = makeBudget('2026-06', 'cat-makan', 1_000_000, undefined, true);
    const b = makeBudget('2026-07', 'cat-makan', 1_000_000, existing, false);
    expect(b.rollover).toBe(false);
    expect(b.rolloverSince).toBeUndefined();
  });

  it('omitting rolloverOverride preserves existing rollover state as-is', () => {
    const existing = makeBudget('2026-06', 'cat-makan', 1_000_000, undefined, true);
    const b = makeBudget('2026-07', 'cat-makan', 1_200_000, existing);
    expect(b.rollover).toBe(true);
    expect(b.rolloverSince).toBe('2026-06');
  });

  it('no existing budget and no override defaults rollover off', () => {
    const b = makeBudget('2026-07', 'cat-makan', 1_000_000);
    expect(b.rollover).toBe(false);
    expect(b.rolloverSince).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run to verify current implementation passes (this is TDD-after for the model change, since Step 1 already implemented it — run now to confirm)**

Run: `npx vitest run src/features/budgets/model.test.ts`
Expected: all 5 tests PASS given the Step 1 implementation. If any fail, fix `makeBudget` before proceeding — do not move on with a red test.

- [ ] **Step 4: Add the rollover toggle and carry-over badge to `BudgetsScreen`**

In `src/features/budgets/BudgetsScreen.tsx`, update the imports:

```ts
import { useMemo } from 'react';
import { useUiStore } from '../../store/ui';
import { useActiveCategories } from '../../hooks/useCategories';
import { useAllTransactions, useTransactions } from '../../hooks/useTransactions';
import { useAllBudgets, useBudgets, useSaveBudget } from '../../hooks/useBudgets';
import {
  calculateCategoryStatus,
  calculateMonthSummary,
  effectiveBudget,
  expenseSpentByCategory,
} from '../../domain/budget';
import { groupDigits, parseAmountInput } from '../../domain/money';
import { prevMonth } from '../../domain/dates';
import { Money } from '../../components/Money';
import { makeBudget } from './model';
import type { BudgetStatus } from '../../domain/budget';
```

Add the multi-month history queries and a helper to compute a category's effective budget, right after the existing hook calls:

```ts
export function BudgetsScreen() {
  const month = useUiStore((s) => s.activeMonth);
  const { data: categories = [] } = useActiveCategories();
  const { data: txns = [] } = useTransactions(month);
  const { data: budgets = [] } = useBudgets(month);
  const { data: lastMonthBudgets = [] } = useBudgets(prevMonth(month));
  const { data: allBudgets = [] } = useAllBudgets();
  const { data: allTxns = [] } = useAllTransactions();
  const saveBudget = useSaveBudget();

  const expenseCats = useMemo(() => categories.filter((c) => c.type === 'expense'), [categories]);
  const incomeCats = useMemo(() => categories.filter((c) => c.type === 'income'), [categories]);
  const spent = useMemo(() => expenseSpentByCategory(month, txns), [month, txns]);
  const budgetMap = useMemo(() => new Map(budgets.map((b) => [b.categoryId, b])), [budgets]);
  const summary = useMemo(
    () => calculateMonthSummary(month, txns, budgets, categories, { budgets: allBudgets, txns: allTxns }),
    [month, txns, budgets, categories, allBudgets, allTxns],
  );

  function carryOverFor(categoryId: string): number {
    const b = budgetMap.get(categoryId);
    if (!b?.rollover) return 0;
    const budgetsByMonth = new Map(allBudgets.filter((x) => x.categoryId === categoryId).map((x) => [x.month, x]));
    const spentByMonth = new Map<string, number>();
    for (const t of allTxns) {
      if (t.categoryId !== categoryId || t.isTransfer || t.type !== 'expense') continue;
      spentByMonth.set(t.month, (spentByMonth.get(t.month) ?? 0) + (t.refundOf ? -t.amount : t.amount));
    }
    return effectiveBudget(month, categoryId, budgetsByMonth, spentByMonth) - b.amount;
  }
```

Replace the `setBudget` function to preserve the rollover flag on plain amount edits, and add a `toggleRollover` function:

```ts
  function setBudget(categoryId: string, raw: string) {
    const amount = parseAmountInput(raw);
    const existing = budgetMap.get(categoryId);
    if ((existing?.amount ?? 0) === amount) return;
    saveBudget.mutate(makeBudget(month, categoryId, amount, existing));
  }

  function toggleRollover(categoryId: string, next: boolean) {
    const existing = budgetMap.get(categoryId);
    saveBudget.mutate(makeBudget(month, categoryId, existing?.amount ?? 0, existing, next));
  }
```

In the expense-category `<li>` block, add the toggle and badge. Change:

```tsx
            <li key={c.id} className="rounded-lg border border-gray-100 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ background: c.color }} />
                  {c.name}
                </span>
                <label className="flex items-center gap-1 text-sm">
                  <span className="text-xs text-gray-400">Rp</span>
                  <input
                    inputMode="numeric"
                    defaultValue={groupDigits(b)}
                    onBlur={(e) => setBudget(c.id, e.target.value)}
                    placeholder="0"
                    className="w-28 rounded border border-gray-200 px-2 py-1 text-right tabular-nums focus:border-emerald-500 focus:outline-none"
                  />
                </label>
              </div>
```

to:

```tsx
            <li key={c.id} className="rounded-lg border border-gray-100 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ background: c.color }} />
                  {c.name}
                </span>
                <label className="flex items-center gap-1 text-sm">
                  <span className="text-xs text-gray-400">Rp</span>
                  <input
                    inputMode="numeric"
                    defaultValue={groupDigits(b)}
                    onBlur={(e) => setBudget(c.id, e.target.value)}
                    placeholder="0"
                    className="w-28 rounded border border-gray-200 px-2 py-1 text-right tabular-nums focus:border-emerald-500 focus:outline-none"
                  />
                </label>
              </div>
              <label className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500">
                <input
                  type="checkbox"
                  checked={budgetMap.get(c.id)?.rollover ?? false}
                  onChange={(e) => toggleRollover(c.id, e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                Bawa sisa ke bulan depan
              </label>
              {carryOverFor(c.id) !== 0 && (
                <p className={`mt-0.5 text-xs ${carryOverFor(c.id) > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  termasuk carry-over {carryOverFor(c.id) > 0 ? '+' : '−'}
                  <Money amount={Math.abs(carryOverFor(c.id))} />
                </p>
              )}
```

Note `carryOverFor` is called twice in the render (once for the condition, once for the value) — acceptable for a personal-scale app with a handful of categories, but if `npm run lint` flags this or it's visually redundant, compute it once into a local `const carry = carryOverFor(c.id);` inside the `.map()` callback instead and reference `carry` in both places.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`. In Budgets: set a budget for a category in the previous month, spend less than the budget, come back to the current month, toggle "Bawa sisa ke bulan depan" on, confirm the carry-over badge appears with the correct surplus amount and the progress bar / remaining figures on this screen reflect the larger effective budget.

- [ ] **Step 6: Typecheck, lint, test**

Run: `npm run typecheck && npm run lint && npm run test:run`
Expected: all exit 0/pass.

- [ ] **Step 7: Commit**

```bash
git add src/features/budgets/model.ts src/features/budgets/model.test.ts src/features/budgets/BudgetsScreen.tsx
git commit -m "feat: rollover toggle and carry-over badge in BudgetsScreen"
```

---

### Task 8: Carry-over badge on DashboardScreen

**Files:**
- Modify: `src/features/dashboard/DashboardScreen.tsx`

**Interfaces:**
- Consumes: `useAllBudgets()` (Task 6), `calculateMonthSummary(month, txns, budgets, categories, history)` (Task 5). Builds on Task 2's loading/error gating (this task adds one more query to that gate).

- [ ] **Step 1: Add the `useAllBudgets` query and pass history into `calculateMonthSummary`**

Update the imports at the top of `DashboardScreen.tsx` to add `useAllBudgets`:

```tsx
import { useMemo } from 'react';
import { useUiStore } from '../../store/ui';
import { useActiveCategories } from '../../hooks/useCategories';
import { useAllTransactions, useTransactions } from '../../hooks/useTransactions';
import { useAllBudgets, useBudgets } from '../../hooks/useBudgets';
import { calculateMonthSummary, monthlyTotals, type BudgetStatus } from '../../domain/budget';
import { addMonths } from '../../domain/dates';
import { Money } from '../../components/Money';
import { TrendChart } from './TrendChart';
import { BreakdownChart, type Slice } from './BreakdownChart';
```

Following the Task 2 pattern (query-object destructuring, not `data ?? []` shorthand), add the `allBudgetsQ` query alongside the four from Task 2:

```tsx
  const categoriesQ = useActiveCategories();
  const txnsQ = useTransactions(month);
  const budgetsQ = useBudgets(month);
  const allTxnsQ = useAllTransactions();
  const allBudgetsQ = useAllBudgets();

  const categories = categoriesQ.data ?? [];
  const txns = txnsQ.data ?? [];
  const budgets = budgetsQ.data ?? [];
  const allTxns = allTxnsQ.data ?? [];
  const allBudgets = allBudgetsQ.data ?? [];

  const isLoading =
    categoriesQ.isLoading || txnsQ.isLoading || budgetsQ.isLoading || allTxnsQ.isLoading || allBudgetsQ.isLoading;
  const isError =
    categoriesQ.isError || txnsQ.isError || budgetsQ.isError || allTxnsQ.isError || allBudgetsQ.isError;

  function retryAll() {
    categoriesQ.refetch();
    txnsQ.refetch();
    budgetsQ.refetch();
    allTxnsQ.refetch();
    allBudgetsQ.refetch();
  }
```

Update the `s` computation to pass history:

```tsx
  const s = useMemo(
    () => calculateMonthSummary(month, txns, budgets, categories, { budgets: allBudgets, txns: allTxns }),
    [month, txns, budgets, categories, allBudgets, allTxns],
  );
```

- [ ] **Step 2: Add the carry-over badge to the per-category dashboard rows**

In the per-category list (`s.categories.map((row) => { ... })`), the `CategoryStatus.budget` already reflects the effective (carried) amount from Task 5's wiring, so the progress bar and "spent / budget" figures are already correct with no further change needed there. Add a small badge showing the carry component specifically. Compute the base amount for comparison — add this inside the `.map()` callback, right after `const cat = catMap.get(row.categoryId);`:

```tsx
          {s.categories.map((row) => {
            const cat = catMap.get(row.categoryId);
            const rawBudget = budgets.find((b) => b.categoryId === row.categoryId && b.month === month)?.amount ?? 0;
            const carry = row.budget - rawBudget;
            const width = Math.min(100, Math.round(row.pctUsed * 100));
```

Then, after the existing "Lewat budget" paragraph block (`{row.overBudget && (...)}`), add:

```tsx
                {carry !== 0 && (
                  <p className={`mt-0.5 text-xs ${carry > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    termasuk carry-over {carry > 0 ? '+' : '−'}
                    <Money amount={Math.abs(carry)} />
                  </p>
                )}
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`. With a category set up with rollover in Budgets (per Task 7's verification), open Dashboard for the current month and confirm the same carry-over badge appears under that category's row, with the same figure shown in BudgetsScreen.

- [ ] **Step 4: Typecheck, lint, test**

Run: `npm run typecheck && npm run lint && npm run test:run`
Expected: all exit 0/pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/dashboard/DashboardScreen.tsx
git commit -m "feat: show rollover carry-over badge on dashboard per-category rows"
```

---

### Task 9: Final full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full CI-equivalent command sequence locally**

Run: `npm run lint && npm run typecheck && npm run test:run && npm run build`
Expected: all four commands exit 0. This mirrors `.github/workflows/ci.yml` exactly, so a green local run means the PR's CI check will also pass.

- [ ] **Step 2: Manual end-to-end pass**

Run: `npm run dev`. Walk through, in order:
1. Add a transaction, delete it, confirm the confirm-dialog appears (Task 1).
2. Reload the Dashboard tab with a simulated slow/broken query per Task 2's steps 3–4 (if not already cleaned up, do it now) to confirm loading/error states, then confirm normal operation is restored.
3. In Budgets, toggle rollover on for a category with budget history in the prior month; confirm the carry-over badge value on both Budgets and Dashboard match (Tasks 7–8).
4. Toggle rollover off, confirm the badge disappears and the category reverts to using its plain monthly budget.

- [ ] **Step 3: Push the branch and confirm CI is green**

```bash
git push -u origin claude/safety-reliability-fixes
```

(If the branch already exists remotely from the spec commit, this is a normal push, not `-u` — check with `git status` first; use `git push` if upstream is already tracked.)

Then check the PR's CI run (via `gh pr checks` once `gh auth login` has been completed, or by visiting the PR page) to confirm all four CI steps (lint, typecheck, test, build) are green before marking the PR "ready for review" per `.agents/COLLABORATION.md`.
