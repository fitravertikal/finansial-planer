import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { FinansialDB } from './db';
import { buildBackup, parseBackup, restoreBackup, serializeBackup } from './backup';
import type { AppMeta, Budget, Category, Transaction } from '../domain/schemas';

const NOW = '2026-07-01T00:00:00.000Z';

function seedDb(db: FinansialDB) {
  const meta: AppMeta = {
    id: 'app',
    schemaVersion: 1,
    currency: 'IDR',
    defaultPaymentMethod: 'cash',
    createdAt: NOW,
  };
  const cat: Category = {
    id: 'cat-makan',
    name: 'Makan & Minum',
    type: 'expense',
    archived: false,
    isDefault: true,
    sortOrder: 0,
    createdAt: NOW,
  };
  const txn: Transaction = {
    id: 't1',
    type: 'expense',
    date: '2026-07-10',
    month: '2026-07',
    amount: 350_000,
    categoryId: 'cat-makan',
    paymentMethod: 'ewallet',
    isTransfer: false,
    createdAt: NOW,
    updatedAt: NOW,
  };
  const bud: Budget = {
    id: '2026-07:cat-makan',
    month: '2026-07',
    categoryId: 'cat-makan',
    amount: 2_000_000,
    rollover: false,
    createdAt: NOW,
    updatedAt: NOW,
  };
  return db.transaction('rw', db.meta, db.categories, db.transactions, db.budgets, async () => {
    await db.meta.put(meta);
    await db.categories.put(cat);
    await db.transactions.put(txn);
    await db.budgets.put(bud);
  });
}

describe('backup export/import', () => {
  it('round-trips all data losslessly through JSON', async () => {
    const source = new FinansialDB('test-source-' + crypto.randomUUID());
    await seedDb(source);

    const json = serializeBackup(await buildBackup(source));
    const parsed = parseBackup(json); // validates via Zod

    const target = new FinansialDB('test-target-' + crypto.randomUUID());
    await restoreBackup(target, parsed);

    expect(await target.categories.count()).toBe(1);
    expect(await target.transactions.count()).toBe(1);
    expect(await target.budgets.count()).toBe(1);
    expect((await target.transactions.get('t1'))?.amount).toBe(350_000);

    source.close();
    target.close();
  });

  it('rejects a malformed / foreign backup', () => {
    expect(() => parseBackup('{"nope": true}')).toThrow();
  });
});
