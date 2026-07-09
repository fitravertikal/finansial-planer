import { z } from 'zod';

/**
 * Domain schemas — the single source of truth for both TypeScript types
 * (via z.infer) and runtime validation (forms + import). Money is always
 * whole IDR (integer), never a float. Dates are calendar strings so a
 * transaction's day never shifts with timezone.
 */

export const PaymentMethod = z.enum(['cash', 'transfer', 'ewallet']);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

export const TxnType = z.enum(['income', 'expense']);
export type TxnType = z.infer<typeof TxnType>;

/** 'YYYY-MM-DD' calendar day (local). */
export const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');
/** 'YYYY-MM' month bucket — sortable, indexable. */
export const MonthKey = z.string().regex(/^\d{4}-\d{2}$/, 'must be YYYY-MM');
/** Whole rupiah, non-negative. Sign/direction comes from TxnType, not the amount. */
export const Rupiah = z.number().int().nonnegative();

// Ids are plain strings: user-created rows use crypto.randomUUID(); seeded
// default categories use stable slugs (e.g. 'cat-makan') so they're identical
// across devices and survive export/import without duplication.
const Id = z.string().min(1);

export const Category = z.object({
  id: Id,
  name: z.string().min(1),
  type: TxnType,
  color: z.string().optional(),
  icon: z.string().optional(),
  archived: z.boolean().default(false),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  createdAt: z.string().datetime(),
});
export type Category = z.infer<typeof Category>;

export const Transaction = z.object({
  id: Id,
  type: TxnType,
  date: DateStr,
  month: MonthKey, // derived from `date` on write — indexable
  amount: Rupiah, // always positive; direction implied by `type`
  categoryId: Id,
  paymentMethod: PaymentMethod,
  note: z.string().max(500).optional(),
  isTransfer: z.boolean().default(false), // movement between own accounts — excluded from income/expense
  refundOf: Id.optional(), // if set, this expense nets DOWN its category's spend
  recurringRuleId: Id.optional(), // set when generated from a RecurringRule
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Transaction = z.infer<typeof Transaction>;

export const Budget = z.object({
  id: Id, // = `${month}:${categoryId}`
  month: MonthKey,
  categoryId: Id,
  amount: Rupiah,
  rollover: z.boolean().default(false), // wired for later; not surfaced in v1
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Budget = z.infer<typeof Budget>;

/** A monthly recurring template (salary, rent, subscriptions). Generates a
 * normal Transaction (with recurringRuleId) once confirmed each month. */
export const RecurringRule = z.object({
  id: Id,
  type: TxnType,
  amount: Rupiah,
  categoryId: Id,
  paymentMethod: PaymentMethod,
  note: z.string().max(500).optional(),
  dayOfMonth: z.number().int().min(1).max(28), // clamp to 28 to avoid month-length bugs
  startMonth: MonthKey,
  endMonth: MonthKey.optional(),
  active: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type RecurringRule = z.infer<typeof RecurringRule>;

export const AppMeta = z.object({
  id: z.literal('app'),
  schemaVersion: z.number().int(),
  currency: z.literal('IDR'),
  defaultPaymentMethod: PaymentMethod.default('cash'),
  createdAt: z.string().datetime(),
});
export type AppMeta = z.infer<typeof AppMeta>;

/** Stable key for a monthly per-category budget. */
export function budgetId(month: string, categoryId: string): string {
  return `${month}:${categoryId}`;
}

export const SCHEMA_VERSION = 2;

/** Versioned backup envelope — also the shape a future sync backend would use. */
export const BackupFile = z.object({
  format: z.literal('finansial-planer-backup'),
  schemaVersion: z.number().int(),
  exportedAt: z.string().datetime(),
  data: z.object({
    meta: z.array(AppMeta),
    categories: z.array(Category),
    transactions: z.array(Transaction),
    budgets: z.array(Budget),
    recurringRules: z.array(RecurringRule).default([]),
  }),
});
export type BackupFile = z.infer<typeof BackupFile>;
