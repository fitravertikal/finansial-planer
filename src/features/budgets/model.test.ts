import { describe, expect, it } from 'vitest';
import { makeBudget, resolveExistingBudget } from './model';

describe('makeBudget rollover toggling', () => {
  it('turning rollover on for the first time stamps rolloverSince to the current month', () => {
    const b = makeBudget('2026-07', 'cat-makan', 1_000_000, undefined, true);
    expect(b.rollover).toBe(true);
    expect(b.rolloverSince).toBe('2026-07');
  });

  it('leaving rollover on (already on) preserves the original rolloverSince', () => {
    const existing = makeBudget('2026-06', 'cat-makan', 1_000_000, undefined, true);
    const b = makeBudget('2026-07', 'cat-makan', 1_000_000, existing, true);
    expect(b.rolloverSince).toBe('2026-06');
  });

  it('turning rollover off clears rolloverSince', () => {
    const existing = makeBudget('2026-06', 'cat-makan', 1_000_000, undefined, true);
    const b = makeBudget('2026-07', 'cat-makan', 1_000_000, existing, false);
    expect(b.rollover).toBe(false);
    expect(b.rolloverSince).toBeUndefined();
  });

  it('omitting rolloverOverride preserves existing rollover state as-is', () => {
    const existing = makeBudget('2026-06', 'cat-makan', 1_000_000, undefined, true);
    const b = makeBudget('2026-07', 'cat-makan', 1_200_000, existing);
    expect(b.rollover).toBe(true);
    expect(b.rolloverSince).toBe('2026-06');
  });

  it('no existing budget and no override defaults rollover off', () => {
    const b = makeBudget('2026-07', 'cat-makan', 1_000_000);
    expect(b.rollover).toBe(false);
    expect(b.rolloverSince).toBeUndefined();
  });
});

