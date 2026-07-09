import type { FinansialDB } from '../../db';
import type { Budget, Category, RecurringRule, Transaction } from '../../../domain/schemas';
import type { BudgetRepo, CategoryRepo, RecurringRepo, TransactionRepo } from '../types';

/**
 * IndexedDB-backed implementations. Rows carry `updatedAt` (for sync LWW) and
 * deletes are **soft** (`deletedAt` tombstone) so they can propagate to other
 * devices; queries filter tombstoned rows out.
 */

const now = () => new Date().toISOString();
const live = <T extends { deletedAt?: string }>(rows: T[]) => rows.filter((r) => !r.deletedAt);

export function createCategoryRepo(db: FinansialDB): CategoryRepo {
  return {
    all: async () => live(await db.categories.orderBy('sortOrder').toArray()),
    active: async () =>
      live(await db.categories.orderBy('sortOrder').toArray()).filter((c) => !c.archived),
    put: async (category: Category) => {
      await db.categories.put({ ...category, updatedAt: now() });
    },
    archive: async (id: string) => {
      await db.categories.update(id, { archived: true, updatedAt: now() });
    },
  };
}

export function createTransactionRepo(db: FinansialDB): TransactionRepo {
  return {
    byMonth: async (month: string) =>
      live(await db.transactions.where('month').equals(month).toArray()),
    all: async () => live(await db.transactions.toArray()),
    put: async (txn: Transaction) => {
      await db.transactions.put(txn);
    },
    remove: async (id: string) => {
      const row = await db.transactions.get(id);
      if (!row) return;
      await db.transactions.put({ ...row, deletedAt: now(), updatedAt: now() });
    },
  };
}

export function createBudgetRepo(db: FinansialDB): BudgetRepo {
  return {
    byMonth: async (month: string) =>
      live(await db.budgets.where('month').equals(month).toArray()),
    upsert: async (budget: Budget) => {
      await db.budgets.put(budget);
    },
  };
}

export function createRecurringRepo(db: FinansialDB): RecurringRepo {
  return {
    all: async () => live(await db.recurringRules.toArray()),
    put: async (rule: RecurringRule) => {
      await db.recurringRules.put(rule);
    },
    remove: async (id: string) => {
      const row = await db.recurringRules.get(id);
      if (!row) return;
      await db.recurringRules.put({ ...row, deletedAt: now(), updatedAt: now() });
    },
  };
}
