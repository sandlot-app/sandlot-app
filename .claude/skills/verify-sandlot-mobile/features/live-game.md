# Live game

The live game is the demo game on the server. The seed script makes this phone its scorer, and Start live game on Your games opens it. Every play saves on the phone first, then uploads to `sync-events` in order. The sync line reads "All plays saved" once the server has every play, "Saving..." while plays upload, and "Offline · N plays saved on this phone" while they wait. When the server refuses a play, the line reads "N plays waiting · Sync stopped: <reason>" and every play stays on the phone. The local demo game stays as it was and never uploads.

## Sub-features

- `live-start` finds the game this phone scores. Before the seed, it shows "This phone isn’t the demo game’s scorer yet" and the phone ID the seed needs (`start-live`, `live-message`).
- `live-upload` sends each play exactly as saved and counts it as uploaded only once the server acknowledges it (`waiting-plays`, `live-waiting`).
- `live-offline` keeps scoring with no answer from the server, and the waiting plays upload on the next try (every 15 seconds while the app is open, and when it comes back to the front).
- `live-stopped` stops the queue on a contract error (update the app, a play was rejected, another phone is scoring, the server’s game differs). Discard from here waits for a design.

## How to get to it (user POV)

- Your games → Start live game, or Continue scoring on the Live demo card.

## Driving it with Maestro

Preconditions:

- A Supabase project the app points at: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` exported in the shell that runs `verify.sh launch`, with `sync-events` serving. Locally, that's `supabase start` and `supabase functions serve sync-events`, and the simulator reaches it at `127.0.0.1`.
- Never seed or reset the hosted project without Christian's OK for that step.

- **Before the seed.** Run `verify.sh drive live-game-unseeded.yaml`. It taps Start live game and sees the phone ID (screenshot `live-needs-seed`). Read the ID from the drive's `hierarchy.json`.
- **Seed.** `psql "$SUPABASE_DB_URL" -v scorer=<phone ID> -v pins="$(pnpm -s --filter @sandlot/mobile demo-pins)" -f supabase/scripts/seed-test-game.sql` prints the game and session IDs.
- **Scoring uploads.** Run `verify.sh drive live-game.yaml`. It starts the live game, records a ball and a foul, sees "All plays saved" after each (screenshot `live-all-saved`), and sees "Every play is on the server." on Your games.
- **No signal, then back.** Stop `sync-events`, run `verify.sh drive live-game-offline.yaml` (a ball waits: "Offline · 1 play saved on this phone"), start `sync-events` again, and run `verify.sh drive live-game-reconnect.yaml` (it uploads with no tap).
- **Stopped queue.** Hand the game's scoring to another user (`select private.take_over('<game>', '<other user>')`), run `verify.sh drive live-game-stopped.yaml` (a ball waits: "1 play waiting · Sync stopped: another phone is scoring"), give scoring back on a local database, and run `verify.sh drive live-game-resumed.yaml` (reopening the game sends it).
- **Second device.** Open the family live page at `?game=<game ID>` against the same project and check its score, inning, count and outs match the phone's `score-summary`.

## Gotchas

- The local and live games are separate files on the phone (`sandlot-games.db`, `sandlot-synced.db`). Never clear app data to reset one.
- The phone reads its session and game through the `scoring_sessions` and `games` select grants the hosted project has. A local stack from a newer Supabase CLI may not grant them; run `grant select on public.games, public.scoring_sessions, public.events to anon, authenticated;` on that local database only.
- Reinstalling Expo Go signs the phone in as a new anonymous user, so the seed has to run again for the new phone ID.
- A seeded game must be fresh (revision 0) and carry the phone's own demo pins, or Start live game says the server's game can't take this app's plays.
