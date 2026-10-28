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

The page shows video only when the game has a row in `public.recordings`. Without one, the page looks exactly as before. The page reads the row on load and every 30 seconds, so a stream can start mid-game, and an open page picks up a changed offset or playback ID within 30 seconds. Only a public game can have a row, because a public playback ID plays for anyone who has it.

To add the demo game's video:

1. Create a Mux live stream with a public playback policy, and stream to it from a second phone (Larix works).
2. Once the phone is streaming, open the live stream in the Mux dashboard and find its active asset. Use that asset's playback ID, not the live stream's. The live stream's own ID serves only the last 30 seconds, so older plays would have no clip. The asset's ID plays the stream live with seeking back, and keeps playing the recording after the game.
3. Run this in the Supabase SQL editor:

```sql
insert into public.recordings (game_id, playback_id, clock_offset_ms)
values ('<game id>', '<active asset playback ID>', 0)
on conflict (game_id) do update set playback_id = excluded.playback_id, clock_offset_ms = excluded.clock_offset_ms;
```

`clock_offset_ms` is the recording's clock minus the scorer phone's clock. Measure it from the clap at the first pitch with the clap tool below, then run the SQL it gives you.

If the streaming phone drops for longer than Mux's reconnect window, 60 seconds by default, Mux starts a new asset. Update the row with the new asset's playback ID. Plays from before the drop then lose their clips.

- The stream plays under the live score, with the caption "The stream can run a few seconds behind the score."
- Each play on the field gets a Watch button. Its clip is the Mux playback URL with `program_start_time` and `program_end_time`, from 12 seconds before the scorer started the play to 5 seconds after. Mux needs up to about 15 seconds after a play before its clip plays, and plays from before the video started have no clip.
- Safari and recent Chrome play HLS themselves. Other browsers load the light build of hls.js, only when a game has video.
- The playback ID is public. That's fine for the adult demo game. Use signed playback before any game with children.

## Filming-day tools

Two tools open from the game's link. Both only read the public game, like the page.

- **Clap offset**, at `/?game=<game id>&calibrate`. Pause the recording on the clap, pick the play the clap matches (the first pitch by default), and press "The clap is here". The page reads where the video is on the recording's own clock, works out `clock_offset_ms`, and shows the SQL to run, with that play's clip under it. The clap should come about 12 seconds into the clip. Use a desktop browser.
- **Play to page**, at `/?game=<game id>&timer`. The normal page with a panel that times each new play from the moment the scorer started it to the moment this page shows it, with the median and the slowest. Plays already scored when the page opened don't count. The scorer's phone and this device both need their clocks set automatically, or the difference between them shows up in every number.

## Layout

- `src/plays.ts` turns events into plays and the current state.
- `src/live.ts` is the reducer that applies snapshots to the page's model.
- `src/useLiveGame.ts` is the only module that touches supabase-js.
- `src/snapshotFetcher.ts` sends one `get_snapshot` call at a time and gives up on a call after 10 seconds.
- `src/clips.ts` reads a recording and makes a play's clip URL.
- `src/components` holds the scoreboard, field, play list and the stream card, and the two filming-day tools.
- `src/tools.ts` has the filming-day tools' arithmetic.
