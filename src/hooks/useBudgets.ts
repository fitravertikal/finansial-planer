import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { budgetRepo } from '../data';
import type { Budget } from '../domain/schemas';

const KEY = ['budgets'];

/** Budgets for a month. */
export function useBudgets(month: string) {
  return useQuery({ queryKey: [...KEY, month], queryFn: () => budgetRepo.byMonth(month) });
}

/** Every budget across every month — for the rollover carry-over walk. */
export function useAllBudgets() {
  return useQuery({ queryKey: [...KEY, 'all'], queryFn: () => budgetRepo.all() });
}

export function useSaveBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (budget: Budget) => budgetRepo.upsert(budget),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
