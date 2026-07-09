import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { categoryRepo } from '../data';
import type { Category } from '../domain/schemas';

const KEY = ['categories'];

/** All categories (including archived) — for the management screen. */
export function useCategories() {
  return useQuery({ queryKey: KEY, queryFn: () => categoryRepo.all() });
}

/** Active (non-archived) categories — for pickers. */
export function useActiveCategories() {
  return useQuery({ queryKey: [...KEY, 'active'], queryFn: () => categoryRepo.active() });
}

export function useSaveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (category: Category) => categoryRepo.put(category),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useArchiveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => categoryRepo.archive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
