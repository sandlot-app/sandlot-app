-- A game's video recording, from docs/contract.md: the clock offset lives here, not in the game's
-- fixed setup, because it is known only after the first pitch. The family live page reads it
-- to play the stream and to make each play's clip. Nobody writes it through the API: Kevin sets
-- it from the SQL editor or with the service role.

create table public.recordings (
  game_id uuid primary key references public.games (id) on delete cascade,
  -- The Mux playback ID of the live stream's active asset, not of the live stream itself. The
  -- live stream's own ID serves only the last 30 seconds, so older plays would have no clip.
  -- A reconnect after Mux's reconnect window starts a new asset, and this row takes its ID.
  playback_id text not null check (playback_id ~ '^[A-Za-z0-9]{1,128}$'),
  -- The recording's clock minus the scorer phone's clock, measured from a clap at the first pitch.
  clock_offset_ms integer not null default 0,
  created_at timestamptz not null default now()
);

-- A public playback ID plays for anyone who has it, whatever row-level security says. Until
-- playback is signed, only a public game, which today is only the adult demo game, has video.
-- Security definer, so the check sees the game whatever row-level security shows the writer.
create function private.require_public_game() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.games g where g.id = new.game_id and g.visibility = 'public') then
    raise exception 'only a public game can have a recording until playback is signed'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger recordings_public_games_only before insert or update on public.recordings
  for each row execute function private.require_public_game();

revoke execute on function private.require_public_game() from public, anon, authenticated;

revoke insert, update, delete, truncate on public.recordings from public, anon, authenticated;

alter table public.recordings enable row level security;

create policy "Recordings are readable wherever their game is" on public.recordings
  for select to anon, authenticated using (
    exists (select 1 from public.games g where g.id = recordings.game_id)
  );
