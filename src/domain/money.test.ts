import { describe, expect, it } from 'vitest';
import { formatIDR, sumRupiah } from './money';

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
