# Finansial Planer — Initial Plan (v1)

> Synthesized from three planning passes (Product, Finance/FP&A, Architecture). This
> is the build spec for v1: a **local-first, single-user** personal finance tracker
> in **IDR**. Data stays in the browser; no server, no login.

---

## 1. Problem & goal

You spend across cash, bank transfer, and e-wallet (GoPay/OVO/DANA) and by month-end
don't know where it went or whether you overspent — until the balance is already low.

**Job-to-be-done:** *"Log what I spend in a few seconds, and tell me at a glance
whether I'm still within budget this month — so I can adjust before the month ends."*

**Goal for v1:** logging an expense takes **under 10 seconds**, and one dashboard
glance answers **"am I overspending, and where?"** The single biggest risk for a
one-person tool isn't the wrong feature — it's **abandonment**. Everything optimizes
for *will you still be logging in week 3?* → speed of logging + honesty of the dashboard.

---

## 2. v1 scope — MUST vs later

### 🟢 MUST (v1)
- Log a transaction: **type (income/expense)**, date (defaults to today), amount, category, payment method (cash / transfer / e-wallet), optional note.
- Editable category list (add / rename / **archive**, never hard-delete with history).
- **Monthly budget per category** (per `category × month`).
- Dashboard: **total spent this month**, **income vs expense + net**, and **remaining budget per category** with progress bar + over-budget warning, sorted worst-first.
- Transaction list for the current month (view / edit / delete).
- Local persistence (survives refresh) + **JSON export/import** (backup + migration path).
- Correct **IDR formatting** (`Rp 1.500.000`, dot separators, no decimals).
- **Transfers** (`is_transfer`) and **refunds** (`refund_of`) modeled so they don't corrupt totals — see §3.

### 🟡 Later (deliberately deferred)
- Multi-month **spending trend** chart and **category donut** — *no history exists on day one*, so these are empty for weeks. Ship them in the first post-v1 cycle once real data exists. (Architecture already supports them via Recharts.)
- Recurring transactions / templates; budget **rollover** (schema field present, off by default); "copy last month's budgets" convenience.
- Search/filter across all history; savings goals / net-worth; multi-device **sync**; bank/e-wallet auto-import; receipt photos; multi-currency.

