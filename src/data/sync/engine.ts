import { db } from '../db';
import { SyncClient, type Changes } from './client';
import { localChanges, remoteWinners, type Syncable } from './merge';
import { Budget, Category, RecurringRule, Transaction } from '../../domain/schemas';

export interface SyncResult {
  pulled: number;
  pushed: number;
  at: string;
}

interface Store<T> {
  toArray(): Promise<T[]>;
  bulkPut(rows: T[]): Promise<unknown>;
}

/**
 * Sync one entity: apply the remote rows that win LWW (validated), and return
 * the local rows to push. Kept generic-but-typed per entity so there are no
 * `any`s and each call is fully checked.
 */
async function syncEntity<T extends Syncable>(
  store: Store<T>,
  local: T[],
  remote: T[],
  parse: (u: unknown) => T | null,
  since: string,
): Promise<{ pulled: number; push: T[] }> {
  const valid = remoteWinners(local, remote).flatMap((row) => {
    const p = parse(row);
    return p ? [p] : [];
  });
  if (valid.length) await store.bulkPut(valid);
  return { pulled: valid.length, push: localChanges(local, since) };
}

const parseCategory = (u: unknown) => {
  const p = Category.safeParse(u);
  return p.success ? p.data : null;
};
const parseTransaction = (u: unknown) => {
  const p = Transaction.safeParse(u);
  return p.success ? p.data : null;
};
const parseBudget = (u: unknown) => {
  const p = Budget.safeParse(u);
  return p.success ? p.data : null;
};
const parseRule = (u: unknown) => {
  const p = RecurringRule.safeParse(u);
  return p.success ? p.data : null;
};

/**
 * One sync cycle: snapshot local → pull remote → apply LWW winners locally →
 * push local changes since last sync. Local-first: if the server is unreachable
 * this throws and the app keeps working offline; nothing is lost.
 */
export async function syncNow(): Promise<SyncResult> {
  const meta = await db.meta.get('app');
  if (!meta?.syncUrl || !meta?.syncKey) throw new Error('Sync belum dikonfigurasi.');
  const client = new SyncClient(meta.syncUrl, meta.syncKey);
  const since = meta.lastSyncedAt ?? '';

  // Snapshot BEFORE applying remote so just-pulled rows aren't echoed back.
  const local = {
    categories: await db.categories.toArray(),
    transactions: await db.transactions.toArray(),
    budgets: await db.budgets.toArray(),
    recurringRules: await db.recurringRules.toArray(),
  };

  const pull = await client.pull(since);

  const cat = await syncEntity(db.categories, local.categories, pull.changes.categories ?? [], parseCategory, since);
  const txn = await syncEntity(db.transactions, local.transactions, pull.changes.transactions ?? [], parseTransaction, since);
  const bud = await syncEntity(db.budgets, local.budgets, pull.changes.budgets ?? [], parseBudget, since);
  const rec = await syncEntity(db.recurringRules, local.recurringRules, pull.changes.recurringRules ?? [], parseRule, since);

  const changes: Changes = {
    categories: cat.push,
    transactions: txn.push,
    budgets: bud.push,
    recurringRules: rec.push,
  };
  const pushed = cat.push.length + txn.push.length + bud.push.length + rec.push.length;
  if (pushed) await client.push(changes);

  await db.meta.update('app', { lastSyncedAt: pull.serverTime });
  return { pulled: cat.pulled + txn.pulled + bud.pulled + rec.pulled, pushed, at: pull.serverTime };
}
