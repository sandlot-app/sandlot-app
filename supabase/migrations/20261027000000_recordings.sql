-- A game's video recording, from docs/contract.md: the clock offset lives here, not in the game's
-- fixed setup, because it is known only after the first pitch. The family live page reads it
-- to play the stream and to make each play's clip. Nobody writes it through the API: Kevin sets
-- it from the SQL editor or with the service role. Video and clips show only where the game
-- does, so for now only the public adult demo game has one.

create table public.recordings (
  game_id uuid primary key references public.games (id) on delete cascade,
  -- A Mux playback ID. Clips add program_start_time and program_end_time to its URL.
  playback_id text not null check (playback_id ~ '^[A-Za-z0-9]{1,128}$'),
  -- The recording's clock minus the scorer phone's clock, measured from a clap at the first pitch.
  clock_offset_ms integer not null default 0,
  created_at timestamptz not null default now()
);

revoke insert, update, delete, truncate on public.recordings from public, anon, authenticated;

alter table public.recordings enable row level security;

create policy "Recordings are readable wherever their game is" on public.recordings
  for select to anon, authenticated using (
    exists (select 1 from public.games g where g.id = recordings.game_id)
  );