**Decisions resolving the planning passes:**
- **Charts deferred** (PM's argument wins: no data on day one). Data model + KPI formulas are defined now so charts drop in later with zero rework.
- **Budgets reset each month** (envelope model), `rollover` boolean present but off.
- **`is_transfer` + `refund_of` included in v1** (cheap; prevents double-counting and false over-budget). `recurring_rule_id` deferred.

---

## 3. Finance domain model

### Categories
User-editable; each has `type` = `expense` | `income` (fixed once transactions exist).
Ships with Indonesian defaults so you can start immediately.

- **Expense defaults:** Makan & Minum, Transport, Tagihan & Utilitas, Belanja, Hiburan, Kesehatan, Pendidikan, Keluarga & Sosial, Cicilan & Pinjaman, Asuransi, Rumah/Kos, **Lain-lain** (permanent fallback).
- **Income defaults:** Gaji, Bonus/THR, Usaha/Freelance, Investasi, Hadiah/Lainnya.
- Expense txns reference only expense categories (and vice versa). Archive (soft-delete) preserves history.

### Budget model
- A budget = planned cap for **one expense category** in **one calendar month**; unit is `(category_id, month)`, unique. Income is tracked, not budgeted.
- **"This month"** = calendar month in **Asia/Jakarta (WIB)**; a transaction belongs to the month of its **`date`** (economic date), not `created_at`.
- **Template → materialization:** each category has a default monthly amount; when a month starts it's copied into a per-month `Budget` row you can override. Past months are **immutable**; template edits are **forward-only**. (v1 may ship a simple "copy last month" instead of full templating — same effect.)
- **Month-end = RESET** by default (fresh envelope each month). `rollover` is a per-category boolean, default `false`, wired but not surfaced in v1.

### Budget-vs-actual (per category × month)
```
spent     = Σ expense txns in (category, month), excluding transfers, net of refunds
budget    = Budget.amount (0 if unset)
remaining = budget - spent            // may be negative (over budget)
pct_used  = budget > 0 ? spent / budget : n/a
status    = spent <= budget ? on_track : over_budget   // optional "warning" at >= 90%
```
Categories with spend but no budget show as **Unbudgeted** (visible, but excluded from adherence/remaining-to-spend).

### Dashboard KPIs (selected month, whole IDR)
| Metric | Formula |
|---|---|
| Total Expense | Σ expense txns (excl. transfers, net of refunds) |
| Total Income | Σ income txns |
| **Net / Savings** | Total Income − Total Expense |
| Savings Rate | Net / Total Income (n/a if income 0) |
| Total Budget | Σ budgets over budgeted expense categories |
| Remaining to Spend | Total Budget − expense **in budgeted categories only** |
| Budget Adherence | expense_budgeted / Total Budget |
| Per-category status | `{budget, spent, remaining, pct_used, status}` |
| Unbudgeted spend | Σ expense in categories with no budget (shown separately) |
| Daily pace (optional) | avg_daily × days_in_month → early over-budget warning |

Guard all divisions (income 0, budget 0, prev-month 0).

### Edge-case rules
- **Transfers** (`is_transfer=true`, e.g. top-up e-wallet, move to Tabungan): excluded from income, expense, net, budgets, breakdowns. Moving your own money isn't spending.
- **Refunds** (`refund_of` → original expense): stored as a positive-amount expense row but **subtracted** from that category's `spent`; never counted as income.
- **Mid-month budget change**: applies to the whole current month immediately; past months immutable.
- **Over budget** (`remaining < 0`): valid, warn — never block the save.
- **No category impossible**: picker defaults to Lain-lain (expense) / Hadiah-Lainnya (income).

*A full worked example (July 2026, with the transfer/refund/unbudgeted interactions and every KPI computed) lives in the design notes and should become the seed fixture for domain unit tests.*

---

## 4. Technical architecture

**Stack (confirmed): Vite + React 18 + TypeScript (`strict`) + Tailwind.** Static build, no backend.

**Load-bearing decisions:**
1. **Repository layer** between UI and storage → sync is additive later, not a rewrite.
2. **All budget math as pure functions in `src/domain/`** → testable, reusable, correct.
3. **Dexie (IndexedDB)** with a denormalized `month` key + compound indexes → fast month queries.
4. **Integer rupiah, never floats**; **Zod** as the single source of TS types *and* runtime validation (forms + import).
5. **UUIDs + `updatedAt` + soft-delete + JSON envelope now** → cheap insurance for future sync.

**Lean dependency set:** react, react-dom, react-router, dexie, recharts, zustand, @tanstack/react-query, react-hook-form, zod, date-fns. Built-ins for money (`Intl.NumberFormat('id-ID', …)`) and ids (`crypto.randomUUID()`).

### Core schemas (Zod → inferred TS types)
```ts
PaymentMethod = 'cash' | 'transfer' | 'ewallet'
TxnType       = 'income' | 'expense'
// money = integer IDR (nonnegative); date = 'YYYY-MM-DD'; month = 'YYYY-MM'

Category    { id, name, type, color?, icon?, archived, sortOrder, createdAt }
Transaction { id, type, date, month /*derived*/, amount, categoryId,
              paymentMethod, note?, isTransfer=false, refundOf?, createdAt, updatedAt }
Budget      { id: `${month}:${categoryId}`, month, categoryId, amount, createdAt, updatedAt }
AppMeta     { id:'app', schemaVersion, currency:'IDR', defaultPaymentMethod, createdAt }
```

### Persistence (Dexie stores/indexes)
```
transactions: 'id, month, categoryId, date, [month+categoryId], [month+type]'
categories:   'id, type, archived, sortOrder'
budgets:      'id, month, [month+categoryId]'
meta:         'id'
```
**Export/import:** one versioned JSON envelope (`format`, `schemaVersion`, `exportedAt`, `data{…}`), validated on import by the same Zod schemas. Replace (atomic, default) or Merge-by-id (the manual precursor to sync). Filename `finansial-planer-YYYY-MM-DD.json`.

### App structure
```
src/
├─ domain/     # PURE: schemas.ts, money.ts, dates.ts, budget.ts   (no React, no Dexie)
├─ data/       # db.ts, repositories/{types.ts, dexie/…}, backup.ts, index.ts (composition root)
├─ features/   # dashboard, transactions, budgets, categories, settings
├─ hooks/      # TanStack Query hooks wrapping repos
├─ components/ # Money, MonthPicker, charts, dialogs
├─ store/      # Zustand: active month, filters, UI state
└─ app/        # router, providers, layout shell
```
Routes: `/` Dashboard · `/transactions` · `/budgets` · `/categories` · `/settings`.

### Future sync path (no rewrite)
Swap the repository implementation (Dexie → a `SyncedRepo` wrapping remote), keep pure
domain logic and the UI untouched. The backup envelope is already the sync payload shape;
`updatedAt` + soft-delete enable last-write-wins/delta later. **Nothing of this in v1** — just don't violate the seams.

### Testing & CI
- **Vitest** unit tests on `src/domain/*` (the priority): remaining/over-budget boundaries, integer-rupiah math, month bucketing across year edges, transfer/refund netting, income/expense separation. Seed from the July 2026 worked example.
- Repo tests via `fake-indexeddb`; schema round-trip (export→import) + malformed-JSON rejection; a few thin component tests (add-transaction form, dashboard render).
- **CI (GitHub Actions):** `lint`, `typecheck` (`tsc --noEmit`), `test`, `build`. Make these **required status checks** on `main`'s branch protection so green-is-enforced (the workflow file alone doesn't enforce).

