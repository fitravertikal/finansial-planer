import { NavLink, Outlet } from 'react-router-dom';
import { useUiStore } from '../store/ui';
import { addMonths } from '../domain/dates';

const NAV = [
  { to: '/', label: 'Transaksi', end: true },
  { to: '/categories', label: 'Kategori', end: false },
  { to: '/budgets', label: 'Budget', end: false },
  { to: '/dashboard', label: 'Dashboard', end: false },
];

export function Layout() {
  const month = useUiStore((s) => s.activeMonth);
  const setMonth = useUiStore((s) => s.setActiveMonth);

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col">
      <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h1 className="text-lg font-bold text-emerald-700">Finansial Planer</h1>
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => setMonth(addMonths(month, -1))} aria-label="Bulan sebelumnya" className="px-2 text-gray-400">
            ‹
          </button>
          <span className="w-16 text-center font-medium tabular-nums">{month}</span>
          <button onClick={() => setMonth(addMonths(month, 1))} aria-label="Bulan berikutnya" className="px-2 text-gray-400">
            ›
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-24">
        <Outlet />
      </main>

      <nav className="sticky bottom-0 z-0 grid grid-cols-4 border-t border-gray-100 bg-white">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `py-3 text-center text-xs ${isActive ? 'font-semibold text-emerald-600' : 'text-gray-400'}`
            }
          >
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
