-- Clears first-connection test games pinned to an older engine or schema, the reset #21 asks for
-- before the schema-2 rehearsal. Pass the current pins, the same ones the seed script writes.
--
-- List the targets. This changes nothing.
-- psql "$SUPABASE_DB_URL" -v pins="$(pnpm -s --filter @sandlot/engine sample-events --pins)" -f supabase/scripts/reset-test-games.sql
--
-- Delete the listed games you name, with their sessions, groups and events.
-- psql "$SUPABASE_DB_URL" -v pins="..." -v ids=<game id>,<game id> -f supabase/scripts/reset-test-games.sql
--
-- Deletion refuses the whole list if any ID is unknown or names a game pinned to the current versions.
-- The whole script is one transaction, so a transaction pooler keeps it on one connection.
\set ON_ERROR_STOP on
begin;

create or replace function pg_temp.stale_games(p_pins jsonb)
returns table (game_id uuid, visibility text, engine_version text, schema_version integer,
               revision integer, events bigint, created_at timestamptz)
language plpgsql stable as $$
begin
  if p_pins ->> 'engineVersion' is null or p_pins ->> 'schemaVersion' is null then
    raise exception 'pins must carry engineVersion and schemaVersion';
  end if;

  return query
  select g.id, g.visibility, g.engine_version, g.schema_version, g.revision,
         (select count(*) from public.events e where e.game_id = g.id), g.created_at
  from public.games g
  where (g.engine_version, g.schema_version)
        is distinct from (p_pins ->> 'engineVersion', (p_pins ->> 'schemaVersion')::integer)
  order by g.created_at;
end
$$;

create or replace function pg_temp.delete_stale_games(p_pins jsonb, p_ids uuid[])
returns table (game_id uuid, engine_version text, schema_version integer, events bigint)
language plpgsql as $$
declare
  refused uuid[];
begin
  if coalesce(cardinality(p_ids), 0) = 0 then
    raise exception 'ids is empty';
  end if;

  -- Lock the targets so no upload commits to one between the check and the delete.
  perform 1 from public.games g where g.id = any (p_ids) for update;

  select array_agg(t.id) into refused
  from unnest(p_ids) as t (id)
  where t.id not in (select s.game_id from pg_temp.stale_games(p_pins) s);
  if refused is not null then
    raise exception 'not an existing game pinned to an older engine or schema: %', refused;
  end if;

  return query
  with deleted as (
    delete from public.games g where g.id = any (p_ids)
    returning g.id, g.engine_version, g.schema_version
  )
  select d.id, d.engine_version, d.schema_version,
         (select s.events from pg_temp.stale_games(p_pins) s where s.game_id = d.id)
  from deleted d
  order by d.id;
end
$$;

\echo 'Comparing against these pins. They must match the deployed sync-events:'
select :'pins'::jsonb ->> 'engineVersion' as engine_version,
       :'pins'::jsonb ->> 'schemaVersion' as schema_version;

\if :{?ids}
select * from pg_temp.delete_stale_games(:'pins'::jsonb,
  array(select trim(i)::uuid from unnest(string_to_array(:'ids', ',')) as i where trim(i) <> ''));
\echo 'Games left on older pins:'
\endif
select * from pg_temp.stale_games(:'pins'::jsonb);

commit;
