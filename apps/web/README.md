# Sandlot family live page

A web page where a family member follows a game as it is scored. It shows the score, the inning, the outs, the count, a diamond with the occupied bases, and the play-by-play with the newest play first. There is no login and no app to install.

The page follows the contract in [docs/contract.md](../../docs/contract.md), in the "Live page" and "Demo access" sections.

## URL

```
https://<host>/?game=<game uuid>
```

The game must be public. A missing, malformed or private game shows "Game not found or not public."

## Settings

Copy `.env.example` to `.env` and fill in both values. Vite reads them when it builds.

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | The project URL |
| `VITE_SUPABASE_ANON_KEY` | The project's anon key |

The anon key is public by design and ends up in the built files. Never put the service role key here. `.env` files are ignored by git.

## Commands

```
pnpm --filter @sandlot/web dev
pnpm --filter @sandlot/web build
pnpm --filter @sandlot/web preview
pnpm --filter @sandlot/web test
```

`build` writes a static site to `apps/web/dist`. It uses relative asset paths, so any static host works, at the root or under a path. The host needs no server code and no rewrite rules.

## Deploy on Vercel

The page is hosted on Vercel. Create one project from this repository with these settings:

| Setting | Value |
| --- | --- |
| Root Directory | `apps/web`, with "Include files outside the root directory" left on so the engine package is found |
| Framework Preset | Vite. The build command (`pnpm build`) and output directory (`dist`) are its defaults. |
| Node.js Version | 22.x |
| Environment variables | `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for Production and Preview, plus `ENABLE_EXPERIMENTAL_COREPACK=1` so the build uses the pnpm version in the root `package.json` |

Vercel installs from the workspace root's `pnpm-lock.yaml`. Vite writes the two Supabase values into the built files, so changing either one needs a redeploy.

Every push to `main` deploys to production, and every pull request gets a preview URL. Once the product link is in the YC application, turn off automatic production deploys or pin the production deployment, so the link stays unchanged until YC decides.

## How it works

The page calls `get_snapshot(game_id, after_seq)` and subscribes to updates on its game's row in `public.games`.

- It fetches a snapshot when the subscription becomes active, and again after every reconnect.
- It fetches when a message carries a higher revision than the one shown. It ignores a message or snapshot with a lower revision.
- It also fetches on load and every 30 seconds, even while Realtime is down.
- It asks only for events after the last one it holds.
- It sends one request at a time. A request that takes longer than 10 seconds is cancelled, the page shows "Reconnecting", and the next fetch goes ahead.

The page replays the events through `@sandlot/engine` one play at a time, so each play can show the score after it. If the engine version that recorded the game differs from the page's, or the engine rejects a stored play, the page shows the server's cached state and the plays without per-play scores.

Plays name players by ID only. The page never shows a name.

If the demo game is reset while a page is open, reload the page. A page ignores a lower revision by design.

## Video and clips

The page shows video only when the game has a row in `public.recordings`. Without one, the page looks exactly as before. The page checks for a recording on load and every 30 seconds until it finds one, so a stream can start mid-game.

To add the demo game's video, start a Mux live stream, stream to it from a second phone (Larix works), and run this in the Supabase SQL editor:

```sql
insert into public.recordings (game_id, playback_id, clock_offset_ms)
values ('<game id>', '<Mux playback ID>', 0)
on conflict (game_id) do update set playback_id = excluded.playback_id, clock_offset_ms = excluded.clock_offset_ms;
```

`clock_offset_ms` is the recording's clock minus the scorer phone's clock. Measure it from the clap at the first pitch, then update the row.

- The stream plays under the live score, with the caption "The stream can run a few seconds behind the score."
- Each play on the field gets a Watch button. Its clip is the Mux playback URL with `program_start_time` and `program_end_time`, from 12 seconds before the scorer started the play to 5 seconds after. Mux needs up to about 15 seconds after a play before its clip plays.
- Safari and recent Chrome play HLS themselves. Other browsers load the light build of hls.js, only when a game has video.
- The playback ID is public. That's fine for the adult demo game. Use signed playback before any game with children.

## Layout

- `src/plays.ts` turns events into plays and the current state.
- `src/live.ts` is the reducer that applies snapshots to the page's model.
- `src/useLiveGame.ts` is the only module that touches supabase-js.
- `src/snapshotFetcher.ts` sends one `get_snapshot` call at a time and gives up on a call after 10 seconds.
- `src/clips.ts` reads a recording and makes a play's clip URL.
- `src/components` holds the scoreboard, diamond, count, play list and the stream card.
