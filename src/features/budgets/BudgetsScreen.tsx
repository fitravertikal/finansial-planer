import { useMemo } from 'react';
import { useUiStore } from '../../store/ui';
import { useActiveCategories } from '../../hooks/useCategories';
import { useTransactions } from '../../hooks/useTransactions';
import { useBudgets, useSaveBudget } from '../../hooks/useBudgets';
import {
  calculateCategoryStatus,
  calculateMonthSummary,
  expenseSpentByCategory,
} from '../../domain/budget';
import { groupDigits, parseAmountInput } from '../../domain/money';
import { prevMonth } from '../../domain/dates';
import { Money } from '../../components/Money';
import { makeBudget } from './model';
import type { BudgetStatus } from '../../domain/budget';

const BAR: Record<BudgetStatus, string> = {
  on_track: 'bg-emerald-500',
  warning: 'bg-amber-500',
  over_budget: 'bg-red-500',
};

export function BudgetsScreen() {
  const month = useUiStore((s) => s.activeMonth);
  const { data: categories = [] } = useActiveCategories();
  const { data: txns = [] } = useTransactions(month);
  const { data: budgets = [] } = useBudgets(month);
  const { data: lastMonthBudgets = [] } = useBudgets(prevMonth(month));
  const saveBudget = useSaveBudget();

  const expenseCats = useMemo(() => categories.filter((c) => c.type === 'expense'), [categories]);
  const incomeCats = useMemo(() => categories.filter((c) => c.type === 'income'), [categories]);
  const spent = useMemo(() => expenseSpentByCategory(month, txns), [month, txns]);
  const budgetMap = useMemo(() => new Map(budgets.map((b) => [b.categoryId, b])), [budgets]);
  const summary = useMemo(
    () => calculateMonthSummary(month, txns, budgets, categories),
    [month, txns, budgets, categories],
  );

  function setBudget(categoryId: string, raw: string) {
    const amount = parseAmountInput(raw);
    const existing = budgetMap.get(categoryId);
    if ((existing?.amount ?? 0) === amount) return;
    saveBudget.mutate(makeBudget(month, categoryId, amount, existing));
  }

  function copyLastMonth() {
    for (const b of lastMonthBudgets) {
      saveBudget.mutate(makeBudget(month, b.categoryId, b.amount));
    }
  }

  return (
    <div className="space-y-4">
      <header className="rounded-xl bg-gray-50 p-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Total budget</span>
          <Money amount={summary.totalBudget} className="font-semibold" />
        </div>
        <div className="mt-1 flex justify-between text-sm">
          <span className="text-gray-500">Sisa untuk dibelanjakan</span>
          <Money
            amount={summary.remainingToSpend}
            className={`font-semibold ${summary.remainingToSpend < 0 ? 'text-red-600' : 'text-emerald-600'}`}
          />
        </div>
        {budgets.length === 0 && lastMonthBudgets.length > 0 && (
          <button
            onClick={copyLastMonth}
            className="mt-3 w-full rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white"
          >
            Salin budget bulan lalu
          </button>
        )}
      </header>

      {/* Expense categories */}
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Pengeluaran</h3>
      <ul className="space-y-3">
        {expenseCats.map((c) => {
          const b = budgetMap.get(c.id)?.amount ?? 0;
          const s = spent.get(c.id) ?? 0;
          const status = calculateCategoryStatus(c.id, b, s);
          const width = Math.min(100, Math.round(status.pctUsed * 100));
          return (
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

              {b > 0 && (
                <div className="mt-2">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className={`h-full ${BAR[status.status]}`} style={{ width: `${width}%` }} />
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-gray-500">
                    <span>
                      Terpakai <Money amount={s} />
                    </span>
                    <span className={status.overBudget ? 'font-semibold text-red-600' : ''}>
                      {status.overBudget ? 'Lewat ' : 'Sisa '}
                      <Money amount={Math.abs(status.remaining)} />
                    </span>
                  </div>
                </div>
              )}
              {b === 0 && s > 0 && (
                <p className="mt-1 text-xs text-amber-600">
                  Terpakai <Money amount={s} /> — belum ada budget
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {/* Income categories */}
      {incomeCats.length > 0 && (
        <>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 pt-2">Pemasukan</h3>
          <ul className="space-y-3">
            {incomeCats.map((c) => {
              const b = budgetMap.get(c.id)?.amount ?? 0;
              return (
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
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
