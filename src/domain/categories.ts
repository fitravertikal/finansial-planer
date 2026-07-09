import type { Category } from './schemas';

/**
 * Default Indonesian categories seeded on first run so the app is usable
 * immediately. Ids are stable slugs (not random UUIDs) so they're identical
 * across devices and survive export/import without duplication. Categories
 * are fully user-editable afterwards.
 *
 * 'cat-lain' (Lain-lain) is the permanent expense fallback so no transaction
 * is ever orphaned.
 */

type Seed = Pick<Category, 'id' | 'name' | 'type' | 'color'>;

const EXPENSE: Seed[] = [
  { id: 'cat-makan', name: 'Makan & Minum', type: 'expense', color: '#e63946' },
  { id: 'cat-transport', name: 'Transport', type: 'expense', color: '#f4a261' },
  { id: 'cat-tagihan', name: 'Tagihan & Utilitas', type: 'expense', color: '#2a9d8f' },
  { id: 'cat-belanja', name: 'Belanja', type: 'expense', color: '#e76f51' },
  { id: 'cat-hiburan', name: 'Hiburan', type: 'expense', color: '#8250df' },
  { id: 'cat-kesehatan', name: 'Kesehatan', type: 'expense', color: '#06d6a0' },
  { id: 'cat-pendidikan', name: 'Pendidikan', type: 'expense', color: '#118ab2' },
  { id: 'cat-sosial', name: 'Keluarga & Sosial', type: 'expense', color: '#ef476f' },
  { id: 'cat-cicilan', name: 'Cicilan & Pinjaman', type: 'expense', color: '#d62828' },
  { id: 'cat-asuransi', name: 'Asuransi', type: 'expense', color: '#457b9d' },
  { id: 'cat-rumah', name: 'Rumah / Kos', type: 'expense', color: '#264653' },
  { id: 'cat-lain', name: 'Lain-lain', type: 'expense', color: '#6c757d' },
];

const INCOME: Seed[] = [
  { id: 'cat-gaji', name: 'Gaji', type: 'income', color: '#1a7f37' },
  { id: 'cat-bonus', name: 'Bonus / THR', type: 'income', color: '#40c057' },
  { id: 'cat-usaha', name: 'Usaha / Freelance', type: 'income', color: '#2b8a3e' },
  { id: 'cat-investasi', name: 'Investasi', type: 'income', color: '#087f5b' },
  { id: 'cat-hadiah', name: 'Hadiah / Lainnya', type: 'income', color: '#66a80f' },
];

/** The non-deletable fallback expense category id. */
export const FALLBACK_EXPENSE_CATEGORY_ID = 'cat-lain';

/** Build the full seed list with defaults filled in, ordered as declared. */
export function defaultCategories(now: string = new Date().toISOString()): Category[] {
  return [...EXPENSE, ...INCOME].map((seed, index) => ({
    ...seed,
    archived: false,
    isDefault: true,
    sortOrder: index,
    createdAt: now,
  }));
}
