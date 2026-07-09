import { useEffect, useState } from 'react';
import { categoryRepo, seedIfEmpty } from '../data';
import { currentMonth } from '../domain/dates';
import type { Category } from '../domain/schemas';

/**
 * M1 skeleton screen. The data layer (Dexie + seeding) is wired and verified
 * here; the real Dashboard / Transactions / Budgets UI arrives in M2–M4.
 */
export function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      await seedIfEmpty();
      setCategories(await categoryRepo.active());
      setReady(true);
    })();
  }, []);

  return (
    <main className="mx-auto max-w-xl p-6 font-sans">
      <h1 className="text-2xl font-bold text-emerald-700">Finansial Planer</h1>
      <p className="mt-1 text-sm text-gray-500">Bulan aktif: {currentMonth()}</p>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
          Kategori {ready ? `(${categories.length})` : '…'}
        </h2>
        <ul className="mt-2 grid grid-cols-2 gap-2">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: c.color }} />
              {c.name}
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-8 text-xs text-gray-400">
        M1 — data layer aktif (Dexie). Fitur pencatatan &amp; budget menyusul (M2–M4).
      </p>
    </main>
  );
}
