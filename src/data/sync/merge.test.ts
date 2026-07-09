import { describe, expect, it } from 'vitest';
import { localChanges, remoteWinners, syncTs, type Syncable } from './merge';

const row = (id: string, updatedAt?: string, deletedAt?: string): Syncable => ({
  id,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt,
  deletedAt,
});

describe('syncTs', () => {
  it('uses updatedAt, falling back to createdAt', () => {
    expect(syncTs(row('a', '2026-07-01T00:00:00.000Z'))).toBe('2026-07-01T00:00:00.000Z');
    expect(syncTs(row('a'))).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('remoteWinners', () => {
  it('takes remote rows that are new or newer', () => {
    const local = [row('keep', '2026-07-05T00:00:00.000Z'), row('old', '2026-01-01T00:00:00.000Z')];
    const remote = [
      row('new', '2026-07-02T00:00:00.000Z'), // not present locally -> win
      row('old', '2026-07-10T00:00:00.000Z'), // newer than local -> win
      row('keep', '2026-07-01T00:00:00.000Z'), // older than local -> lose
    ];
    const winners = remoteWinners(local, remote).map((r) => r.id).sort();
    expect(winners).toEqual(['new', 'old']);
  });

  it('a tombstone with a newer timestamp wins (delete propagates)', () => {
    const local = [row('x', '2026-07-01T00:00:00.000Z')];
    const remote = [row('x', '2026-07-09T00:00:00.000Z', '2026-07-09T00:00:00.000Z')];
    const winners = remoteWinners(local, remote);
    expect(winners).toHaveLength(1);
    expect(winners[0].deletedAt).toBeDefined();
  });
});

describe('localChanges', () => {
  it('returns rows changed after `since` (tombstones included)', () => {
    const local = [
      row('a', '2026-07-01T00:00:00.000Z'),
      row('b', '2026-07-09T00:00:00.000Z', '2026-07-09T00:00:00.000Z'),
    ];
    expect(localChanges(local, '2026-07-05T00:00:00.000Z').map((r) => r.id)).toEqual(['b']);
    expect(localChanges(local, '').map((r) => r.id)).toEqual(['a', 'b']);
  });
});
