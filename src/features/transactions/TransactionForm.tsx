import { useMemo, useState } from 'react';
import { groupDigits, parseAmountInput } from '../../domain/money';
import { todayISO } from '../../domain/dates';
import type { Category, PaymentMethod, Transaction, TxnType } from '../../domain/schemas';
import type { TxnInput } from './model';

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: '💵 Cash' },
  { value: 'transfer', label: '🏦 Transfer' },
  { value: 'ewallet', label: '📱 E-wallet' },
];

/**
 * The <10s logging flow. Amount is the first focused field; category is filtered
 * to the chosen type; payment method is three big chips. Note never blocks save.
 */
export function TransactionForm({
  categories,
  initial,
  onSubmit,
  onCancel,
}: {
  categories: Category[];
  initial?: Transaction;
  onSubmit: (input: TxnInput) => void;
  onCancel?: () => void;
}) {
  const [type, setType] = useState<TxnType>(initial?.type ?? 'expense');
  const [amount, setAmount] = useState<number>(initial?.amount ?? 0);
  const [categoryId, setCategoryId] = useState<string>(initial?.categoryId ?? '');
  const [method, setMethod] = useState<PaymentMethod>(initial?.paymentMethod ?? 'cash');
  const [date, setDate] = useState<string>(initial?.date ?? todayISO());
  const [note, setNote] = useState<string>(initial?.note ?? '');
  const [isTransfer, setIsTransfer] = useState<boolean>(initial?.isTransfer ?? false);

  const options = useMemo(
    () => categories.filter((c) => c.type === type && !c.archived),
    [categories, type],
  );

  // Keep a valid category selected for the current type.
  const effectiveCategory = options.some((c) => c.id === categoryId)
    ? categoryId
    : (options[0]?.id ?? '');

  const canSave = amount > 0 && effectiveCategory !== '';

  function switchType(next: TxnType) {
    setType(next);
    setCategoryId(''); // fall back to first of the new type
  }

  function submit(e: React.FormEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!canSave) return;
    onSubmit({
      type,
      amount,
      categoryId: effectiveCategory,
      paymentMethod: method,
      date,
      note,
      isTransfer,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* type toggle */}
      <div className="grid grid-cols-2 gap-2">
        {(['expense', 'income'] as TxnType[]).map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => switchType(t)}
            className={`rounded-lg py-2 text-sm font-semibold ${
              type === t
                ? t === 'expense'
                  ? 'bg-red-600 text-white'
                  : 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {t === 'expense' ? 'Pengeluaran' : 'Pemasukan'}
          </button>
        ))}
      </div>

      {/* amount */}
      <label className="block">
        <span className="text-xs font-medium text-gray-500">Jumlah (Rp)</span>
        <input
          autoFocus
          inputMode="numeric"
          value={groupDigits(amount)}
          onChange={(e) => setAmount(parseAmountInput(e.target.value))}
          placeholder="0"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3 text-2xl font-bold tabular-nums focus:border-emerald-500 focus:outline-none"
        />
      </label>

      {/* category */}
      <label className="block">
        <span className="text-xs font-medium text-gray-500">Kategori</span>
        <select
          value={effectiveCategory}
          onChange={(e) => setCategoryId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
        >
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      {/* payment method */}
      <div>
        <span className="text-xs font-medium text-gray-500">Metode</span>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {METHODS.map((m) => (
            <button
              type="button"
              key={m.value}
              onClick={() => setMethod(m.value)}
              className={`rounded-lg py-2 text-sm ${
                method === m.value ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* date + note */}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Tanggal</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Catatan (opsional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="—"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:outline-none"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" checked={isTransfer} onChange={(e) => setIsTransfer(e.target.checked)} />
        Transfer antar akun sendiri (jangan hitung ke pemasukan/pengeluaran)
      </label>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={!canSave}
          className="flex-1 rounded-lg bg-emerald-600 py-3 font-semibold text-white disabled:opacity-40"
        >
          Simpan
        </button>
        {onCancel && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onCancel(); }} className="rounded-lg bg-gray-100 px-4 py-3 text-gray-600">
            Batal
          </button>
        )}
      </div>
    </form>
  );
}
