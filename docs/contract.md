# Sync contract

Last updated October 22, 2026. Christian Alcala.

Status: agreed. Christian and Kevin signed off in PR 2. The Event time section is a proposed addition that still needs Kevin's sign-off.

This is how plays move from the scorer's phone to the server and on to the family live page. It answers the open questions in Kevin's backend design, on the `docs/backend-design` branch. When this file and another doc disagree, this file wins. Change it only when both Christian and Kevin agree.

## Facts this contract rests on

- Supabase Edge Functions run on Deno. Today Deno cannot load the engine. `deno run` fails with `Module not found .../src/types`, because the engine imports have no `.ts` extension. With `--unstable-sloppy-imports`, the engine loads.
- Nobody has tried `supabase functions deploy` with the engine yet. The engine sits outside `supabase/functions/`.
- The engine's `apply` returns `not_implemented` for every command. `GameState` keeps no history of groups.
- Supabase anonymous users get the `authenticated` role, and their token carries `is_anonymous`. Realtime `postgres_changes` applies row-level security to `anon` when that role has a select grant. A new function in the `public` schema can be called by `anon` and `authenticated` through `/rest/v1/rpc` unless execute is revoked.

## Write path

The phone sends each group to one Edge Function, `sync-events`. The function checks the caller, runs the engine, and calls a database function, `commit_group`. `commit_group` saves the group in one transaction.

- No client role can insert, update, or delete rows in `games`, `events`, `groups`, or `scoring_sessions`.
- `commit_group` lives in a `private` schema that the API does not expose. `sync-events` calls it over the database connection. A `security definer` function sets `search_path = ''`.

## Numbering

- The phone gives each event the next `seq` for its game, starting at 1, with no gaps. Only the scorer's phone writes events, so `seq` has one source.
- The server's revision is the `seq` of the last accepted event. A new game is at revision 0.
- A group's first `seq` must be the revision plus 1. If it is not, the server returns `stale_revision`.
- Each group depends on every group before it. A rejected group blocks every group queued after it. The server never renumbers or skips a group.

## Request

```ts
type UploadRequest = { sessionId: SessionId; events: Event[] };
```

The server reads the game, the group, and the expected revision from the events. The parser rejects a request unless all of these hold:

- Every event has the same `gameId`, `group`, and `lockEpoch`.
- The `seq` values are consecutive.
- No event ID appears twice.
- The request has at most 20 events.

The caller's identity comes from the sign-in token only, never from the request body.

## Handler steps

`sync-events` does these steps in this order:

1. Reject a request with no token or an `anon` token.
2. Parse the request with `parseUploadRequest`.
3. Look up the group by `(game_id, group_id)`.
   - If the content hash and the user match, return the stored acknowledgment and stop.
   - If the hash differs, return `id_conflict` and stop.
4. Call `get_base(game_id)`. It returns the pins, the revision, and every accepted event in one statement.
5. If the revision is not the group's first `seq` minus 1, return `stale_revision`.
6. Replay the accepted events and apply the group with the engine. If the engine rejects any command, reject the whole group.
7. Call `commit_group(user_id, session_id, game_id, base_revision, events, new_state)`.

Step 3 comes before the engine on purpose. A retry after a lost response is a group the server already saved. Running it through the engine again would reject a play that is already accepted.

## Commit checks

`commit_group` locks the game row with `select ... for update`. Under the lock it does these checks:

- It looks up the group again, in case two identical requests race.
- It requires `games.revision = base_revision`, and `base_revision` equal to the first `seq` minus 1.
- It requires the session to belong to this user and this game, to be the game's current session, and to match every event's `lockEpoch`.

Then it writes the events, the group row, the new revision, and the cached state together. The group row holds `user_id`, `session_id`, `content_hash`, and `ack_revision`. `commit_group` computes the new revision as the highest `seq` in the group. It returns `id_conflict` for a `unique_violation`, not a server error.

## IDs

- `events` has primary key `(game_id, id)` and a unique key on `(game_id, seq)`. `groups` has primary key `(game_id, group_id)`.
- A reused ID with different content returns `id_conflict`.
- The content hash is SHA-256 of the parsed events with keys in a fixed order. Only the server computes it.
- `events.at` stores the original text from the phone, so it reads back exactly as sent.

## Event time

Proposed. Kevin's sign-off is still needed.

- `Event.at` is when the scorer started the action: the tap, or the start of the voice press. It is not when the group saved, which can be seconds later after a confirm card.
- Every event in one group has the same `at`.
- The phone's clock sets `at`, and the server never changes it.
- Highlight clips find a play in the game recording from `at` and the recording's clock offset. The play happens before the scorer starts the action, so a clip starts about 10 to 15 seconds before `at`.
- The clock offset lives with the recording in Kevin's `recordings` table, not in the game's `setup`. `setup` is fixed when the game is created, and the offset is known only after the first pitch. The engine never reads the offset.

## Engine interface

Christian owns these functions:

- `applyGroup(setup, events, commands)` returns the new state or one reject code. It applies all of the commands or none of them.
- `replay(setup, events)` builds the state from the start.
- `parseUploadRequest(unknown)` returns an `UploadRequest` or an error. It has no dependencies. It is one exhaustive `switch` over `Command['kind']`, so a new command kind does not compile until the parser handles it. A test parses one example of every kind.

