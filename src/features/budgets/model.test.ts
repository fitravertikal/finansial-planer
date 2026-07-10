import { describe, expect, it } from 'vitest';
import { makeBudget } from './model';

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
