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

The family live page reads through `public.get_snapshot`, a security invoker function, so row-level security decides which games a caller sees.

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

## Reset the first-connection test games

Schema 2 has no decoder for old uploads, so games pinned to an older engine or schema can't take new plays. Before the schema-2 rehearsal, #21 clears them. `reset-test-games.sql` lists every game whose pins differ from the engine's current pins, then deletes only the IDs you name.

```sh
pins="$(pnpm -s --filter @sandlot/engine sample-events --pins)"
psql "$SUPABASE_DB_URL" -q -v pins="$pins" -f supabase/scripts/reset-test-games.sql
psql "$SUPABASE_DB_URL" -q -v pins="$pins" -v ids=<game id>,<game id> -f supabase/scripts/reset-test-games.sql
```

Generate `pins` from an up-to-date `main` that matches the deployed `sync-events`. The script compares games only against the pins it's given, so pins from an older or newer checkout would list current games as stale. It prints the pins it uses first. Connect directly or through the session pooler on port 5432, not the transaction pooler on 6543.

The first command changes nothing. Check its pins and list before running the second. Deletion runs in one transaction and refuses the whole list if any ID is unknown or names a game on the current pins. It removes each game's sessions, groups and events, and prints what it deleted and the games still on older pins. Record both lists on #21. The anonymous scorer accounts stay, and the seed script makes a new game for the rehearsal.

## Security admission and bounded uploads

Apply the request-admission migration before deploying the updated voice or sync functions. The functions fail closed if that migration or their database connection is unavailable. No function deployment or hosted migration is performed by this code change.

Voice requires an authenticated user who holds a current scoring epoch on at least one game. Both voice functions reserve the same 30-request fixed-minute quota through `private.admit_request`. Sync reserves a separate 120-request quota. The database clock and atomic upsert make the quota consistent across function instances. Counters hold only user ID, scope, minute and count, with at most two rows per existing user. Clients cannot read, reset or invoke them. A fixed-minute quota allows bursts across a minute boundary; it is not a spending cap.

Sync reads at most 262,144 UTF-8 bytes and voice reads at most 1,500,000 bytes. The streaming reader cancels oversized bodies before parsing. Current-schema uploads reject extra fields, oversized identifiers, arrays and nesting. Existing accepted retries still receive their acknowledgment after scoring handoff when their original user resends them; another user without current scoring cannot probe stored groups.

Before any real children's game, Christian must verify hosted scorer provisioning, anonymous-sign-in protections, actual OpenAI spending controls and zero data retention. `store: false` does not establish zero retention. Client-secret expiry only limits when a Realtime connection starts, not how long a connected session can run. The current transcription API has no documented shorter server-enforced duration setting. Names remain bounded and role-labeled as ADR 0007 requires; transcription keywords remain last names only. Audio, names, prompts and secrets are never logged by these boundaries.
