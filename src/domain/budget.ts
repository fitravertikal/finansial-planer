import { addMonths } from './dates';
import type { Budget, Category, Transaction } from './schemas';

/**
 * Pure budgeting logic — no React, no storage. Everything the dashboard shows
 * is derived on read from transactions + budgets by these functions, so there
 * are no stored aggregates to drift out of sync. Reusable on a server later.
 *
 * Rules (see docs/PLAN.md):
 *  - Transfers (isTransfer) are excluded from every income/expense/budget total.
 *  - Refunds (refundOf set) are stored positive but NET DOWN their category's spend.
 *  - Money is whole IDR; direction comes from `type`, not the sign of `amount`.
 */

export type BudgetStatus = 'on_track' | 'warning' | 'over_budget';

export interface CategoryStatus {
  categoryId: string;
  budget: number;
  spent: number;
  remaining: number;
  pctUsed: number; // 0..>1; 0 when no budget
  overBudget: boolean;
  unbudgeted: boolean;
  status: BudgetStatus;
}

export interface MonthSummary {
  month: string;
  totalIncome: number;
  totalExpense: number;
  net: number;
  savingsRate: number | null; // null when income is 0
  totalBudget: number;
  budgetedExpense: number;
  remainingToSpend: number;
  adherence: number | null; // null when no budget set
  unbudgetedSpend: number;
  categories: CategoryStatus[]; // expense categories with a budget or spend, worst-first
}

const WARNING_THRESHOLD = 0.9;

/** Status for a single category given its month budget and (netted) spend. */
export function calculateCategoryStatus(
  categoryId: string,
  budget: number,
  spent: number,
): CategoryStatus {
  const remaining = budget - spent;
  const overBudget = budget > 0 && spent > budget;
  const unbudgeted = budget <= 0;
  const pctUsed = budget > 0 ? spent / budget : 0;
  let status: BudgetStatus = 'on_track';
  if (overBudget) status = 'over_budget';
  // Warning is the approach band BELOW the cap; exactly at 100% is still on_track.
  else if (budget > 0 && spent < budget && pctUsed >= WARNING_THRESHOLD) status = 'warning';
  return { categoryId, budget, spent, remaining, pctUsed, overBudget, unbudgeted, status };
}

/** The signed contribution of an expense transaction to its category's spend. */
function expenseContribution(txn: Transaction): number {
  return txn.refundOf ? -txn.amount : txn.amount;
}

/**
 * Netted expense spend per category for a month (transfers excluded, refunds
 * subtracted). Useful for the budgeting screen, which lists every category
 * regardless of whether it has a budget yet.
 */
export function expenseSpentByCategory(month: string, txns: Transaction[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of txns) {
    if (t.month !== month || t.isTransfer || t.type !== 'expense') continue;
    map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + expenseContribution(t));
  }
  return map;
}

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
  _categoryId: string,
  budgetsByMonth: Map<string, Budget>,
  spentByMonth: Map<string, number>,
): number {
  const current = budgetsByMonth.get(month);
  if (!current?.rollover || !current.rolloverSince) return current?.amount ?? 0;
  return walkRollover(month, current.rolloverSince, budgetsByMonth, spentByMonth);
}

export interface MonthTotals {
  month: string;
  income: number;
  expense: number;
}

/**
 * Income vs (netted) expense per month, for a given ordered list of months —
 * the series behind the spending-trend chart. Transfers excluded, refunds netted.
 * Months with no data come back as zeros so the chart has a continuous axis.
 */
export function monthlyTotals(txns: Transaction[], months: string[]): MonthTotals[] {
  const acc = new Map<string, { income: number; expense: number }>();
  for (const m of months) acc.set(m, { income: 0, expense: 0 });
  for (const t of txns) {
    if (t.isTransfer) continue;
    const bucket = acc.get(t.month);
    if (!bucket) continue; // outside the requested window
    if (t.type === 'income') bucket.income += t.amount;
    else bucket.expense += expenseContribution(t);
  }
  return months.map((m) => ({ month: m, ...acc.get(m)! }));
}

/**
 * Compute the full month summary from raw rows. `txns` may include any months;
 * only rows whose `month` matches are considered.
 */
export function calculateMonthSummary(
  month: string,
  txns: Transaction[],
  budgets: Budget[],
  categories: Category[],
): MonthSummary {
  const inMonth = txns.filter((t) => t.month === month && !t.isTransfer);

  let totalIncome = 0;
  const spentByCategory = new Map<string, number>();
  for (const t of inMonth) {
    if (t.type === 'income') {
      totalIncome += t.amount;
    } else {
      spentByCategory.set(
        t.categoryId,
        (spentByCategory.get(t.categoryId) ?? 0) + expenseContribution(t),
      );
    }
  }

  const budgetByCategory = new Map<string, number>();
  for (const b of budgets) {
    if (b.month === month) budgetByCategory.set(b.categoryId, b.amount);
  }

  // Every expense category that has a budget this month OR any spend this month.
  const expenseCategoryIds = new Set<string>([
    ...budgetByCategory.keys(),
    ...[...spentByCategory.keys()].filter((id) => {
      const cat = categories.find((c) => c.id === id);
      return !cat || cat.type === 'expense';
    }),
  ]);

  const rows: CategoryStatus[] = [];
  let totalExpense = 0;
  let budgetedExpense = 0;
  let unbudgetedSpend = 0;
  let totalBudget = 0;

  for (const id of expenseCategoryIds) {
    const budget = budgetByCategory.get(id) ?? 0;
    const spent = spentByCategory.get(id) ?? 0;
    rows.push(calculateCategoryStatus(id, budget, spent));
    totalBudget += budget;
    if (budget > 0) budgetedExpense += spent;
    else unbudgetedSpend += spent;
  }

  // totalExpense = all netted expense spend (budgeted + unbudgeted).
  for (const spent of spentByCategory.values()) totalExpense += spent;

  const net = totalIncome - totalExpense;
  const remainingToSpend = totalBudget - budgetedExpense;

  // Worst-first: over-budget and high-% categories float to the top.
  rows.sort((a, b) => b.pctUsed - a.pctUsed || b.spent - a.spent);

  return {
    month,
    totalIncome,
    totalExpense,
    net,
    savingsRate: totalIncome > 0 ? net / totalIncome : null,
    totalBudget,
    budgetedExpense,
    remainingToSpend,
    adherence: totalBudget > 0 ? budgetedExpense / totalBudget : null,
    unbudgetedSpend,
    categories: rows,
  };
}
