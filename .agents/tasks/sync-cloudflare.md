# Task — Multi-device sync via Cloudflare Worker + D1

**Split:** Hermes provisions the backend (infra); Claude Code builds the client (a follow-up PR against the API contract below).
**Why Cloudflare:** you already have Cloudflare access, it's free at this scale, and it keeps everything on infra you control. (Alternative: Supabase — same contract works; pick one.)

## Design — local-first + last-write-wins

The app stays **local-first**: IndexedDB (Dexie) remains the source of truth and it works fully offline. Sync is an *enhancement* layered on top:

- Each device is configured with a shared **space key** (one long random token = one data space for you). Same key on phone + laptop = same data. This is single-user by design — no accounts/passwords.
- A **SyncEngine** on the client periodically (and on demand) does **pull → merge → push**:
  - **pull** rows changed on the server since the last sync, merge into Dexie by **last-write-wins on `updatedAt`**.
  - **push** local rows changed since last sync.
- **Deletes propagate via tombstones** (`deletedAt`), not row removal — a hard delete is invisible to a sync engine. (Client change needed — see "Client follow-up".)
- The entities already carry stable UUID `id` + `updatedAt`, so they're sync-ready by construction.

## API contract (the Worker must implement exactly this)

Auth: every request carries `Authorization: Bearer <SPACE_KEY>`. The Worker maps a key → a `space_id` row set. Reject with 401 if unknown.

```
POST /sync/pull    body: { since: string /*ISO, "" for full*/ }
  -> 200 { serverTime: string, changes: {
       categories: Row[], transactions: Row[], budgets: Row[], recurringRules: Row[]
     } }   // rows with updatedAt > since (including tombstoned rows: deletedAt set)

POST /sync/push    body: { changes: { categories: Row[], transactions: Row[],
                                      budgets: Row[], recurringRules: Row[] } }
  -> 200 { serverTime: string, applied: number }
  // upsert by (space_id, id); keep the row with the greater updatedAt (LWW)
```

`Row` = the entity's JSON (as in `src/domain/schemas.ts`) plus `updatedAt` and optional `deletedAt`. The server stores rows opaquely per entity table keyed by `(space_id, id)` — it does not need to understand the fields, only `id`/`updatedAt`/`deletedAt`.

## Hermes steps

### 1. D1 database + schema
```bash
wrangler d1 create finansial-sync
```
Schema (`schema.sql`) — one table per entity, opaque JSON payload + sync columns:
```sql
CREATE TABLE IF NOT EXISTS rows (
  space_id   TEXT NOT NULL,
  entity     TEXT NOT NULL,      -- 'categories' | 'transactions' | 'budgets' | 'recurringRules'
  id         TEXT NOT NULL,
  updated_at TEXT NOT NULL,      -- ISO8601
  deleted_at TEXT,               -- ISO8601 tombstone, nullable
  payload    TEXT NOT NULL,      -- JSON of the entity
  PRIMARY KEY (space_id, entity, id)
);
CREATE INDEX IF NOT EXISTS idx_rows_since ON rows (space_id, entity, updated_at);
```
```bash
wrangler d1 execute finansial-sync --file=schema.sql
```

### 2. Worker (`src/worker.js`)
```js
export default {
  async fetch(req, env) {
    const key = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const space = env.SPACE_KEYS?.[key];               // map key -> space_id
    if (!space) return json({ error: 'unauthorized' }, 401);
    const url = new URL(req.url);
    const ENTITIES = ['categories', 'transactions', 'budgets', 'recurringRules'];
    const now = new Date().toISOString();

    if (req.method === 'POST' && url.pathname === '/sync/pull') {
      const { since = '' } = await req.json();
      const changes = {};
      for (const e of ENTITIES) {
        const { results } = await env.DB
          .prepare('SELECT id, updated_at, deleted_at, payload FROM rows WHERE space_id=? AND entity=? AND updated_at>?')
          .bind(space, e, since).all();
        changes[e] = results.map((r) => ({
          ...JSON.parse(r.payload), id: r.id, updatedAt: r.updated_at,
          ...(r.deleted_at ? { deletedAt: r.deleted_at } : {}),
        }));
      }
      return json({ serverTime: now, changes });
    }

    if (req.method === 'POST' && url.pathname === '/sync/push') {
      const { changes = {} } = await req.json();
      let applied = 0;
      for (const e of ENTITIES) {
        for (const row of changes[e] || []) {
          // LWW: only overwrite if incoming updatedAt is newer
          await env.DB.prepare(
            `INSERT INTO rows (space_id, entity, id, updated_at, deleted_at, payload)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(space_id, entity, id) DO UPDATE SET
               updated_at=excluded.updated_at, deleted_at=excluded.deleted_at, payload=excluded.payload
             WHERE excluded.updated_at > rows.updated_at`
          ).bind(space, e, row.id, row.updatedAt, row.deletedAt ?? null, JSON.stringify(row)).run();
          applied++;
        }
      }
      return json({ serverTime: now, applied });
    }
    return json({ error: 'not found' }, 404);
  },
};
const json = (o, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*',
               'access-control-allow-headers': 'authorization,content-type' },
  });
```
> Add an OPTIONS handler for CORS preflight (return 204 with the same allow-* headers) since the app calls this cross-origin from `financial.epslab.id`.

### 3. `wrangler.toml`
```toml
name = "finansial-sync"
main = "src/worker.js"
compatibility_date = "2024-11-01"
[[d1_databases]]
binding = "DB"
database_name = "finansial-sync"
database_id = "<from step 1>"
```
Space keys: generate one long random token and expose the key→space map to the Worker (e.g. a `[vars]` JSON in `wrangler.toml`, or a secret). Simplest for one user:
```toml
[vars]
SPACE_KEYS = { "REPLACE_WITH_LONG_RANDOM_TOKEN" = "fitra" }
```

### 4. Deploy + report
```bash
wrangler deploy
```
Report back to Claude Code: the **Worker URL** (e.g. `https://finansial-sync.<subdomain>.workers.dev`, or route it under `sync.epslab.id`) and the **space key**. Claude builds the client against those.

## Client follow-up (Claude Code, after the Worker is live)
On a `claude/*` branch + PR:
1. Add `deletedAt?` tombstones to `Transaction` / `Budget` / `RecurringRule` (and a soft-delete path) so deletes sync; `Category` already soft-deletes via `archived`.
2. `data/sync/` — a `SyncEngine` (pull→merge LWW→push) + `lastSyncedAt` in `meta`.
3. Settings screen: enter Worker URL + space key, "Sync sekarang", show last-synced time; optional auto-sync on app focus.
4. Tests for the merge/LWW logic (pure), against a mocked API.

## Notes
- Data is stored **as-is** on Cloudflare (your infra). For a personal finance app consider whether that's acceptable; can add field-level encryption later (encrypt payload client-side before push) if you want zero-knowledge.
- Keep it **local-first**: if the Worker is unreachable, the app must keep working offline and sync later. Never block the UI on the network.
