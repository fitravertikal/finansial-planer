import { useMemo, useState } from 'react';
import { useUiStore } from '../../store/ui';
import { useActiveCategories } from '../../hooks/useCategories';
import { useDeleteRule, useRecurringRules, useSaveRule } from '../../hooks/useRecurring';
import { groupDigits, parseAmountInput } from '../../domain/money';
import { Money } from '../../components/Money';
import { makeRecurringRule } from './model';
import type { PaymentMethod, TxnType } from '../../domain/schemas';

export function RecurringScreen() {
  const month = useUiStore((s) => s.activeMonth);
  const { data: rules = [] } = useRecurringRules();
  const { data: categories = [] } = useActiveCategories();
  const save = useSaveRule();
  const del = useDeleteRule();

  const [type, setType] = useState<TxnType>('expense');
  const [amount, setAmount] = useState(0);
  const [categoryId, setCategoryId] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('transfer');
  const [day, setDay] = useState(1);
  const [note, setNote] = useState('');

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const options = useMemo(() => categories.filter((c) => c.type === type), [categories, type]);
  const effectiveCat = options.some((c) => c.id === categoryId) ? categoryId : (options[0]?.id ?? '');
  const canAdd = amount > 0 && effectiveCat !== '';

  function add() {
    if (!canAdd) return;
    save.mutate(
      makeRecurringRule({
        type,
        amount,
        categoryId: effectiveCat,
        paymentMethod: method,
        note,
        dayOfMonth: day,
        startMonth: month,
      }),
    );
    setAmount(0);
    setNote('');
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 p-4 space-y-3">
        <h2 className="text-sm font-semibold">Transaksi rutin baru</h2>
        <div className="grid grid-cols-2 gap-2">
          {(['expense', 'income'] as TxnType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`rounded-lg py-2 text-sm font-semibold ${
                type === t ? (t === 'expense' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white') : 'bg-gray-100 text-gray-600'
              }`}
            >
              {t === 'expense' ? 'Pengeluaran' : 'Pemasukan'}
            </button>
          ))}
        </div>
        <input
          inputMode="numeric"
          value={groupDigits(amount)}
          onChange={(e) => setAmount(parseAmountInput(e.target.value))}
          placeholder="Jumlah (Rp)"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-lg font-bold tabular-nums focus:border-emerald-500 focus:outline-none"
        />
        <select
          value={effectiveCat}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:outline-none"
        >
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2 text-sm">
          <label className="flex items-center gap-1">
            Tiap tanggal
            <input
              type="number"
              min={1}
              max={28}
              value={day}
              onChange={(e) => setDay(Math.min(28, Math.max(1, Number(e.target.value) || 1)))}
              className="w-16 rounded border border-gray-300 px-2 py-1 text-center"
            />
          </label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            className="rounded border border-gray-300 px-2 py-1"
          >
            <option value="cash">Cash</option>
            <option value="transfer">Transfer</option>
            <option value="ewallet">E-wallet</option>
          </select>
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Catatan (opsional)"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
        <button
          onClick={add}
          disabled={!canAdd}
          className="w-full rounded-lg bg-emerald-600 py-2.5 font-semibold text-white disabled:opacity-40"
        >
          Tambah aturan rutin
        </button>
      </div>

      <ul className="divide-y divide-gray-100">
        {rules.length === 0 && (
          <li className="py-8 text-center text-sm text-gray-400">Belum ada transaksi rutin.</li>
        )}
        {rules.map((r) => {
          const cat = catMap.get(r.categoryId);
          return (
            <li key={r.id} className={`flex items-center gap-3 py-3 ${r.active ? '' : 'opacity-40'}`}>
              <span className="inline-block h-8 w-1 rounded" style={{ background: cat?.color ?? '#ccc' }} />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {cat?.name ?? '—'} <span className="text-xs text-gray-400">· tiap tgl {r.dayOfMonth}</span>
                </p>
                <p className="text-xs text-gray-400">
                  {r.type === 'income' ? 'Pemasukan' : 'Pengeluaran'} · {r.paymentMethod}
                  {r.note ? ` · ${r.note}` : ''}
                </p>
              </div>
              <Money
                amount={r.amount}
                className={`text-sm font-semibold tabular-nums ${r.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}
              />
              <button
                onClick={() => save.mutate({ ...r, active: !r.active, updatedAt: new Date().toISOString() })}
                className="text-xs text-gray-400 hover:text-emerald-600"
              >
                {r.active ? 'jeda' : 'aktifkan'}
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Hapus aturan rutin ini?')) del.mutate(r.id);
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
