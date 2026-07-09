import { formatIDR } from '../domain/money';

/** Renders an integer-rupiah amount as formatted IDR, optionally signed. */
export function Money({
  amount,
  className,
  signed,
}: {
  amount: number;
  className?: string;
  signed?: 'income' | 'expense';
}) {
  const prefix = signed === 'income' ? '+' : signed === 'expense' ? '−' : '';
  return (
    <span className={className}>
      {prefix}
      {formatIDR(amount)}
    </span>
  );
}