describe('resolveExistingBudget (cross-month rollover inheritance)', () => {
  // Scenario 1: category never had rollover; user turns it on in month N for
  // the first time. No current-month row, no previous-month row at all.
  it('returns undefined when neither current nor previous month has a row', () => {
    const existing = resolveExistingBudget(undefined, undefined);
    expect(existing).toBeUndefined();
    const b = makeBudget('2026-07', 'cat-makan', 1_000_000, existing, true);
    expect(b.rollover).toBe(true);
    expect(b.rolloverSince).toBe('2026-07');
  });

  it('returns undefined when previous month exists but had rollover off', () => {
    const prevMonthBudget = makeBudget('2026-06', 'cat-makan', 500_000, undefined, false);
    const existing = resolveExistingBudget(undefined, prevMonthBudget);
    expect(existing).toBeUndefined();
    const b = makeBudget('2026-07', 'cat-makan', 1_000_000, existing, true);
    expect(b.rollover).toBe(true);
    expect(b.rolloverSince).toBe('2026-07');
  });

  // Scenario 2: category had rollover on in month N (rolloverSince = N).
  // User visits/toggles month N+1 for the first time (no row yet there) —
  // the chain must continue with rolloverSince still = N.
  it('inherits rollover + rolloverSince from previous month when current month has no row yet', () => {
    const juneBudget = makeBudget('2026-06', 'cat-makan', 1_000_000, undefined, true);
    expect(juneBudget.rolloverSince).toBe('2026-06');

    const existing = resolveExistingBudget(undefined, juneBudget);
    expect(existing?.rollover).toBe(true);
    expect(existing?.rolloverSince).toBe('2026-06');

    // User re-affirms rollover on (e.g. toggles the already-checked box) in July.
    const julyBudget = makeBudget('2026-07', 'cat-makan', 1_000_000, existing, true);
    expect(julyBudget.rollover).toBe(true);
    expect(julyBudget.rolloverSince).toBe('2026-06');
  });

  // Scenario 3: category had rollover on in month N; user explicitly turns it
  // OFF in month N+1. rolloverSince clears for N+1, and June's own row is untouched.
  it('turning rollover off in the new month clears rolloverSince without touching the previous month row', () => {
    const juneBudget = makeBudget('2026-06', 'cat-makan', 1_000_000, undefined, true);
    const existing = resolveExistingBudget(undefined, juneBudget);

    const julyBudget = makeBudget('2026-07', 'cat-makan', 1_000_000, existing, false);
    expect(julyBudget.rollover).toBe(false);
    expect(julyBudget.rolloverSince).toBeUndefined();

    // June's row is a separate object; verifying it was never mutated.
    expect(juneBudget.rollover).toBe(true);
    expect(juneBudget.rolloverSince).toBe('2026-06');
  });

  // Scenario 4: category had rollover OFF in month N; user turns it on fresh
  // in month N+1. rolloverSince stamps to N+1 regardless of month N's data.
  it('turning rollover on fresh in the new month stamps rolloverSince to that month, ignoring an off previous month', () => {
    const juneBudget = makeBudget('2026-06', 'cat-makan', 500_000, undefined, false);
    const existing = resolveExistingBudget(undefined, juneBudget);
    expect(existing).toBeUndefined();

    const julyBudget = makeBudget('2026-07', 'cat-makan', 500_000, existing, true);
    expect(julyBudget.rollover).toBe(true);
    expect(julyBudget.rolloverSince).toBe('2026-07');
  });

  // Scenario 5: editing just the amount (no rolloverOverride) in a month with
  // no row yet, for a category with rollover already on from the prior month,
  // must preserve the inherited rollover/rolloverSince.
  it('editing only the amount in a fresh month preserves inherited rollover state', () => {
    const juneBudget = makeBudget('2026-06', 'cat-makan', 1_000_000, undefined, true);
    const existing = resolveExistingBudget(undefined, juneBudget);

    // setBudget() calls makeBudget without a rolloverOverride.
    const julyBudget = makeBudget('2026-07', 'cat-makan', 1_200_000, existing);
    expect(julyBudget.amount).toBe(1_200_000);
    expect(julyBudget.rollover).toBe(true);
    expect(julyBudget.rolloverSince).toBe('2026-06');
  });

  it('does not leak the previous month row createdAt onto the new month row', () => {
    const juneBudget = {
      ...makeBudget('2026-06', 'cat-makan', 1_000_000, undefined, true),
      createdAt: '2026-06-01T00:00:00.000Z',
    };
    const existing = resolveExistingBudget(undefined, juneBudget);

    const julyBudget = makeBudget('2026-07', 'cat-makan', 1_000_000, existing);
    expect(julyBudget.createdAt).not.toBe('2026-06-01T00:00:00.000Z');
  });

  it('current month row, once it exists, always wins over the previous month fallback', () => {
    const juneBudget = makeBudget('2026-06', 'cat-makan', 1_000_000, undefined, true);
    const julyBudgetOff = makeBudget('2026-07', 'cat-makan', 1_000_000, undefined, false);

    const existing = resolveExistingBudget(julyBudgetOff, juneBudget);
    expect(existing).toBe(julyBudgetOff);
    expect(existing?.rollover).toBe(false);
  });

  // copyLastMonth() calls resolveExistingBudget(undefined, b) then makeBudget
  // with no rolloverOverride, for every category in last month's budgets —
  // this must carry an active rollover chain into the copied month too.
  it('copyLastMonth-style call (resolveExistingBudget(undefined, b) + makeBudget with no override) carries an active chain forward', () => {
    const juneBudget = makeBudget('2026-06', 'cat-makan', 1_000_000, undefined, true);
    const existing = resolveExistingBudget(undefined, juneBudget);
    const copiedJuly = makeBudget('2026-07', 'cat-makan', juneBudget.amount, existing);
    expect(copiedJuly.rollover).toBe(true);
    expect(copiedJuly.rolloverSince).toBe('2026-06');
  });

  it('copyLastMonth-style call does not turn on rollover for a category that had it off', () => {
    const juneBudget = makeBudget('2026-06', 'cat-belanja', 500_000, undefined, false);
    const existing = resolveExistingBudget(undefined, juneBudget);
    const copiedJuly = makeBudget('2026-07', 'cat-belanja', juneBudget.amount, existing);
    expect(copiedJuly.rollover).toBe(false);
    expect(copiedJuly.rolloverSince).toBeUndefined();
  });
});
