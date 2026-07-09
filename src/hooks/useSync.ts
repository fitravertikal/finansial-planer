import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../data';
import { syncNow } from '../data/sync/engine';

/** App meta row (holds sync config + lastSyncedAt). */
export function useSyncMeta() {
  return useQuery({ queryKey: ['syncMeta'], queryFn: () => db.meta.get('app') });
}

export function useSaveSyncConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ url, key }: { url: string; key: string }) => {
      await db.meta.update('app', { syncUrl: url.trim() || undefined, syncKey: key.trim() || undefined });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['syncMeta'] }),
  });
}

/** Run one sync cycle, then refresh all data queries. */
export function useSyncNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => syncNow(),
    onSuccess: () => qc.invalidateQueries(), // data may have changed
  });
}
