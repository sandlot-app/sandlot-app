-- Creates a public test game for the first connection test and makes `scorer` its scorer.
-- The game takes its version pins, rules and setup from `pins`, so the engine can play it.
-- psql "$SUPABASE_DB_URL" -v scorer=<auth user id> -v pins="$(pnpm -s --filter @sandlot/engine sample-events --pins)" -f supabase/scripts/seed-test-game.sql
\set ON_ERROR_STOP on

insert into public.games (visibility, engine_version, schema_version, rules, setup)
values (
  'public',
  :'pins'::jsonb ->> 'engineVersion',
  (:'pins'::jsonb ->> 'schemaVersion')::integer,
  :'pins'::jsonb -> 'rules',
  :'pins'::jsonb -> 'setup'
)
returning id as game_id \gset

select :'game_id' as game_id, private.take_over(:'game_id', :'scorer') as session_id;