The engine takes the event list rather than a cached state, because undo needs to know which groups exist. The game's roster IDs are part of `setup`, and the engine rejects a player ID that is not on the roster. Time comes only from `Event.at` and the `start` command.

The contract types and `parseUploadRequest` live in `packages/engine/src/contract.ts`. Engine imports use `.ts` extensions with `allowImportingTsExtensions`, so Deno, Metro, and Vitest load the same files. `tsconfig.base.json` already sets `noEmit`, which that option requires.

## Version pins

- Each `games` row stores `engine_version`, `schema_version`, the fully resolved `rules`, and `setup`. A trigger blocks changes to them after insert.
- The engine exports `ENGINE_VERSION` and `EVENT_SCHEMA_VERSION`. CI fails if fixture results change and `ENGINE_VERSION` does not.
- The server refuses to write to a game pinned to a different engine version and returns `unsupported_version`. The phone reads the pins when it opens a game. If they do not match its own engine, it does not score the game.

## Undo

- Undo is an ordinary group with one `undo` command. It targets the latest group that is not already undone, whether that group is accepted or still on the phone.
- An undo group cannot itself be undone. The demo has no redo.

## Errors

The phone takes one action for each error:

| Error | HTTP status | Phone action |
| --- | --- | --- |
| Network failure | none | Retry the same request later |
| Server error | 5xx | Retry the same request later |
| `unauthenticated` | 401 | Refresh the token, then retry |
| `invalid` | 400 | Stop the queue. The phone has a bug. |
| `rejected` | 422 | Stop the queue and show that sync is stuck |
| `id_conflict` | 409 | Stop the queue. The phone has a bug. |
| `stale_revision` | 409 | Stop the queue. Another writer moved the game, or an earlier group is missing. |
| `stale_session` | 403 | Stop the queue. Someone else now holds scoring. |
| `unsupported_version` | 409 | Stop the queue and ask the scorer to update the app |

When the queue stops, the phone shows how many plays are waiting, for example "3 plays waiting. Tap to fix." The fix is **Discard from here**. It deletes the stuck group and every group after it on the phone, and it runs only when the scorer taps it. The phone never deletes pending plays on its own.

## Scoring handoff

`take_over(game_id, user_id)` locks the same game row, raises the epoch, and starts a new session. Only the service role can call it. No screen uses it before the beta. It exists so that the race and stale-epoch tests can run.

## Live page

- `get_snapshot(game_id, after_seq)` returns the revision, the cached state, and the events after `after_seq`. The page asks only for events it does not have yet.
- The page subscribes to updates on its game's row. When the subscription is active, the page fetches a snapshot. It fetches again after every reconnect.
- The page fetches when a message or a snapshot has a higher revision than the one shown. It ignores any message or snapshot with a lower revision. While connected, it also fetches every 30 seconds.
- Messages and snapshots carry player IDs, never names.

## Demo access

- `games.visibility` is `private` or `public`. Anyone can read a public game and its events. Only the demo game is public. Access comes from that column, not from a secret link.
- The scorer signs in anonymously on the phone. A seed script makes that user the demo game's scorer.
- A policy lets a scorer read their own game and session.
- Scorer and owner columns live in `scoring_sessions`, not `games`, because every live page viewer receives the whole `games` row.
- Anonymous sign-in has CAPTCHA or rate limits turned on. A test checks that an anonymous user cannot read a private game.
- A reinstall of Expo Go creates a new anonymous user. Before each rehearsal, rerun the seed script and reset the demo game.

## Demo scope

The demo meets every milestone 6 check in Kevin's design, with these changes:

- Scoring handoff has `take_over` and its tests, but no screen.
- Rejected work has **Discard from here**, but no review screen.
- A version mismatch refuses to score. There is no upgrade path.
- Corrections to older plays wait for the beta.

Kevin must agree to these changes before they count.

## First connection test

This test proves the connection works. It does not finish milestone 6.

1. Deploy a function that imports `ENGINE_VERSION` from the engine and returns it. If the deploy fails, fix that before anything else.
2. Christian switches the engine to `.ts` imports. `pnpm --filter @sandlot/engine sample-events` prints a half-inning as `UploadRequest[]`.
3. Kevin adds the tables, `commit_group`, `get_base`, the row-level security policies, Realtime on `games`, and `sync-events`.
4. The engine has no game logic yet, so `sync-events` skips the engine step for now. A milestone 6 test requires the engine step, so this shortcut cannot reach the demo.
5. Christian sends the sample requests twice. The second run returns the same acknowledgments and adds no rows. Kevin's page shows each play once.
6. When milestone 3 lands, delete the test games.

## Process

- This contract merged before Christian's doc branches. `docs/growth-decisions` carries `docs/family-features` and `docs/demo-plan`, rebased onto `main`. After it merges, Kevin rebases `docs/backend-design` onto `main` and resolves its conflicts.
- `plan.md` and `demo-plan.md` link to this file instead of repeating the contract.
- AGENTS.md says only Christian merges. Whether Kevin can also merge after review is still open.
