import { Budget, budgetId } from '../../domain/schemas';

/** Build/patch a monthly per-category budget row, validated via Zod. */
export function makeBudget(
  month: string,
  categoryId: string,
  amount: number,
  existing?: Budget,
): Budget {
  const now = new Date().toISOString();
  return Budget.parse({
    id: budgetId(month, categoryId),
    month,
    categoryId,
    amount,
    rollover: existing?.rollover ?? false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}
