# Sync contract

Last updated October 24, 2026. Christian Alcala.

Status: agreed. Christian and Kevin signed off in PR 2, on the Event time section in PR 3, and on the duplicate recheck in handler steps 3 and 5 in PR 8. The schema-2 out classification below was agreed by [Kevin](https://github.com/sandlot-app/sandlot-app/issues/13#issuecomment-6381341472) and [Christian](https://github.com/sandlot-app/sandlot-app/issues/13#issuecomment-6381412333).

This is how plays move from the scorer's phone to the server and on to the family live page. It answers the open questions in Kevin's backend design, on the `docs/backend-design` branch. When this file and another doc disagree, this file wins. Change it only when both Christian and Kevin agree.

## Facts this contract rests on

- Supabase Edge Functions run on Deno. Before PR 8, Deno could not load the engine: `deno run` failed with `Module not found .../src/types`, because the engine imports had no `.ts` extension. PR 8 switched the engine to `.ts` imports.
- Nobody has tried `supabase functions deploy` with the engine yet. The engine sits outside `supabase/functions/`.
- The pure engine applies plays through `applyGroup` and rebuilds state through `replay`. Before milestone 6, the first-connection handler bypassed gameplay validation. It now applies every group with `applyGroup` before it saves.
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
type UploadRequest = { schemaVersion: typeof EVENT_SCHEMA_VERSION; sessionId: SessionId; events: Event[] };
```

The server reads the game, the group, and the expected revision from the events. The parser rejects a request unless all of these hold:

- `schemaVersion` is the engine's `EVENT_SCHEMA_VERSION`. The parser first checks the envelope that every schema version shares: the body is an object, `sessionId` is non-empty text, and `events` is a non-empty array. A body that fails this returns `invalid`. The parser then checks `schemaVersion`. A missing or different value returns `unsupported_version`, not `invalid`, before the parser checks the session ID format, the event count, any event, or any command.
- Every event has the same `gameId`, `group`, and `lockEpoch`.
- The `seq` values are consecutive.
- No event ID appears twice.
- The request has at most 20 events.

The caller's identity comes from the sign-in token only, never from the request body.

## Handler steps

`sync-events` does these steps in this order:

1. Reject a request with no token or an `anon` token.
2. Parse the request with `parseUploadRequest`. A request with a missing or different `schemaVersion` returns `unsupported_version`. Any other malformed request returns `invalid`.
3. Look up the group by `(game_id, group_id)`.
   - If the content hash and the user match, return the stored acknowledgment and stop.
   - If the hash or the user differs, return `id_conflict` and stop.
   - If the group is not there, check that the request's session is this user's current session for the game and that its epoch matches the events' `lockEpoch`. If not, return `stale_session` and stop. A caller who does not hold scoring never reaches the engine. `commit_group` checks again under the lock.
4. Call `get_base(game_id)`. It returns the pins, the revision, and every accepted event in one statement.
   - If the game's `engineVersion` pin differs from the server's `ENGINE_VERSION`, or its `schemaVersion` pin differs from the request's `schemaVersion`, return `unsupported_version` and stop.
5. If the revision is not the group's first `seq` minus 1, look up the group again. If it is there now, apply the rule in step 3. If it is still missing, return `stale_revision`.
6. Replay the accepted events and apply the group with the engine. If the engine rejects any command, reject the whole group. The `rejected` response carries the engine's reject code as `reason`.
   - Before it returns `rejected`, look up the group again. If an accepted group with that ID is there now, apply the rule in step 3 instead.
7. Call `commit_group(user_id, session_id, game_id, base_revision, events, new_state, content_hash)`. `new_state` is the state the engine returned in step 6. The handler computes `content_hash` in step 3.

Step 3 comes before the engine on purpose. A retry after a lost response is a group the server already saved. Running it through the engine again would reject a play that is already accepted.

The session check in step 3 comes before `get_base` because `sync-events` reads the game as the database owner. Without the check, a caller who does not hold scoring could learn a private game's state from the `reason` on a `rejected` response.

Step 5 looks again because two identical requests can both miss the group in step 3. One commits first, and the other then sees a higher revision. Without the second lookup, that retry would get `stale_revision` and stop the phone's queue over a play the server already holds.

Step 6 looks again because two requests with the same group ID can both read the same base. One commits first. The other can be illegal against the base it read, even though its group ID is now taken. A reused ID with different content is the phone's bug, so it returns `id_conflict`, not a rule rejection.

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

Agreed in PR 3.

- `Event.at` is when the scorer started the action: the tap, or the start of the voice press. It is not when the group saved, which can be seconds later after a confirm card.
- Every event in one group has the same `at`.
- The phone's clock sets `at`, and the server never changes it.
- Highlight clips find a play in the game recording from `at` and the recording's clock offset. The play happens before the scorer starts the action, so a clip starts about 10 to 15 seconds before `at`.
- The clock offset lives with the recording in Kevin's `recordings` table, not in the game's `setup`. `setup` is fixed when the game is created, and the offset is known only after the first pitch. The engine never reads the offset.

## Engine interface

Christian owns these functions:

- `applyGroup(setup, events, commands)` returns the new state or one reject code. It applies all of the commands or none of them.
- `replay(setup, events)` builds the state from the start.
- `parseUploadRequest(unknown)` returns an `UploadRequest`, `invalid`, or `unsupported_version`. It has no dependencies. It is one exhaustive `switch` over `Command['kind']`, so a new command kind does not compile until the parser handles it. A test parses one example of every kind.

The engine takes the event list rather than a cached state, because undo needs to know which groups exist. The game's roster IDs are part of `setup`, and the engine rejects a player ID that is not on the roster. Time comes only from `Event.at` and the `start` command.

The contract types and `parseUploadRequest` live in `packages/engine/src/contract.ts`. Engine imports use `.ts` extensions with `allowImportingTsExtensions`, so Deno, Metro, and Vitest load the same files. `tsconfig.base.json` already sets `noEmit`, which that option requires.

## Ball-in-play outs and runs

A ball in play holds an `in_play` pitch followed by its outcome in the same play. Every explicit out in `ball_in_play.advances` records its classification.

```ts
type OutType = 'force' | 'batter_before_first' | 'non_force';
type Advance =
	| { runner: PlayerRef; to: Exclude<Destination, 'out'>; outType?: never }
	| { runner: PlayerRef; to: 'out'; outType: OutType };
```

| Value | Meaning |
| --- | --- |
| `force` | An existing runner is retired while still forced to advance. A tag of the runner can be a force out. |
| `batter_before_first` | The current batter is retired before legally reaching first, including the ordinary caught-ball or ground-out default. |
| `non_force` | An ordinary supported tag without a force. For the batter, this asserts that first was already legally reached. |

The scorer records what happened. Starting bases alone cannot prove that a force remained active after a runner touched the required base. The later scorer UI prefills the usual classification from the bases and asks the parent when the answer could change whether a run counts. This issue adds no tap or voice UI.

### Defaults, out order, and crossings

- Single, double, ground-rule double, triple, and home run keep their batter destinations. Error and fielder's choice put the batter on first unless listed.
- Out, sacrifice fly, and sacrifice bunt put an omitted batter out with `batter_before_first`. That implied out occurs before explicit outs. To record another classification or order, list the batter explicitly. Mustang still rejects bunts.
- Double and triple plays require an explicit batter destination and exactly two or three outs.
- Explicit outs occur in `advances` array order. Safe destinations describe final bases, not intermediate touches or timing.
- A home entry asserts an eligible crossing before the third out, if any. Omit crossings after the third out. `Event.at` does not establish timing within a play.
- Under [OBR 5.08(a) and 5.09(b)(6)](https://mktg.mlbstatic.com/mlb/official-information/2026-official-baseball-rules.pdf), a third out classified as `force` or `batter_before_first` suppresses every run on that play. Otherwise eligible home entries count. An earlier force out alone does not suppress a run on a later non-force third out.
- In the home half of the last regulation inning or an extra inning, an ordinary walkoff counts only the runs needed to take the lead. A `home_run` retains all eligible runs under the out-of-field home-run exception. Third-out suppression still applies. See OBR 7.01(e)(3) and 9.06(f) and (g).

For example, begin with two outs and runners R1 on first and R3 on third. On a fielder's choice, the batter reaches first and R3 crosses home before R1 is retired.

| R1's out | Recorded classification | Runs |
| --- | --- | --- |
| R1 is retired while forced toward second | `force` | 0 |
| R1 touches second, then is tagged after oversliding or continuing toward third | `non_force` | 1 |

Likewise, with two outs and R3 crossing before the batter's out on an error, `batter_before_first` suppresses the run. A batter who reaches first and is tagged trying for second uses `non_force`, and the earlier run counts.

### Validation and hashing

`parseUploadRequest` requires a valid `outType` on explicit outs and forbids the field on safe destinations. Missing, null, or unknown values produce `invalid`, including inside nested correction replacements. The parser preserves recorded classifications and never inserts uploaded defaults.

The engine rejects contradictory classifications with `invalid_out_type`. `batter_before_first` can name only the current batter. `force` can name only an existing runner whose starting occupancy and prior trailing outs permit a force. A prior trailing out removes force eligibility for runners ahead. An initially forced runner may use `non_force` to assert a tag after reaching the required base. A credited hit cannot accompany `force` or `batter_before_first` under OBR 9.05. The engine does not invent missing base-touch history.

Roster, active-runner, duplicate-runner, collision, and out-count checks remain. A rejection discards the whole play, including the in-play pitch, pitch counts, and threshold alerts. The handler maps these rejections to the existing `rejected` response with HTTP 422.

The hash includes `outType`. Identical retries return the stored acknowledgment. A changed classification with the same accepted group ID returns `id_conflict`. Storage preserves the field without a database migration, as Kevin confirmed. IDs, event numbering, timestamps, and the commit transaction remain unchanged.

Missed-base appeals, advantageous fourth outs, interference, and other special rulings remain unsupported. They cannot be represented by calling them `non_force`.

## Version pins

- Each `games` row stores `engine_version`, `schema_version`, the fully resolved `rules`, and `setup`. A trigger blocks changes to them after insert.
- The engine exports `EVENT_SCHEMA_VERSION = 2` and `ENGINE_VERSION = '0.1.0'`. Every YAML fixture's full result is committed in `packages/engine/src/fixture-results.json` beside the version exports.
- Local verification compares that artifact with the current engine and fixtures. CI also compares it with the trusted PR base or main-push predecessor and rejects changed results without an engine-version increase. [Engine verification](engine-verification.md) describes the commands and the initial release baseline.
- Each upload carries `schemaVersion`. The server returns `unsupported_version` when it differs from the server's `EVENT_SCHEMA_VERSION` or from the game's pinned `schema_version`. The parser checks it before any command, so an old-format request returns `unsupported_version`, not `invalid`.
- The server also returns `unsupported_version` for a game pinned to a different engine version. Milestone 6 still requires the phone to refuse scoring under mismatched pins.
- Joint decision #13 uses schema 2 without an old-request decoder. Existing stored games are first-connection test games. The existing reset workflow must clear those test games before the next full scoring and sync rehearsal. Targets and execution are tracked in [#21](https://github.com/sandlot-app/sandlot-app/issues/21). This local change performs no hosted reset or deployment.
- Do not rewrite historical events, hashes, or immutable pins. An old offline request retains its original content.

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
| `rejected` | 422 | Stop the queue and show that sync is stuck. The response carries the engine's reject code as `reason`. |
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
2. Christian switches the engine to `.ts` imports. `pnpm -s --filter @sandlot/engine sample-events --game <id> --session <id>` prints a half-inning as `UploadRequest[]`, using the IDs from `supabase/scripts/seed-test-game.sql`. The same arguments always print the same requests. `sample-events --pins` prints the version pins, rules, and setup that the seed script writes, so the engine accepts the half-inning.
3. Kevin adds the tables, `commit_group`, `get_base`, the row-level security policies, Realtime on `games`, and `sync-events`.
4. The first-connection `sync-events` skipped the engine step. Milestone 6 added it, so the handler now returns `rejected` for a sample play the engine finds illegal.
5. Kevin's `send-samples` script signs in, posts each sample request in order to `sync-events`, and prints each response. Christian runs it twice. The second run returns the same acknowledgments and adds no rows. Kevin's page shows each play once.
6. Before the full scoring and sync rehearsal, clear the first-connection test games through the existing reset workflow, coordinated in #21. No old-event migration is supported.

## Process

- This contract merged before Christian's doc branches. `docs/growth-decisions` carries `docs/family-features` and `docs/demo-plan`, rebased onto `main`. After it merges, Kevin rebases `docs/backend-design` onto `main` and resolves its conflicts.
- `plan.md` and `demo-plan.md` link to this file instead of repeating the contract.
- AGENTS.md says only Christian merges. Whether Kevin can also merge after review is still open.
