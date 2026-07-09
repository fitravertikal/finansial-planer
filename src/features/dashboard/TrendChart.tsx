import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { formatIDR } from '../../domain/money';
import type { MonthTotals } from '../../domain/budget';

/** Income vs expense per month over the trailing window. */
export function TrendChart({ data }: { data: MonthTotals[] }) {
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
          <XAxis dataKey="month" tickFormatter={(m: string) => m.slice(5)} fontSize={11} tickLine={false} />
          <Tooltip
            formatter={(v: number, n) => [formatIDR(v), n === 'income' ? 'Masuk' : 'Keluar']}
            labelFormatter={(m) => `Bulan ${m}`}
          />
          <Bar dataKey="income" fill="#10b981" radius={[3, 3, 0, 0]} />
          <Bar dataKey="expense" fill="#ef4444" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
