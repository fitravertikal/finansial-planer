import type { Budget, Category, RecurringRule, Transaction } from '../../domain/schemas';

/** The four synced entity collections, matching the Worker's API contract. */
export interface Changes {
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  recurringRules: RecurringRule[];
}

export interface PullResult {
  serverTime: string;
  changes: Changes;
}
export interface PushResult {
  serverTime: string;
  applied: number;
}

/** Thin HTTP client for the Cloudflare Worker sync API (see .agents/CLAUDE_SYNC.md). */
export class SyncClient {
  private readonly base: string;
  constructor(
    url: string,
    private readonly key: string,
  ) {
    this.base = url.replace(/\/+$/, '');
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.key}` },
      body: JSON.stringify(body),
    });
    if (res.status === 401) throw new Error('Space key ditolak (401) — cek key di Settings.');
    if (!res.ok) throw new Error(`Sync gagal: HTTP ${res.status}`);
    return res.json() as Promise<T>;
  }

  pull(since: string): Promise<PullResult> {
    return this.post<PullResult>('/sync/pull', { since });
  }

  push(changes: Changes): Promise<PushResult> {
    return this.post<PushResult>('/sync/push', { changes });
  }
}
