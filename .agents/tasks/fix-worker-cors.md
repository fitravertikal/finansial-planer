# Task (Hermes) — URGENT: fix CORS preflight on the sync Worker

**Symptom:** the app at `financial.epslab.id` shows **"Failed to fetch"** the moment
Sync is attempted, even with the new (rotated) space key entered correctly.

**Root cause:** the client calls `sync.epslab.id` cross-origin with
`Content-Type: application/json` + a custom `Authorization` header. Both trigger
a browser **CORS preflight** (`OPTIONS` request) before the real `POST` is sent.
The original Worker template (in `.agents/CLAUDE_SYNC.md` / the original
`sync-cloudflare.md` task) checked `Authorization` **before** checking the HTTP
method, so an `OPTIONS` preflight (which carries no bearer token) falls into the
`401 unauthorized` branch — and that response is missing
`Access-Control-Allow-Methods`, so even where CORS headers exist, the preflight
is rejected. The browser then blocks the actual request, which surfaces to the
app as a generic "Failed to fetch" (no HTTP status ever comes back).

## Fix

In the Worker's `fetch` handler, handle `OPTIONS` **first**, before any auth
check, and make sure every response (including `401`/`404`) carries the full
CORS header set — specifically add the missing `access-control-allow-methods`.

```js
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization,content-type',
  'access-control-allow-methods': 'POST,OPTIONS',
};
const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', ...CORS } });

export default {
  async fetch(req, env) {
    // Preflight — must succeed with no auth required, before anything else.
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const key = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const space = env.SPACE_KEYS?.[key];
    if (!space) return json({ error: 'unauthorized' }, 401);

    const url = new URL(req.url);
    const ENTITIES = ['categories', 'transactions', 'budgets', 'recurringRules'];
    const now = new Date().toISOString();

    if (req.method === 'POST' && url.pathname === '/sync/pull') {
      // ... unchanged pull logic ...
    }
    if (req.method === 'POST' && url.pathname === '/sync/push') {
      // ... unchanged push logic ...
    }
    return json({ error: 'not found' }, 404);
  },
};
```

Only two changes from the current Worker:
1. **`OPTIONS` is handled first** and returns `204` with CORS headers — no auth check on preflight.
2. **`access-control-allow-methods: 'POST,OPTIONS'`** added to the shared `CORS` headers used by every response (`json()` helper), not just `allow-origin`/`allow-headers`.

## Deploy & verify

```bash
wrangler deploy
```

Verify the preflight now succeeds:
```bash
curl -si -X OPTIONS https://sync.epslab.id/sync/pull \
  -H "Origin: https://financial.epslab.id" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type"
# expect: HTTP/2 204, with access-control-allow-* headers present
```

Then confirm a real pull works with the current (rotated) space key:
```bash
curl -si https://sync.epslab.id/sync/pull \
  -H "Authorization: Bearer <the current space key>" \
  -H "content-type: application/json" \
  -d '{"since":""}'
# expect: HTTP/2 200 with a JSON body
```

## Report
Confirm: OPTIONS preflight returns 204 with CORS headers, and a real pull with
the current key returns 200. Then tell Fitra to retry "Sync sekarang" in the app.
