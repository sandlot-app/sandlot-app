create table private.request_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('voice', 'sync')),
  window_started_at timestamptz not null,
  requests integer not null check (requests between 1 and 120),
  primary key (user_id, scope)
);
alter table private.request_limits enable row level security;
revoke all on private.request_limits from public, anon, authenticated;
grant select, insert, update on private.request_limits to service_role;

create function private.admit_request(p_user_id uuid, p_scope text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  admitted integer;
  limit_count integer;
  window_start timestamptz := date_trunc('minute', statement_timestamp());
begin
  if p_scope not in ('voice', 'sync') or p_scope is null or p_user_id is null then
    return 'forbidden';
  end if;
  if p_scope = 'voice' and not exists (
    select 1 from public.scoring_sessions s
    join public.games g on g.id = s.game_id
    where s.user_id = p_user_id and s.epoch = g.lock_epoch
  ) then
    return 'forbidden';
  end if;
  limit_count := case p_scope when 'voice' then 30 else 120 end;
  insert into private.request_limits as current_limit (user_id, scope, window_started_at, requests)
  values (p_user_id, p_scope, window_start, 1)
  on conflict (user_id, scope) do update
    set window_started_at = excluded.window_started_at,
      requests = case when current_limit.window_started_at = excluded.window_started_at
        then current_limit.requests + 1 else 1 end
    where current_limit.window_started_at <> excluded.window_started_at
      or current_limit.requests < limit_count
  returning requests into admitted;
  return case when admitted is null then 'limited' else 'allowed' end;
end;
$$;
revoke all on function private.admit_request(uuid, text) from public, anon, authenticated;
grant execute on function private.admit_request(uuid, text) to service_role;
