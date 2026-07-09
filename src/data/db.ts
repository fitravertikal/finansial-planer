import Dexie, { type Table } from 'dexie';
import type { AppMeta, Budget, Category, Transaction } from '../domain/schemas';

/**
 * IndexedDB (via Dexie) is the local source of truth. Indexes are chosen to
 * serve the actual queries: "this month", "this category this month",
 * "income vs expense this month". `archived` is intentionally NOT indexed —
 * IndexedDB can't key on booleans — so it's filtered in memory instead.
 */
export class FinansialDB extends Dexie {
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;
  budgets!: Table<Budget, string>;
  meta!: Table<AppMeta, string>;

  constructor(name = 'finansial-planer') {
    super(name);
    this.version(1).stores({
      transactions: 'id, month, categoryId, date, [month+categoryId], [month+type]',
      categories: 'id, type, sortOrder',
      budgets: 'id, month, [month+categoryId]',
      meta: 'id',
    });
  }
}

export const db = new FinansialDB();
