import { generateUUID } from './uuid';
import type { RecurringRule, Transaction } from './schemas';

/**
 * Recurring-rule logic (pure). Rules are monthly templates; each month a rule
 * "applies to" produces one transaction, but only once the user confirms it
 * (confirm-first, so the ledger never drifts from reality). A generated
 * transaction carries recurringRuleId, which is how we know a rule has already
 * posted for a month.
 */

/** Is this rule active and in-range for the given 'YYYY-MM'? */
export function ruleAppliesToMonth(rule: RecurringRule, month: string): boolean {
  if (!rule.active) return false;
  if (month < rule.startMonth) return false;
  if (rule.endMonth && month > rule.endMonth) return false;
  return true;
}

/** Rules that apply to `month` but have not yet posted a transaction there. */
export function pendingRules(
  rules: RecurringRule[],
  monthTransactions: Transaction[],
  month: string,
): RecurringRule[] {
  const posted = new Set(
    monthTransactions.filter((t) => t.recurringRuleId).map((t) => t.recurringRuleId),
  );
  return rules.filter((r) => ruleAppliesToMonth(r, month) && !posted.has(r.id));
}

/** Materialize a rule into a concrete transaction for a month. */
export function buildRecurringTransaction(
  rule: RecurringRule,
  month: string,
  now: string = new Date().toISOString(),
): Transaction {
  const day = String(rule.dayOfMonth).padStart(2, '0');
  return {
    id: generateUUID(),
    type: rule.type,
    date: `${month}-${day}`,
    month,
    amount: rule.amount,
    categoryId: rule.categoryId,
    paymentMethod: rule.paymentMethod,
    note: rule.note,
    isTransfer: false,
    recurringRuleId: rule.id,
    createdAt: now,
    updatedAt: now,
  };
}
