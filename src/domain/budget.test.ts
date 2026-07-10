import { describe, expect, it } from 'vitest';
import {
  calculateCategoryStatus,
  calculateMonthSummary,
  effectiveBudget,
  expenseSpentByCategory,
  monthlyTotals,
} from './budget';
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

  it('monthlyTotals returns income/expense per requested month, zero-filled', () => {
    const series = monthlyTotals(txns, ['2026-06', '2026-07']);
    expect(series).toHaveLength(2);
    expect(series[0]).toEqual({ month: '2026-06', income: 0, expense: 0 }); // no June data
    expect(series[1]).toEqual({ month: '2026-07', income: 12_000_000, expense: 5_000_000 });
  });
});

describe('effectiveBudget', () => {
  const CAT = 'cat-makan';

  function b(month: string, amount: number, rollover: boolean, rolloverSince?: string): Budget {
    return {
      id: budgetId(month, CAT),
      month,
      categoryId: CAT,
      amount,
      rollover,
      rolloverSince,
      createdAt: NOW,
      updatedAt: NOW,
    };
  }

  it('rollover off => effective budget is just the base amount', () => {
    const budgets = new Map([['2026-07', b('2026-07', 1_000_000, false)]]);
    const spent = new Map([['2026-07', 1_000_000_000]]); // irrelevant when rollover is off
    expect(effectiveBudget('2026-07', CAT, budgets, spent)).toBe(1_000_000);
  });

  it('starting month (month === rolloverSince) => base amount, no carry-in', () => {
    const budgets = new Map([['2026-07', b('2026-07', 1_000_000, true, '2026-07')]]);
    const spent = new Map([['2026-07', 700_000]]);
    expect(effectiveBudget('2026-07', CAT, budgets, spent)).toBe(1_000_000);
  });

  it('one month of surplus carries forward', () => {
    const budgets = new Map([
      ['2026-06', b('2026-06', 1_000_000, true, '2026-06')],
      ['2026-07', b('2026-07', 1_000_000, true, '2026-06')],
    ]);
    const spent = new Map([
      ['2026-06', 700_000], // 300k surplus
      ['2026-07', 0],
    ]);
    // July = 1,000,000 base + (1,000,000 - 700,000) carried from June = 1,300,000
    expect(effectiveBudget('2026-07', CAT, budgets, spent)).toBe(1_300_000);
  });

  it('3-month surplus chain accumulates', () => {
    const budgets = new Map([
      ['2026-05', b('2026-05', 1_000_000, true, '2026-05')],
      ['2026-06', b('2026-06', 1_000_000, true, '2026-05')],
      ['2026-07', b('2026-07', 1_000_000, true, '2026-05')],
    ]);
    const spent = new Map([
      ['2026-05', 800_000], // +200k
      ['2026-06', 900_000], // +100k on top of carried 1,200,000 => effective 1,200,000, spend 900k => +300k surplus
      ['2026-07', 0],
    ]);
    // May: effective 1,000,000 (start month)
    // June: 1,000,000 + (1,000,000 - 800,000) = 1,200,000 effective; spent 900,000 => surplus 300,000
    // July: 1,000,000 + (1,200,000 - 900,000) = 1,300,000
    expect(effectiveBudget('2026-07', CAT, budgets, spent)).toBe(1_300_000);
  });

  it('deficit chain reduces (can go negative) effective budget', () => {
    const budgets = new Map([
      ['2026-06', b('2026-06', 500_000, true, '2026-06')],
      ['2026-07', b('2026-07', 500_000, true, '2026-06')],
    ]);
    const spent = new Map([
      ['2026-06', 700_000], // 200k over
      ['2026-07', 0],
    ]);
    // July = 500,000 + (500,000 - 700,000) = 300,000
    expect(effectiveBudget('2026-07', CAT, budgets, spent)).toBe(300_000);
  });

  it('rollover enabled mid-history: prior-to-rolloverSince spend is ignored', () => {
    const budgets = new Map([
      ['2026-06', b('2026-06', 500_000, false)], // rollover was off in June
      ['2026-07', b('2026-07', 500_000, true, '2026-07')], // turned on starting July
    ]);
    const spent = new Map([
      ['2026-06', 5_000_000], // wildly over budget in June, but must NOT affect July
      ['2026-07', 0],
    ]);
    expect(effectiveBudget('2026-07', CAT, budgets, spent)).toBe(500_000);
  });

  it('missing budget row for an intervening month treats its base as 0, spend still counts', () => {
    const budgets = new Map([
      ['2026-06', b('2026-06', 1_000_000, true, '2026-06')],
      // 2026-07: no Budget row at all (category had no budget set that month)
      ['2026-08', b('2026-08', 1_000_000, true, '2026-06')],
    ]);
    const spent = new Map([
      ['2026-06', 800_000], // +200k
      ['2026-07', 100_000], // no budget row => base 0, so this month contributes 0 - 100,000 = -100,000
      ['2026-08', 0],
    ]);
    // June: effective 1,000,000 (start), surplus 200,000
    // July: base 0 + carried 200,000 = 200,000 effective; spent 100,000 => surplus 100,000
    // August: 1,000,000 + 100,000 = 1,100,000
    expect(effectiveBudget('2026-08', CAT, budgets, spent)).toBe(1_100_000);
  });
});
