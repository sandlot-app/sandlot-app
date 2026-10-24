-- Creates a public test game for the first connection test and makes `scorer` its scorer.
-- psql "$SUPABASE_DB_URL" -v scorer=<auth user id> -f supabase/scripts/seed-test-game.sql
\set ON_ERROR_STOP on

insert into public.games (visibility, engine_version, schema_version, rules, setup)
values ('public', '0.1.0-alpha.1', 2, '{}', '{}')
returning id as game_id \gset

select :'game_id' as game_id, private.take_over(:'game_id', :'scorer') as session_id;
