import { describe, expect, it } from 'vitest';
import { formatIDR, groupDigits, parseAmountInput, sumRupiah } from './money';

describe('formatIDR', () => {
  it('groups thousands with dots and no decimals', () => {
    expect(formatIDR(1500000)).toContain('Rp');
    expect(formatIDR(1500000)).toMatch(/1\.500\.000/);
  });

  it('formats zero', () => {
    expect(formatIDR(0)).toMatch(/0/);
  });

  it('rounds to whole rupiah', () => {
    expect(formatIDR(1000.7)).toMatch(/1\.001/);
  });
});

describe('sumRupiah', () => {
  it('sums integer amounts', () => {
    expect(sumRupiah([1000, 2000, 3000])).toBe(6000);
    expect(sumRupiah([])).toBe(0);
  });
});

describe('parseAmountInput', () => {
  it('strips non-digits and returns whole rupiah', () => {
    expect(parseAmountInput('Rp 1.500.000')).toBe(1500000);
    expect(parseAmountInput('1500000')).toBe(1500000);
    expect(parseAmountInput('1,500,000')).toBe(1500000);
  });

  it('returns 0 for empty or non-numeric input', () => {
    expect(parseAmountInput('')).toBe(0);
    expect(parseAmountInput('abc')).toBe(0);
  });
});

describe('groupDigits', () => {
  it('groups with dots, empty for zero', () => {
    expect(groupDigits(1500000)).toBe('1.500.000');
    expect(groupDigits(0)).toBe('');
  });
});
