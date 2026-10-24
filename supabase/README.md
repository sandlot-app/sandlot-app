# Verify the first-connection backend

Use Deno 2.9.6, Supabase CLI 2.122.0, and Docker. The Backend workflow uses these versions and runs the handler tests and pgTAP database suite whenever `supabase/` changes.

From the repository root, check the function and run its deterministic concurrency tests.

```sh
cd supabase/functions/sync-events
deno check --frozen index.ts handler.ts
deno test --frozen handler_test.ts
cd ../../..
```

Start a fresh local test database and run the SQL suite. The slim image reduces disk use. The registry setting selects Docker Hub for the test runner image.

```sh
export SUPABASE_USE_SLIM_IMAGES=true
export SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io
supabase db start
supabase test db --local
```

`db start` applies migrations when it creates the database. For an existing local database, apply pending migrations with `supabase migration up --local` before running the tests. Use the pgTAP runner's exit status to detect failed assertions.

The first-connection schema is one migration. A local database built from this branch's earlier migration files needs `supabase db reset --local` once.

After testing, remove the disposable local database and its volumes.

```sh
supabase stop --no-backup
```

The function requires `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_DB_URL`. Supabase injects `SUPABASE_DB_URL` into deployed functions. It connects as the database owner, which is the trusted path contract.md describes for calling `private.commit_group`.

The handler replays the game's accepted events, applies each group with the engine, and rejects the whole group when the engine rejects it. Retried groups return their original acknowledgment, including concurrent retries. Deleting an account with accepted groups fails with SQLSTATE `23503`. An account whose sessions have no accepted groups can be deleted, and its sessions go with it. Deleting a session with accepted groups, or a group with events, also fails. Explicit whole-game cleanup still removes the game's sessions, groups, and events. Account deletion can succeed after all referencing history is deliberately removed. This is the first-connection lifecycle restriction, not an account-deletion product flow.

## Send the sample plays

Step 5 of the first connection test in `docs/contract.md` sends the engine's sample half-inning to `sync-events` twice. Start the database and serve the function first, locally with `supabase start` and `supabase functions serve sync-events`, or against the hosted project. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Locally, `supabase status` prints both, and its DB URL is the `SUPABASE_DB_URL` the seed step uses.

```sh
scorer=$(deno run -A supabase/scripts/send-samples.ts whoami)
psql "$SUPABASE_DB_URL" -q -At -F' ' -v scorer=$scorer -v pins="$(pnpm -s --filter @sandlot/engine sample-events --pins)" -f supabase/scripts/seed-test-game.sql
pnpm -s --filter @sandlot/engine sample-events --game <game_id> --session <session_id> > supabase/.temp/samples.json
deno run -A supabase/scripts/send-samples.ts < supabase/.temp/samples.json
deno run -A supabase/scripts/send-samples.ts < supabase/.temp/samples.json
```

`whoami` signs in as an anonymous scorer and prints its user ID. The seed script prints the new game's ID and session ID. The game's pins come from `sample-events --pins`, so the engine can play the sample plays. Regenerate `samples.json` if it is older than the seeded game or the engine's sample plays. Each send prints one line per request with its status and response, and stops at the first error. The second send prints the same acknowledgments as the first and adds no rows.

The scorer's refresh token is kept in `supabase/.temp/send-samples.json`, so both sends sign in as the seeded scorer. After a local database reset, delete that file, then run `whoami` and the seed script again.
