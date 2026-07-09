import { useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import { queryClient } from '../hooks/queryClient';
import { seedIfEmpty } from '../data';
import { Layout } from './Layout';
import { TransactionsScreen } from '../features/transactions/TransactionsScreen';
import { CategoriesScreen } from '../features/categories/CategoriesScreen';
import { BudgetsScreen } from '../features/budgets/BudgetsScreen';
import { DashboardScreen } from '../features/dashboard/DashboardScreen';

const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <TransactionsScreen /> },
      { path: 'categories', element: <CategoriesScreen /> },
      { path: 'budgets', element: <BudgetsScreen /> },
      { path: 'dashboard', element: <DashboardScreen /> },
    ],
  },
]);

export function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void seedIfEmpty().then(() => setReady(true));
  }, []);

  if (!ready) {
    return <p className="p-8 text-center text-sm text-gray-400">Memuat…</p>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
