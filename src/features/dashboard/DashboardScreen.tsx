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

const BAR: Record<BudgetStatus, string> = {
  on_track: 'bg-emerald-500',
  warning: 'bg-amber-500',
  over_budget: 'bg-red-500',
};

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{children}</p>
    </div>
  );
}

export function DashboardScreen() {
  const month = useUiStore((s) => s.activeMonth);
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

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const s = useMemo(
    () => calculateMonthSummary(month, txns, budgets, categories, { budgets: allBudgets, txns: allTxns }),
    [month, txns, budgets, categories, allBudgets, allTxns],
  );

  // Trailing 6 months ending at the active month.
  const trend = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => addMonths(month, i - 5));
    return monthlyTotals(allTxns, months);
  }, [allTxns, month]);

  // Expense composition for the donut.
  const slices = useMemo<Slice[]>(
    () =>
      s.categories
        .filter((c) => c.spent > 0)
        .map((c) => ({
          name: catMap.get(c.categoryId)?.name ?? 'Lain-lain',
          value: c.spent,
          color: catMap.get(c.categoryId)?.color ?? '#ccc',
        })),
    [s.categories, catMap],
  );

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
      {/* headline: net */}
      <div className="rounded-xl bg-gray-900 p-5 text-white">
        <p className="text-xs text-gray-400">Net bulan ini</p>
        <p className={`mt-1 text-3xl font-bold ${netPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          <Money amount={s.net} />
        </p>
        <div className="mt-3 flex gap-6 text-sm">
          <span>
            <span className="text-gray-400">Masuk</span>{' '}
            <Money amount={s.totalIncome} className="text-emerald-400" />
          </span>
          <span>
            <span className="text-gray-400">Keluar</span>{' '}
            <Money amount={s.totalExpense} className="text-red-400" />
          </span>
        </div>
      </div>

      {/* stat row */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Sisa dibelanjakan">
          <span className={s.remainingToSpend < 0 ? 'text-red-600' : 'text-emerald-600'}>
            <Money amount={s.remainingToSpend} />
          </span>
        </Stat>
        <Stat label="Tabungan">{s.savingsRate === null ? '—' : `${Math.round(s.savingsRate * 100)}%`}</Stat>
        <Stat label="Budget terpakai">
          {s.adherence === null ? '—' : `${Math.round(s.adherence * 100)}%`}
        </Stat>
      </div>

      {/* spending trend (6 months) */}
      <section>
        <h2 className="mb-1 text-sm font-semibold">Tren 6 bulan</h2>
        <TrendChart data={trend} />
      </section>

      {/* expense composition */}
      {slices.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-semibold">Komposisi pengeluaran</h2>
          <BreakdownChart data={slices} />
        </section>
      )}

      {/* per-category, worst-first */}
      <section>
        <h2 className="mb-2 text-sm font-semibold">Budget per kategori</h2>
        {s.categories.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-400">
            Belum ada pengeluaran atau budget bulan ini.
          </p>
        )}
        <ul className="space-y-3">
          {s.categories.map((row) => {
            const cat = catMap.get(row.categoryId);
            const rawBudget = budgets.find((b) => b.categoryId === row.categoryId && b.month === month)?.amount ?? 0;
            const carry = row.budget - rawBudget;
            const width = Math.min(100, Math.round(row.pctUsed * 100));
            return (
              <li key={row.categoryId}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ background: cat?.color ?? '#ccc' }} />
                    {cat?.name ?? 'Lain-lain'}
                    {row.unbudgeted && <span className="text-xs text-amber-600">· tanpa budget</span>}
                  </span>
                  <span className={`tabular-nums ${row.overBudget ? 'font-semibold text-red-600' : 'text-gray-500'}`}>
                    <Money amount={row.spent} />
                    {row.budget > 0 && <span className="text-gray-400"> / <Money amount={row.budget} /></span>}
                  </span>
                </div>
                {row.budget > 0 && (
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className={`h-full ${BAR[row.status]}`} style={{ width: `${width}%` }} />
                  </div>
                )}
                {row.overBudget && (
                  <p className="mt-0.5 text-xs font-medium text-red-600">
                    Lewat budget <Money amount={Math.abs(row.remaining)} />
                  </p>
                )}
                {carry !== 0 && (
                  <p className={`mt-0.5 text-xs ${carry > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    termasuk carry-over {carry > 0 ? '+' : '−'}
                    <Money amount={Math.abs(carry)} />
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        {s.unbudgetedSpend > 0 && (
          <p className="mt-3 text-xs text-gray-400">
            Pengeluaran tanpa budget: <Money amount={s.unbudgetedSpend} />
          </p>
        )}
      </section>
    </div>
  );
}
