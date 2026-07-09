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
