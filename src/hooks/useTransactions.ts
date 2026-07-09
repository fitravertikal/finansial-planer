import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { transactionRepo } from '../data';
import type { Transaction } from '../domain/schemas';

const KEY = ['transactions'];

/** Transactions for one month, newest first. */
export function useTransactions(month: string) {
  return useQuery({
    queryKey: [...KEY, month],
    queryFn: async () => {
      const rows = await transactionRepo.byMonth(month);
      return rows.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    },
  });
}

export function useSaveTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (txn: Transaction) => transactionRepo.put(txn),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => transactionRepo.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
