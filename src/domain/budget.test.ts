import { describe, expect, it } from 'vitest';
import { calculateCategoryStatus, calculateMonthSummary, expenseSpentByCategory } from './budget';
import { budgetId, type Budget, type Category, type Transaction } from './schemas';

const NOW = '2026-07-01T00:00:00.000Z';
const MONTH = '2026-07';

function txn(p: Partial<Transaction> & Pick<Transaction, 'type' | 'amount' | 'categoryId'>): Transaction {
  return {
    id: p.id ?? crypto.randomUUID(),
    type: p.type,
    date: p.date ?? '2026-07-10',
    month: p.month ?? MONTH,
    amount: p.amount,
    categoryId: p.categoryId,
    paymentMethod: p.paymentMethod ?? 'cash',
    note: p.note,
    isTransfer: p.isTransfer ?? false,
    refundOf: p.refundOf,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function budget(categoryId: string, amount: number): Budget {
  return {
    id: budgetId(MONTH, categoryId),
    month: MONTH,
    categoryId,
    amount,
    rollover: false,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function expenseCat(id: string): Category {
  return { id, name: id, type: 'expense', archived: false, isDefault: false, sortOrder: 0, createdAt: NOW };
}

describe('calculateCategoryStatus', () => {
  it('spent exactly at budget is on_track, not over', () => {
    const s = calculateCategoryStatus('c', 1_000_000, 1_000_000);
    expect(s.overBudget).toBe(false);
    expect(s.remaining).toBe(0);
    expect(s.status).toBe('on_track');
  });

  it('flags warning at >= 90% used', () => {
    expect(calculateCategoryStatus('c', 1_200_000, 1_150_000).status).toBe('warning');
  });

  it('flags over_budget when spent exceeds budget', () => {
    const s = calculateCategoryStatus('c', 500_000, 700_000);
    expect(s.overBudget).toBe(true);
    expect(s.remaining).toBe(-200_000);
    expect(s.status).toBe('over_budget');
  });

  it('no budget => unbudgeted, pctUsed 0', () => {
    const s = calculateCategoryStatus('c', 0, 400_000);
    expect(s.unbudgeted).toBe(true);
    expect(s.pctUsed).toBe(0);
    expect(s.overBudget).toBe(false);
  });
});

// The worked July 2026 example from docs/PLAN.md — the canonical fixture.
describe('calculateMonthSummary — July 2026 worked example', () => {
  const categories = [
    'cat-makan',
    'cat-transport',
    'cat-tagihan',
    'cat-hiburan',
    'cat-belanja',
    'cat-kesehatan',
  ].map(expenseCat);

  const budgets = [
    budget('cat-makan', 2_000_000),
    budget('cat-transport', 800_000),
    budget('cat-tagihan', 1_200_000),
    budget('cat-hiburan', 500_000),
    budget('cat-belanja', 1_000_000),
  ];

  const belanja1 = txn({ id: 'belanja-1', type: 'expense', categoryId: 'cat-belanja', amount: 1_200_000 });
  const txns: Transaction[] = [
    txn({ type: 'income', categoryId: 'cat-gaji', amount: 12_000_000, date: '2026-07-01' }),
    txn({ type: 'expense', categoryId: 'cat-tagihan', amount: 1_150_000 }),
    txn({ type: 'expense', categoryId: 'cat-makan', amount: 350_000 }),
    // transfer to savings — must be excluded from every total
    txn({ type: 'expense', categoryId: 'cat-lain', amount: 3_000_000, isTransfer: true }),
    txn({ type: 'expense', categoryId: 'cat-makan', amount: 600_000 }),
    txn({ type: 'expense', categoryId: 'cat-transport', amount: 300_000 }),
    txn({ type: 'expense', categoryId: 'cat-hiburan', amount: 250_000 }),
    belanja1,
    // refund of belanja1 — nets belanja down to its cap
    txn({ type: 'expense', categoryId: 'cat-belanja', amount: 200_000, refundOf: 'belanja-1' }),
    txn({ type: 'expense', categoryId: 'cat-makan', amount: 700_000 }),
    txn({ type: 'expense', categoryId: 'cat-transport', amount: 250_000 }),
    // unbudgeted spend
    txn({ type: 'expense', categoryId: 'cat-kesehatan', amount: 400_000 }),
  ];

  const s = calculateMonthSummary(MONTH, txns, budgets, categories);

  it('totals match the plan', () => {
    expect(s.totalIncome).toBe(12_000_000);
    expect(s.totalExpense).toBe(5_000_000);
    expect(s.net).toBe(7_000_000);
    expect(s.totalBudget).toBe(5_500_000);
    expect(s.budgetedExpense).toBe(4_600_000);
    expect(s.remainingToSpend).toBe(900_000);
    expect(s.unbudgetedSpend).toBe(400_000);
  });

  it('savings rate and adherence', () => {
    expect(s.savingsRate).toBeCloseTo(0.5833, 3);
    expect(s.adherence).toBeCloseTo(0.8364, 3);
  });

  it('refund nets belanja to exactly its cap', () => {
    const belanja = s.categories.find((c) => c.categoryId === 'cat-belanja')!;
    expect(belanja.spent).toBe(1_000_000);
    expect(belanja.remaining).toBe(0);
    expect(belanja.overBudget).toBe(false);
  });

  it('transfer is excluded from expense', () => {
    // 3,000,000 transfer never appears anywhere
    expect(s.totalExpense).toBe(5_000_000);
    expect(s.categories.find((c) => c.categoryId === 'cat-lain')).toBeUndefined();
  });

  it('kesehatan is unbudgeted (excluded from adherence, present as leakage)', () => {
    const kes = s.categories.find((c) => c.categoryId === 'cat-kesehatan')!;
    expect(kes.unbudgeted).toBe(true);
    expect(kes.spent).toBe(400_000);
  });

  it('expenseSpentByCategory nets refunds and excludes transfers', () => {
    const spent = expenseSpentByCategory(MONTH, txns);
    expect(spent.get('cat-makan')).toBe(1_650_000);
    expect(spent.get('cat-belanja')).toBe(1_000_000); // 1.2M - 200k refund
    expect(spent.has('cat-lain')).toBe(false); // the transfer is excluded
    expect(spent.get('cat-gaji')).toBeUndefined(); // income not counted
  });
});
