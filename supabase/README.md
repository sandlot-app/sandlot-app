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

Migration `20261024010000` updates databases that applied the earlier restriction on deleting accounts with empty sessions. It preserves existing data and the constraints protecting accepted groups. No database reset is needed.

After testing, remove the disposable local database and its volumes.

```sh
supabase stop --no-backup
```

The function requires `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_DB_URL`. Supabase injects `SUPABASE_DB_URL` into deployed functions. It connects as the database owner, which is the trusted path contract.md describes for calling `private.commit_group`.

The first-connection handler stores groups without engine validation. Retried groups return their original acknowledgment, including concurrent retries. Deleting an account with accepted groups fails with SQLSTATE `23503`. An account whose sessions have no accepted groups can be deleted, and its sessions go with it. Deleting a session with accepted groups also fails. Explicit whole-game cleanup still removes the game's sessions, groups, and events. Account deletion can succeed after all referencing history is deliberately removed. This is the first-connection lifecycle restriction, not an account-deletion product flow.
