import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { recurringRepo } from '../data';
import type { RecurringRule } from '../domain/schemas';

const KEY = ['recurring'];

export function useRecurringRules() {
  return useQuery({ queryKey: KEY, queryFn: () => recurringRepo.all() });
}

export function useSaveRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rule: RecurringRule) => recurringRepo.put(rule),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recurringRepo.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
