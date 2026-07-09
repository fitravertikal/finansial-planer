import { db } from './db';
import {
  createBudgetRepo,
  createCategoryRepo,
  createTransactionRepo,
} from './repositories/dexie/repos';
import { defaultCategories } from '../domain/categories';
import { SCHEMA_VERSION, type AppMeta } from '../domain/schemas';

/**
 * Composition root: wires the concrete IndexedDB repositories to the app. To
 * add cloud sync later, swap these factory calls for sync-backed
 * implementations — nothing else changes.
 */
export const categoryRepo = createCategoryRepo(db);
export const transactionRepo = createTransactionRepo(db);
export const budgetRepo = createBudgetRepo(db);

export { db };

/** Seed app metadata + default categories on first run (idempotent). */
export async function seedIfEmpty(): Promise<void> {
  const existing = await db.meta.get('app');
  if (existing) return;

  const now = new Date().toISOString();
  const meta: AppMeta = {
    id: 'app',
    schemaVersion: SCHEMA_VERSION,
    currency: 'IDR',
    defaultPaymentMethod: 'cash',
    createdAt: now,
  };

  await db.transaction('rw', db.meta, db.categories, async () => {
    await db.meta.put(meta);
    const count = await db.categories.count();
    if (count === 0) await db.categories.bulkAdd(defaultCategories(now));
  });
}
