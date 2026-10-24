# Verify the first-connection backend

Use Deno 2.9.6, Supabase CLI 2.122.0, and Docker. CI uses these versions and runs the handler tests and pgTAP database suite alongside the existing frontend checks.

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

After testing, remove the disposable local database and its volumes.

```sh
supabase stop --no-backup
```

The function requires `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and a trusted PostgreSQL connection in `SUPABASE_DB_URL`. Configure that connection with the database privileges granted to `service_role`. A Supabase API service key is not a PostgreSQL password. The role tests connect as the local database owner and use `SET LOCAL ROLE service_role` to exercise the private functions. A deployed database login must have the required privileges or be provisioned to assume that role. The migration adds the required privileges without removing broader privileges Supabase already grants to `service_role`.

The first-connection handler stores groups without engine validation. Retried groups return their original acknowledgment, including concurrent retries. Deleting an account with retained scoring sessions or groups fails with SQLSTATE `23503`. Deleting a session with accepted groups also fails. Explicit whole-game cleanup still removes the game's sessions, groups, and events. Account deletion can succeed after all referencing history is deliberately removed. This is the first-connection lifecycle restriction, not an account-deletion product flow.
