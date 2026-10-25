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

## How it works

The page calls `get_snapshot(game_id, after_seq)` and subscribes to updates on its game's row in `public.games`.

- It fetches a snapshot when the subscription becomes active, and again after every reconnect.
- It fetches when a message carries a higher revision than the one shown. It ignores a message or snapshot with a lower revision.
- It also fetches on load and every 30 seconds, even while Realtime is down.
- It asks only for events after the last one it holds.

The page replays the events through `@sandlot/engine` one play at a time, so each play can show the score after it. If the engine version that recorded the game differs from the page's, or the engine rejects a stored play, the page shows the server's cached state and the plays without per-play scores.

Plays name players by ID only. The page never shows a name.

If the demo game is reset while a page is open, reload the page. A page ignores a lower revision by design.

## Layout

- `src/plays.ts` turns events into plays and the current state.
- `src/live.ts` is the reducer that applies snapshots to the page's model.
- `src/useLiveGame.ts` is the only module that touches supabase-js and timers.
- `src/components` holds the scoreboard, diamond, count and play list.
