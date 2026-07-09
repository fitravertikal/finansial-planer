# Task (Hermes) — URGENT: rotate the leaked sync space key

**Why:** the sync **space key** was committed to `.agents/CLAUDE_SYNC.md` in this
**public** repo (PR #19). It is in git history and must be considered **compromised** —
anyone can read it and read/overwrite Fitra's financial data via `https://sync.epslab.id`.
Deleting the file does **not** fix this; the key must be **rotated**.

## Steps

1. **Generate a new space key** (long random token), e.g.:
   ```bash
   openssl rand -base64 32 | tr -d '/+=' | cut -c1-40
   ```

2. **Replace the key in the Worker** — update `SPACE_KEYS` so the NEW key maps to
   the same space (`fitra`) and **remove the old key** so it stops working:
   ```toml
   # wrangler.toml
   [vars]
   SPACE_KEYS = { "<NEW_KEY>" = "fitra" }
   ```
   (If keys are a Worker secret rather than a var, update the secret instead.)
   Redeploy:
   ```bash
   wrangler deploy
   ```

3. **Verify the old key is dead**:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" https://sync.epslab.id/sync/pull \
     -H "Authorization: Bearer mtx-oNLYOH1JH3BkwJ3NM3rgQADTLcofNK3-0IbuLE8" \
     -H "content-type: application/json" -d '{"since":""}'
   # expect 401
   ```

4. **Deliver the NEW key to Fitra securely — NOT via the repo, PR, or issue.**
   Use a private channel (password manager, DM, secret store). It will be entered
   once per device in the app's Settings; it is never committed.

5. **Do NOT commit the new key anywhere in git.** `.agents/CLAUDE_SYNC.md` now
   documents only the endpoint + contract, with the key set per-device in Settings.

## Report
Confirm: new key issued, old key returns 401, new key delivered to Fitra privately.
Optionally note that scrubbing git history (BFG/filter-repo) is possible but
secondary — rotation is the real fix since the key is already public.
