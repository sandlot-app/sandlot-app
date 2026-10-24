-- Accepted groups keep a user and their session from being deleted, so their events
-- survive. session_id is NO ACTION, not RESTRICT, because deleting a game removes its
-- sessions and groups in one statement and only a check at the end of it allows that.
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
