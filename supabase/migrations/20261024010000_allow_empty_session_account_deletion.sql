alter table public.scoring_sessions
  drop constraint scoring_sessions_user_id_fkey,
  add constraint scoring_sessions_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade;
