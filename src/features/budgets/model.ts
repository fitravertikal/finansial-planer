import { Budget, budgetId } from '../../domain/schemas';

/**
 * Resolve the effective "existing" budget row to pass into `makeBudget` for
 * `month`, given the current month's own row (if any) and the *previous*
 * month's row (if any) for the same category.
 *
 * Each month gets its own `Budget` row, created lazily the first time a user
 * touches that category. Without this fallback, the very first edit in a new
 * month always sees `currentMonthBudget === undefined`, so `makeBudget` would
 * treat rollover as freshly toggled on and stamp `rolloverSince` to the
 * current month — breaking the chain even though the previous month's row
 * already had rollover on. This function bridges that gap: if the current
 * month has no row yet but the previous month's row had `rollover: true`, it
 * returns a synthetic "existing" row carrying the previous month's `rollover`
 * and `rolloverSince` forward, so `makeBudget` continues the chain instead of
 * starting a new one. If the current month already has its own row, that row
 * always wins (a month's own stored state is authoritative once it exists).
 *
 * Note: the synthetic row's `createdAt` is reset to "now" rather than copied
 * from the previous month, so `makeBudget`'s `existing?.createdAt ?? now`
 * stamps a fresh, correct `createdAt` for the current month's brand-new row
 * instead of leaking the previous month's row's creation time onto it.
 */
export function resolveExistingBudget(
  currentMonthBudget: Budget | undefined,
  previousMonthBudget: Budget | undefined,
): Budget | undefined {
  if (currentMonthBudget) return currentMonthBudget;
  if (!previousMonthBudget?.rollover) return undefined;
  return {
    ...previousMonthBudget,
    rollover: true,
    rolloverSince: previousMonthBudget.rolloverSince,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Build/patch a monthly per-category budget row, validated via Zod.
 * Pass `rolloverOverride` to explicitly turn rollover on/off (e.g. from a UI
 * toggle); omit it to preserve `existing`'s rollover state unchanged. Turning
 * rollover on (false -> true) stamps `rolloverSince` to `month`; turning it
 * off clears `rolloverSince` entirely — a later re-enable starts a fresh chain.
 * Pass `existing` from `resolveExistingBudget` to correctly inherit rollover
 * chains across month boundaries when the current month has no row yet.
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
