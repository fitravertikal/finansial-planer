import type { FinansialDB } from '../../db';
import type { Budget, Category, RecurringRule, Transaction } from '../../../domain/schemas';
import type { BudgetRepo, CategoryRepo, RecurringRepo, TransactionRepo } from '../types';

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

export function createRecurringRepo(db: FinansialDB): RecurringRepo {
  return {
    all: () => db.recurringRules.toArray(),
    put: async (rule: RecurringRule) => {
      await db.recurringRules.put(rule);
    },
    remove: async (id: string) => {
      await db.recurringRules.delete(id);
    },
  };
}
