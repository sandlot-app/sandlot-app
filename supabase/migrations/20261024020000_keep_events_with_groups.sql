-- Deleting a group no longer erases its events. NO ACTION, not RESTRICT, so that
-- deleting a game can still remove its groups and events in one statement.
alter table public.events
  drop constraint events_game_id_group_id_fkey,
  add constraint events_game_id_group_id_fkey
    foreign key (game_id, group_id) references public.groups (game_id, group_id) on delete no action;

-- Deleting an account checks these columns for remaining history.
create index groups_user_id_idx on public.groups (user_id);
create index groups_session_id_idx on public.groups (session_id);
create index scoring_sessions_user_id_idx on public.scoring_sessions (user_id);
