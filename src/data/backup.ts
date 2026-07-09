import { BackupFile, SCHEMA_VERSION } from '../domain/schemas';
import type { FinansialDB } from './db';

/**
 * Manual backup: local-first means the browser is the database, so export is
 * the safety net AND the migration/portability path. The JSON envelope is
 * intentionally the same shape a future sync backend would exchange, and it is
 * validated on import by the same Zod schemas used everywhere else — nothing
 * enters the DB unvalidated.
 */

/** Assemble a versioned backup object from all tables. */
export async function buildBackup(db: FinansialDB): Promise<BackupFile> {
  const [meta, categories, transactions, budgets, recurringRules] = await Promise.all([
    db.meta.toArray(),
    db.categories.toArray(),
    db.transactions.toArray(),
    db.budgets.toArray(),
    db.recurringRules.toArray(),
  ]);
  return {
    format: 'finansial-planer-backup',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: { meta, categories, transactions, budgets, recurringRules },
  };
}

/** Serialize a backup to a pretty JSON string. */
export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

/**
 * Parse and validate a backup string. Throws (via Zod) on malformed or foreign
 * files, so callers can surface a clear error instead of corrupting the DB.
 */
export function parseBackup(json: string): BackupFile {
  return BackupFile.parse(JSON.parse(json));
}

/**
 * Replace all local data with the contents of a validated backup, atomically.
 * (Merge-by-id is the natural later addition for sync.)
 */
export async function restoreBackup(db: FinansialDB, backup: BackupFile): Promise<void> {
  await db.transaction(
    'rw',
    db.meta,
    db.categories,
    db.transactions,
    db.budgets,
    db.recurringRules,
    async () => {
      await Promise.all([
        db.meta.clear(),
        db.categories.clear(),
        db.transactions.clear(),
        db.budgets.clear(),
        db.recurringRules.clear(),
      ]);
      await Promise.all([
        db.meta.bulkAdd(backup.data.meta),
        db.categories.bulkAdd(backup.data.categories),
        db.transactions.bulkAdd(backup.data.transactions),
        db.budgets.bulkAdd(backup.data.budgets),
        db.recurringRules.bulkAdd(backup.data.recurringRules),
      ]);
    },
  );
}
