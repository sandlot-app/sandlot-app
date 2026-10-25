-- The read path from docs/contract.md. The family live page calls get_snapshot through
-- /rest/v1/rpc. It is security invoker on purpose, so row-level security on games and
-- events decides who sees what. An anon caller sees only public games and a scorer also
-- sees their own. One statement keeps the revision, the state and the events consistent.

create function public.get_snapshot(p_game_id uuid, p_after_seq integer default 0) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'gameId', g.id,
    'revision', g.revision,
    'engineVersion', g.engine_version,
    'schemaVersion', g.schema_version,
    'rules', g.rules,
    'setup', g.setup,
    'state', g.state,
    'events', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', e.id, 'gameId', e.game_id, 'seq', e.seq, 'group', e.group_id,
            'lockEpoch', e.lock_epoch, 'source', e.source, 'at', e.at, 'command', e.command
          ) order by e.seq
        )
        from public.events e where e.game_id = g.id and e.seq > p_after_seq
      ),
      '[]'::jsonb
    )
  )
  from public.games g where g.id = p_game_id
$$;

revoke execute on function public.get_snapshot(uuid, integer) from public, anon, authenticated;
grant execute on function public.get_snapshot(uuid, integer) to anon, authenticated;
