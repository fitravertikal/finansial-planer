/**
 * Pure sync-merge logic (no I/O). Last-write-wins by a row's sync timestamp,
 * with tombstones (`deletedAt`) treated as ordinary rows — a delete is just a
 * newer version. Categories may predate the `updatedAt` field, so we fall back
 * to `createdAt`.
 */

export interface Syncable {
  id: string;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
}

/** The timestamp used for LWW ordering. */
export function syncTs(row: Syncable): string {
  return row.updatedAt ?? row.createdAt;
}

/**
 * Remote rows that should overwrite local state: those with no local counterpart,
 * or a strictly newer sync timestamp than the local row.
 */
export function remoteWinners<T extends Syncable>(local: T[], remote: T[]): T[] {
  const byId = new Map(local.map((r) => [r.id, r]));
  return remote.filter((r) => {
    const l = byId.get(r.id);
    return !l || syncTs(r) > syncTs(l);
  });
}

/** Local rows changed strictly after `since` (empty string = everything) — the push set. */
export function localChanges<T extends Syncable>(local: T[], since: string): T[] {
  return local.filter((r) => syncTs(r) > since);
}
