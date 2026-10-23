-- The write path from docs/contract.md. Clients only read. sync-events writes
-- through private.commit_group over the database connection.

create schema private;
revoke all on schema private from public, anon, authenticated;

create table public.games (
  id uuid primary key default gen_random_uuid(),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  engine_version text not null,
  schema_version integer not null,
  rules jsonb not null,
  setup jsonb not null,
  revision integer not null default 0 check (revision >= 0),
  lock_epoch integer not null default 0 check (lock_epoch >= 0),
  state jsonb,
  created_at timestamptz not null default now()
);

create table public.scoring_sessions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  epoch integer not null check (epoch > 0),
  started_at timestamptz not null default now(),
  unique (game_id, epoch)
);

create table public.groups (
  game_id uuid not null references public.games (id) on delete cascade,
  group_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null references public.scoring_sessions (id) on delete cascade,
  content_hash text not null,
  ack_revision integer not null,
  created_at timestamptz not null default now(),
  primary key (game_id, group_id)
);

create table public.events (
  game_id uuid not null references public.games (id) on delete cascade,
  id text not null,
  seq integer not null check (seq > 0),
  group_id text not null,
  lock_epoch integer not null,
  source text not null check (source in ('tap', 'voice')),
  at text not null,
  command jsonb not null,
  primary key (game_id, id),
  unique (game_id, seq),
  foreign key (game_id, group_id) references public.groups (game_id, group_id) on delete cascade
);

create function private.block_pin_changes() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.engine_version, new.schema_version, new.rules, new.setup)
     is distinct from (old.engine_version, old.schema_version, old.rules, old.setup) then
    raise exception 'a game''s engine version, schema version, rules and setup are fixed when it is created'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger games_pins_fixed before update on public.games
  for each row execute function private.block_pin_changes();

revoke insert, update, delete, truncate on public.games, public.events, public.scoring_sessions from anon, authenticated;
revoke all on public.groups from anon, authenticated;

alter table public.games enable row level security;
alter table public.scoring_sessions enable row level security;
alter table public.groups enable row level security;
alter table public.events enable row level security;

create policy "Anyone reads a public game" on public.games
  for select to anon, authenticated using (visibility = 'public');

create policy "A scorer reads their own game" on public.games
  for select to authenticated using (
    exists (
      select 1 from public.scoring_sessions s
      where s.game_id = games.id and s.user_id = (select auth.uid())
    )
  );

create policy "Events are readable wherever their game is" on public.events
  for select to anon, authenticated using (
    exists (select 1 from public.games g where g.id = events.game_id)
  );

create policy "A scorer reads their own sessions" on public.scoring_sessions
  for select to authenticated using (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.games;

create function private.get_base(p_game_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'engineVersion', g.engine_version,
    'schemaVersion', g.schema_version,
    'rules', g.rules,
    'setup', g.setup,
    'revision', g.revision,
    'state', g.state,
    'events', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', e.id, 'gameId', e.game_id, 'seq', e.seq, 'group', e.group_id,
            'lockEpoch', e.lock_epoch, 'source', e.source, 'at', e.at, 'command', e.command
          ) order by e.seq
        )
        from public.events e where e.game_id = g.id
      ),
      '[]'::jsonb
    )
  )
  from public.games g where g.id = p_game_id
$$;

create function private.commit_group(
  p_user_id uuid,
  p_session_id uuid,
  p_game_id uuid,
  p_base_revision integer,
  p_events jsonb,
  p_new_state jsonb,
  p_content_hash text
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_game public.games%rowtype;
  v_group public.groups%rowtype;
  v_group_id text := p_events -> 0 ->> 'group';
  v_first_seq integer := (p_events -> 0 ->> 'seq')::integer;
  v_revision integer;
begin
  select * into v_game from public.games where id = p_game_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  -- Two identical requests can both pass sync-events' lookup before either commits.
  select * into v_group from public.groups where game_id = p_game_id and group_id = v_group_id;
  if found then
    if v_group.content_hash = p_content_hash and v_group.user_id = p_user_id then
      return jsonb_build_object('ok', true, 'revision', v_group.ack_revision);
    end if;
    return jsonb_build_object('ok', false, 'code', 'id_conflict');
  end if;

  if v_game.revision <> p_base_revision or p_base_revision <> v_first_seq - 1 then
    return jsonb_build_object('ok', false, 'code', 'stale_revision');
  end if;

  if not exists (
       select 1 from public.scoring_sessions s
       where s.id = p_session_id and s.game_id = p_game_id
         and s.user_id = p_user_id and s.epoch = v_game.lock_epoch
     )
     or exists (
       select 1 from jsonb_array_elements(p_events) e
       where (e ->> 'lockEpoch')::integer <> v_game.lock_epoch
     ) then
    return jsonb_build_object('ok', false, 'code', 'stale_session');
  end if;

  select max((e ->> 'seq')::integer) into v_revision from jsonb_array_elements(p_events) e;

  insert into public.groups (game_id, group_id, user_id, session_id, content_hash, ack_revision)
  values (p_game_id, v_group_id, p_user_id, p_session_id, p_content_hash, v_revision);

  insert into public.events (game_id, id, seq, group_id, lock_epoch, source, at, command)
  select p_game_id, e ->> 'id', (e ->> 'seq')::integer, e ->> 'group',
         (e ->> 'lockEpoch')::integer, e ->> 'source', e ->> 'at', e -> 'command'
  from jsonb_array_elements(p_events) e;

  update public.games set revision = v_revision, state = p_new_state where id = p_game_id;

  return jsonb_build_object('ok', true, 'revision', v_revision);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'code', 'id_conflict');
end $$;

-- Only the service role calls this. No screen uses it before the beta.
create function private.take_over(p_game_id uuid, p_user_id uuid) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_epoch integer;
  v_session_id uuid;
begin
  update public.games set lock_epoch = lock_epoch + 1 where id = p_game_id
  returning lock_epoch into v_epoch;
  if not found then
    raise exception 'game % does not exist', p_game_id using errcode = 'no_data_found';
  end if;

  insert into public.scoring_sessions (game_id, user_id, epoch)
  values (p_game_id, p_user_id, v_epoch)
  returning id into v_session_id;

  return v_session_id;
end $$;

revoke execute on all functions in schema private from public, anon, authenticated;
