import { generateUUID } from '../../domain/uuid';
import { RecurringRule, type PaymentMethod, type TxnType } from '../../domain/schemas';

export interface RuleInput {
  type: TxnType;
  amount: number;
  categoryId: string;
  paymentMethod: PaymentMethod;
  note?: string;
  dayOfMonth: number;
  startMonth: string;
}

/** Build a validated RecurringRule from form input. */
export function makeRecurringRule(input: RuleInput, existing?: RecurringRule): RecurringRule {
  const now = new Date().toISOString();
  return RecurringRule.parse({
    id: existing?.id ?? generateUUID(),
    type: input.type,
    amount: input.amount,
    categoryId: input.categoryId,
    paymentMethod: input.paymentMethod,
    note: input.note?.trim() ? input.note.trim() : undefined,
    dayOfMonth: input.dayOfMonth,
    startMonth: input.startMonth,
    endMonth: existing?.endMonth,
    active: existing?.active ?? true,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}
