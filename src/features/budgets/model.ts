import { Budget, budgetId } from '../../domain/schemas';

/**
 * Build/patch a monthly per-category budget row, validated via Zod.
 * Pass `rolloverOverride` to explicitly turn rollover on/off (e.g. from a UI
 * toggle); omit it to preserve `existing`'s rollover state unchanged. Turning
 * rollover on (false -> true) stamps `rolloverSince` to `month`; turning it
 * off clears `rolloverSince` entirely — a later re-enable starts a fresh chain.
 */
export function makeBudget(
  month: string,
  categoryId: string,
  amount: number,
  existing?: Budget,
  rolloverOverride?: boolean,
): Budget {
  const now = new Date().toISOString();
  const rollover = rolloverOverride ?? existing?.rollover ?? false;
  const wasOn = existing?.rollover ?? false;
  const rolloverSince = rollover ? (wasOn ? existing?.rolloverSince : month) : undefined;
  return Budget.parse({
    id: budgetId(month, categoryId),
    month,
    categoryId,
    amount,
    rollover,
    rolloverSince,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}
