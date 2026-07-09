import { monthOf } from '../../domain/dates';
import { Transaction, type PaymentMethod, type TxnType } from '../../domain/schemas';

export interface TxnInput {
  type: TxnType;
  date: string; // YYYY-MM-DD
  amount: number; // whole rupiah
  categoryId: string;
  paymentMethod: PaymentMethod;
  note?: string;
  isTransfer?: boolean;
}

/**
 * Build a valid Transaction from form input. On edit, pass the existing row to
 * preserve its id/createdAt and bump updatedAt. `month` is always derived from
 * `date` so it stays consistent. Validated through the Zod schema before return.
 */
export function makeTransaction(input: TxnInput, existing?: Transaction): Transaction {
  const now = new Date().toISOString();
  const draft: Transaction = {
    id: existing?.id ?? crypto.randomUUID(),
    type: input.type,
    date: input.date,
    month: monthOf(input.date),
    amount: input.amount,
    categoryId: input.categoryId,
    paymentMethod: input.paymentMethod,
    note: input.note?.trim() ? input.note.trim() : undefined,
    isTransfer: input.isTransfer ?? false,
    refundOf: existing?.refundOf,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  return Transaction.parse(draft);
}
