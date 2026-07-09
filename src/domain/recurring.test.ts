import { describe, expect, it } from 'vitest';
import { buildRecurringTransaction, pendingRules, ruleAppliesToMonth } from './recurring';
import type { RecurringRule, Transaction } from './schemas';

const NOW = '2026-07-01T00:00:00.000Z';

function rule(p: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: p.id ?? 'r1',
    type: p.type ?? 'income',
    amount: p.amount ?? 12_000_000,
    categoryId: p.categoryId ?? 'cat-gaji',
    paymentMethod: p.paymentMethod ?? 'transfer',
    note: p.note,
    dayOfMonth: p.dayOfMonth ?? 1,
    startMonth: p.startMonth ?? '2026-01',
    endMonth: p.endMonth,
    active: p.active ?? true,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe('ruleAppliesToMonth', () => {
  it('respects active + start/end range', () => {
    expect(ruleAppliesToMonth(rule(), '2026-07')).toBe(true);
    expect(ruleAppliesToMonth(rule({ active: false }), '2026-07')).toBe(false);
    expect(ruleAppliesToMonth(rule({ startMonth: '2026-08' }), '2026-07')).toBe(false);
    expect(ruleAppliesToMonth(rule({ endMonth: '2026-06' }), '2026-07')).toBe(false);
    expect(ruleAppliesToMonth(rule({ endMonth: '2026-07' }), '2026-07')).toBe(true);
  });
});

describe('buildRecurringTransaction', () => {
  it('materializes with padded date, month and back-reference', () => {
    const t = buildRecurringTransaction(rule({ dayOfMonth: 5 }), '2026-07', NOW);
    expect(t.date).toBe('2026-07-05');
    expect(t.month).toBe('2026-07');
    expect(t.recurringRuleId).toBe('r1');
    expect(t.amount).toBe(12_000_000);
    expect(t.type).toBe('income');
  });
});

describe('pendingRules', () => {
  const r = rule({ id: 'gaji' });
  const txn = (recurringRuleId?: string): Transaction => ({
    id: 't', type: 'income', date: '2026-07-01', month: '2026-07', amount: 1,
    categoryId: 'c', paymentMethod: 'cash', isTransfer: false, recurringRuleId,
    createdAt: NOW, updatedAt: NOW,
  });

  it('is pending when the rule has not posted this month', () => {
    expect(pendingRules([r], [], '2026-07').map((x) => x.id)).toEqual(['gaji']);
  });

  it('drops once a transaction with its id exists', () => {
    expect(pendingRules([r], [txn('gaji')], '2026-07')).toEqual([]);
  });

  it('ignores out-of-range months', () => {
    expect(pendingRules([rule({ id: 'x', startMonth: '2026-09' })], [], '2026-07')).toEqual([]);
  });
});
