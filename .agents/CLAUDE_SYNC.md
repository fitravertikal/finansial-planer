# Sync Backend — Cloudflare Worker + D1

## Endpoints

| Config | Value |
|---|---|
| **Worker URL** | `https://sync.epslab.id` |
| **Space Key** | *(set per-device in app Settings — never committed)* |

## API Contract

### POST /sync/pull

Request:
```json
{ "since": "2026-01-01T00:00:00Z" }
```

Response:
```json
{
  "serverTime": "2026-07-09T14:29:34.085Z",
  "changes": {
    "categories": [],
    "transactions": [],
    "budgets": [],
    "recurringRules": []
  }
}
```

`since` = ISO timestamp. Pass empty string for full pull. Returns rows with `updatedAt > since`.

### POST /sync/push

Request:
```json
{
  "changes": {
    "categories": [{ "id": "...", "name": "...", "updatedAt": "...", ... }],
    "transactions": [{ "id": "...", "amount": ..., "updatedAt": "...", ... }],
    "budgets": [],
    "recurringRules": []
  }
}
```

Response:
```json
{ "serverTime": "...", "applied": 2 }
```

LWW by `updatedAt`. Tombstones via `deletedAt` field.

### Auth

All requests require:
```
Authorization: Bearer <space-key>

## Data Model

Single `rows` table — opaque JSON + sync columns:
```sql
space_id   TEXT    -- from Space Key
entity     TEXT    -- categories | transactions | budgets | recurringRules
id         TEXT    -- UUID from client
updated_at TEXT    -- ISO8601, LWW key
deleted_at TEXT    -- nullable tombstone
payload    TEXT    -- JSON of the entity
```

## Architecture

- **Local-first**: IndexedDB (Dexie) remains source of truth
- **Pull → Merge → Push**: SyncEngine pattern, LWW on `updatedAt`
- **Deletes**: Tombstones (`deletedAt`), not row removal
- **Offline**: App works fully offline, syncs when Worker reachable

## Client Follow-up (Claude Code)

1. Add `deletedAt?` to `Transaction` / `Budget` / `RecurringRule` schemas
2. Build `data/sync/SyncEngine` (pull→merge LWW→push)
3. Store `lastSyncedAt` in app `meta` table
4. Settings screen: Worker URL + Space Key input, Sync button, last-synced time
5. Auto-sync on app focus (optional)

## Infra

- **Worker**: Cloudflare Workers (free tier)
- **Database**: Cloudflare D1 (`finansial-sync`, APAC/Singapore)
- **DNS**: `sync.epslab.id` CNAME → `epslab.id` (proxied)
- **Source**: `/tmp/finansial-sync/` — `schema.sql`, `src/worker.js`, `wrangler.toml`
