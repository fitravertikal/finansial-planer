/**
 * IDR money helpers. Amounts are whole rupiah (integers) everywhere — never
 * floats — so there is no rounding drift. Formatting uses the built-in
 * Intl API, no dependency.
 */

const idr = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

/** e.g. 1500000 -> "Rp 1.500.000" */
export function formatIDR(amount: number): string {
  return idr.format(Math.round(amount));
}

/** Sum a list of integer-rupiah amounts. */
export function sumRupiah(amounts: number[]): number {
  return amounts.reduce((total, n) => total + n, 0);
}
