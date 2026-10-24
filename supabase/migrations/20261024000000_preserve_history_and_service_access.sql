alter table public.scoring_sessions
  drop constraint scoring_sessions_user_id_fkey,
  add constraint scoring_sessions_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete restrict;

alter table public.groups
  drop constraint groups_user_id_fkey,
  add constraint groups_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete restrict,
  drop constraint groups_session_id_fkey,
  add constraint groups_session_id_fkey
    foreign key (session_id) references public.scoring_sessions (id) on delete no action;

revoke all on schema private from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
revoke insert, update, delete, truncate
  on public.games, public.events, public.groups, public.scoring_sessions
  from public, anon, authenticated;
revoke all on public.groups from public, anon, authenticated;

grant usage on schema private to service_role;
grant execute on function private.get_base(uuid), private.take_over(uuid, uuid),
  private.commit_group(uuid, uuid, uuid, integer, jsonb, jsonb, text)
  to service_role;
grant select on public.games, public.events, public.groups, public.scoring_sessions to service_role;
grant insert on public.events, public.groups, public.scoring_sessions to service_role;
grant update on public.games to service_role;
