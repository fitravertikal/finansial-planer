import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatIDR } from '../../domain/money';

export interface Slice {
  name: string;
  value: number;
  color: string;
}

/** Donut of this month's expenses by category. */
export function BreakdownChart({ data }: { data: Slice[] }) {
  if (data.length === 0) return null;
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
            {data.map((s) => (
              <Cell key={s.name} fill={s.color} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number, n) => [formatIDR(v), n as string]} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
