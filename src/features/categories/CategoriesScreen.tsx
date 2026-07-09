import { useState, useRef, useCallback } from 'react';
import { useArchiveCategory, useCategories, useSaveCategory } from '../../hooks/useCategories';
import { FALLBACK_EXPENSE_CATEGORY_ID } from '../../domain/categories';
import type { Category, TxnType } from '../../domain/schemas';

export function CategoriesScreen() {
  const { data: categories = [] } = useCategories();
  const save = useSaveCategory();
  const archive = useArchiveCategory();
  const [name, setName] = useState('');
  const [type, setType] = useState<TxnType>('expense');
  const [savedId, setSavedId] = useState<string | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showFeedback = useCallback((id: string) => {
    setSavedId(id);
    clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setSavedId(null), 1500);
  }, []);

  function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const maxOrder = categories.reduce((m, c) => Math.max(m, c.sortOrder), 0);
    const category: Category = {
      id: crypto.randomUUID(),
      name: trimmed,
      type,
      archived: false,
      isDefault: false,
      sortOrder: maxOrder + 1,
      createdAt: new Date().toISOString(),
    };
    save.mutate(category);
    setName('');
  }

  function rename(cat: Category, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === cat.name) return;
    save.mutate({ ...cat, name: trimmed });
    showFeedback(cat.id);
  }

  const groups: { label: string; type: TxnType }[] = [
    { label: 'Pengeluaran', type: 'expense' },
    { label: 'Pemasukan', type: 'income' },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 p-4">
        <h2 className="mb-2 text-sm font-semibold">Tambah kategori</h2>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Nama kategori"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:outline-none"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TxnType)}
            className="rounded-lg border border-gray-300 px-2 py-2"
          >
            <option value="expense">Keluar</option>
            <option value="income">Masuk</option>
          </select>
          <button onClick={add} className="rounded-lg bg-emerald-600 px-4 font-semibold text-white">
            +
          </button>
        </div>
      </div>

      {groups.map((g) => (
        <section key={g.type}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{g.label}</h3>
          <ul className="divide-y divide-gray-100">
            {categories
              .filter((c) => c.type === g.type)
              .map((c) => (
                <li key={c.id} className={`flex items-center gap-3 py-2.5 ${c.archived ? 'opacity-40' : ''}`}>
                  <span className="inline-block h-4 w-4 rounded-full" style={{ background: c.color ?? '#ccc' }} />
                  <input
                    defaultValue={c.name}
                    onBlur={(e) => rename(c, e.target.value)}
                    className="flex-1 bg-transparent text-sm focus:outline-none"
                  />
                  {savedId === c.id && (
                    <span className="text-xs text-emerald-600 animate-pulse">tersimpan</span>
                  )}
                  {!c.archived && c.id !== FALLBACK_EXPENSE_CATEGORY_ID && (
                    <button
                      onClick={() => {
                        if (window.confirm('Arsipkan kategori ini?')) archive.mutate(c.id);
                      }}
                      className="text-xs text-gray-400 hover:text-red-500"
                    >
                      arsipkan
                    </button>
                  )}
                  {c.archived && <span className="text-xs text-gray-400">diarsipkan</span>}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
