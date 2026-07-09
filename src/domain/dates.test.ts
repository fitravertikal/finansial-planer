import { describe, expect, it } from 'vitest';
import { addMonths, currentMonth, monthOf, prevMonth, todayISO } from './dates';

describe('dates', () => {
  it('todayISO formats local calendar day', () => {
    // month index 6 = July
    expect(todayISO(new Date(2026, 6, 9))).toBe('2026-07-09');
    expect(todayISO(new Date(2026, 0, 1))).toBe('2026-01-01');
  });

  it('monthOf slices the month bucket', () => {
    expect(monthOf('2026-07-31')).toBe('2026-07');
  });

  it('currentMonth derives from today', () => {
    expect(currentMonth(new Date(2026, 6, 9))).toBe('2026-07');
  });

  it('addMonths crosses year boundaries', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-07', 0)).toBe('2026-07');
  });

  it('prevMonth', () => {
    expect(prevMonth('2026-07')).toBe('2026-06');
    expect(prevMonth('2026-01')).toBe('2025-12');
  });
});
