import { lazy, Suspense, useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import { queryClient } from '../hooks/queryClient';
import { seedIfEmpty } from '../data';
import { Layout } from './Layout';
import { TransactionsScreen } from '../features/transactions/TransactionsScreen';
import { CategoriesScreen } from '../features/categories/CategoriesScreen';
import { BudgetsScreen } from '../features/budgets/BudgetsScreen';
import { RecurringScreen } from '../features/recurring/RecurringScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';

// Dashboard pulls in Recharts (heavy) — load it only when visited so the
// initial mobile load stays light.
const DashboardScreen = lazy(() =>
  import('../features/dashboard/DashboardScreen').then((m) => ({ default: m.DashboardScreen })),
);

function Loading() {
  return <p className="p-8 text-center text-sm text-gray-400">Memuat…</p>;
}

const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <TransactionsScreen /> },
      { path: 'categories', element: <CategoriesScreen /> },
      { path: 'budgets', element: <BudgetsScreen /> },
      {
        path: 'dashboard',
        element: (
          <Suspense fallback={<Loading />}>
            <DashboardScreen />
          </Suspense>
        ),
      },
      { path: 'recurring', element: <RecurringScreen /> },
      { path: 'settings', element: <SettingsScreen /> },
    ],
  },
]);

export function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void seedIfEmpty().then(() => setReady(true));
  }, []);

  if (!ready) return <Loading />;

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
