import { useMemo, useState } from 'react';
import { useUiStore } from '../../store/ui';
import { useActiveCategories } from '../../hooks/useCategories';
import { useDeleteTransaction, useSaveTransaction, useTransactions } from '../../hooks/useTransactions';
import { useRecurringRules } from '../../hooks/useRecurring';
import { buildRecurringTransaction, pendingRules } from '../../domain/recurring';
import { Money } from '../../components/Money';
import { TransactionForm } from './TransactionForm';
import { makeTransaction, type TxnInput } from './model';
import type { Transaction } from '../../domain/schemas';

type Editing = { mode: 'new' } | { mode: 'edit'; txn: Transaction } | null;

export function TransactionsScreen() {
  const month = useUiStore((s) => s.activeMonth);
  const { data: txns = [] } = useTransactions(month);
  const { data: categories = [] } = useActiveCategories();
  const { data: rules = [] } = useRecurringRules();
  const save = useSaveTransaction();
  const del = useDeleteTransaction();
  const [editing, setEditing] = useState<Editing>(null);

  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const pending = useMemo(() => pendingRules(rules, txns, month), [rules, txns, month]);

  function postPending() {
    for (const rule of pending) save.mutate(buildRecurringTransaction(rule, month));
  }

  const { income, expense } = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of txns) {
      if (t.isTransfer) continue;
      if (t.type === 'income') income += t.amount;
      else expense += t.refundOf ? -t.amount : t.amount;
    }
    return { income, expense };
  }, [txns]);

  function handleSubmit(input: TxnInput) {
    const existing = editing?.mode === 'edit' ? editing.txn : undefined;
    save.mutate(makeTransaction(input, existing));
    setEditing(null);
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">Bulan {month}</p>
          <p className="text-lg font-bold">
            Net <Money amount={income - expense} className={income - expense >= 0 ? 'text-emerald-600' : 'text-red-600'} />
          </p>
          <p className="text-xs text-gray-500">
            Masuk <Money amount={income} /> · Keluar <Money amount={expense} />
          </p>
        </div>
        <button
          onClick={() => setEditing({ mode: 'new' })}
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
        >
          + Catat
        </button>
      </header>

      {pending.length > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          <span className="text-amber-800">{pending.length} transaksi rutin untuk bulan ini</span>
          <button
            onClick={postPending}
            className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 font-semibold text-white"
          >
            Tambahkan
          </button>
        </div>
      )}

      {editing && (
        <div className="relative z-10 rounded-xl border border-gray-200 p-4 shadow-sm mb-20">
          <h2 className="mb-3 text-sm font-semibold">
            {editing.mode === 'edit' ? 'Edit transaksi' : 'Transaksi baru'}
          </h2>
          <TransactionForm
            categories={categories}
            initial={editing.mode === 'edit' ? editing.txn : undefined}
            onSubmit={handleSubmit}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      <ul className="divide-y divide-gray-100">
        {txns.length === 0 && (
          <li className="py-8 text-center text-sm text-gray-400">Belum ada transaksi bulan ini.</li>
        )}
        {txns.map((t) => {
          const cat = catName.get(t.categoryId);
          return (
            <li key={t.id} className="flex items-center gap-3 py-3">
              <span className="inline-block h-8 w-1 rounded" style={{ background: cat?.color ?? '#ccc' }} />
              <button className="flex-1 text-left" onClick={() => setEditing({ mode: 'edit', txn: t })}>
                <p className="text-sm font-medium">
                  {cat?.name ?? 'Lain-lain'} {t.isTransfer && <span className="text-xs text-gray-400">· transfer</span>}
                </p>
                <p className="text-xs text-gray-400">
                  {t.date} · {t.paymentMethod}
                  {t.note ? ` · ${t.note}` : ''}
                </p>
              </button>
              <Money
                amount={t.amount}
                signed={t.isTransfer ? undefined : t.type}
                className={`text-sm font-semibold tabular-nums ${
                  t.isTransfer ? 'text-gray-400' : t.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                }`}
              />
              <button
                onClick={() => {
                  if (window.confirm('Hapus transaksi ini?')) del.mutate(t.id);
                }}
                aria-label="Hapus"
                className="text-gray-300 hover:text-red-500"
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