---

## 5. Milestones

Each milestone is independently usable — you should *actually use it* by end of **M2**.

- **M1 — Skeleton & data layer.** App boots (static), Dexie persistence + schemas defined, IDR formatting correct, export/import round-trips losslessly, domain test harness set up. Raw UI is fine.
- **M2 — Transaction tracking** *(first "I'd use this" moment).* Add/edit/delete income & expense with all fields; manage categories; current-month list + running total; the **<10s logging flow** works on mobile web.
- **M3 — Budgeting.** Set monthly budget per category (stored per month); spent-vs-budget computed correctly.
- **M4 — Dashboard (v1 GA).** Home = total spent + income/expense/net + per-category remaining with progress bars + over-budget warnings, sorted worst-first.
- **Post-v1:** trend chart + category donut (once ≥1 month of data), recurring rules, "copy last month's budgets".

---

## 6. Success metrics (single-user, pragmatic)
- Time to log one expense **< 10s, ≤ 4 taps** (make-or-break).
- Still logging after 2 weeks (≥ 5 of last 7 days) = it's genuinely useful.
- ≥ 90% of real spending captured (a budget you don't trust, you ignore).
- "Glance test": answer "over budget, where?" in < 5s.
- At least once, the app **changes a spending decision** — the real proof.
- Zero unrecoverable data-loss events (export must work).

---

## 7. Explicitly out of scope for v1
Multi-user/login · cloud sync/multi-device · bank/e-wallet auto-import · trend & donut charts · budget rollover · savings goals / net-worth / debt / investments · recurring/templates · receipt photos/OCR · multi-currency · PDF/reports/tax · native mobile apps (responsive web + optional PWA only).

---

*Next step: scaffold M1 (Vite app + Dexie schemas + domain skeleton + export/import + first domain tests) on a `claude/*` branch as a draft PR.*
