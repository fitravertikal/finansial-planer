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

/**
 * Parse a user-typed amount into whole rupiah. Strips everything but digits
 * (so "Rp 1.500.000", "1500000", "1,500,000" all work) and returns an integer.
 * Returns 0 for empty/garbage input.
 */
export function parseAmountInput(input: string): number {
  const digits = input.replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10);
}

/** Group digits with dots for display inside an input, e.g. 1500000 -> "1.500.000". */
export function groupDigits(amount: number): string {
  if (!amount) return '';
  return amount.toLocaleString('id-ID');
}
