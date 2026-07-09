import type { Budget, Category, Transaction } from '../../domain/schemas';

/**
 * Repository interfaces — the seam that keeps the UI and domain independent of
 * IndexedDB. A future cloud-sync backend implements these same interfaces and
 * is swapped in at the composition root (data/index.ts); no feature or domain
 * code changes.
 */

export interface CategoryRepo {
  all(): Promise<Category[]>;
  active(): Promise<Category[]>; // non-archived
  put(category: Category): Promise<void>;
  archive(id: string): Promise<void>;
}

export interface TransactionRepo {
  byMonth(month: string): Promise<Transaction[]>;
  all(): Promise<Transaction[]>;
  put(txn: Transaction): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface BudgetRepo {
  byMonth(month: string): Promise<Budget[]>;
  upsert(budget: Budget): Promise<void>;
}
