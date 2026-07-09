import type { FinansialDB } from '../../db';
import type { Budget, Category, Transaction } from '../../../domain/schemas';
import type { BudgetRepo, CategoryRepo, TransactionRepo } from '../types';

/** IndexedDB-backed implementations of the repository interfaces. */

export function createCategoryRepo(db: FinansialDB): CategoryRepo {
  return {
    all: () => db.categories.orderBy('sortOrder').toArray(),
    active: async () =>
      (await db.categories.orderBy('sortOrder').toArray()).filter((c) => !c.archived),
    put: async (category: Category) => {
      await db.categories.put(category);
    },
    archive: async (id: string) => {
      await db.categories.update(id, { archived: true });
    },
  };
}

export function createTransactionRepo(db: FinansialDB): TransactionRepo {
  return {
    byMonth: (month: string) => db.transactions.where('month').equals(month).toArray(),
    all: () => db.transactions.toArray(),
    put: async (txn: Transaction) => {
      await db.transactions.put(txn);
    },
    remove: async (id: string) => {
      await db.transactions.delete(id);
    },
  };
}

export function createBudgetRepo(db: FinansialDB): BudgetRepo {
  return {
    byMonth: (month: string) => db.budgets.where('month').equals(month).toArray(),
    upsert: async (budget: Budget) => {
      await db.budgets.put(budget);
    },
  };
}
