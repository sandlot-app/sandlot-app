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
- A play whose outs would take the half-inning past three is rejected with `too_many_outs`, such as a double play with two outs or a triple play with one.
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
- The engine exports `EVENT_SCHEMA_VERSION = 2` and `ENGINE_VERSION = '0.1.1'`. Every YAML fixture's full result is committed in `packages/engine/src/fixture-results.json` beside the version exports.
- Local verification compares that artifact with the current engine and fixtures. CI also compares it with the trusted PR base or main-push predecessor and rejects changed results without an engine-version increase. [Engine verification](engine-verification.md) describes the commands and the initial release baseline.
- Each upload carries `schemaVersion`. The server returns `unsupported_version` when it differs from the server's `EVENT_SCHEMA_VERSION` or from the game's pinned `schema_version`. The parser checks it before any command, so an old-format request returns `unsupported_version`, not `invalid`.
- The server also returns `unsupported_version` for a game pinned to a different engine version. Milestone 6 still requires the phone to refuse scoring under mismatched pins.
- Joint decision #13 uses schema 2 without an old-request decoder. Existing stored games are first-connection test games. The existing reset workflow must clear those test games before the next full scoring and sync rehearsal. Targets and execution are tracked in [#21](https://github.com/sandlot-app/sandlot-app/issues/21). This local change performs no hosted reset or deployment.
- Do not rewrite historical events, hashes, or immutable pins. An old offline request retains its original content.

## Undo

- Undo is an ordinary group with one `undo` command. It targets the latest group that is not already undone, whether that group is accepted or still on the phone.
- An undo group holds only the `undo` command. A group that mixes it with other commands is rejected with `undo_must_be_alone`.
- Undo works before the game starts too, so it can take back the start or a lineup. When no group is left to undo, it is rejected with `nothing_to_undo`.
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

### Reject reasons

A `rejected` response's `reason` is one of the engine's reject codes, `REJECT_CODES` in `packages/engine/src/engine.ts`. A test fails if a code is missing here.

| `reason` | The group is rejected because |
| --- | --- |
| `not_implemented` | it uses a command or runner event the engine doesn't support yet |
| `unknown_player` | it names a player who isn't on that team's roster |
| `game_not_started` | it's a play other than a lineup or the start, before the game starts |
| `game_already_started` | it sets a lineup or starts the game after the start |
| `no_pitcher` | the start has a lineup with no pitcher, or a pitch comes with no pitcher in |
| `ball_in_play_needs_pitch` | a ball in play doesn't follow an `in_play` pitch in the same group |
| `in_play_needs_outcome` | an `in_play` pitch isn't followed by its ball in play |
| `base_occupied` | a runner moves to a base another runner still holds |
| `runner_not_on_base` | a runner it moves isn't on base |
| `duplicate_runner` | a ball in play moves the same runner twice |
| `batter_destination_missing` | a double or triple play doesn't say where the batter went |
| `outs_dont_match_outcome` | a double play doesn't record two outs, or a triple play three |
| `too_many_outs` | its outs would take the half-inning past three |
| `invalid_out_type` | an out's `outType` doesn't fit the runner or the hit |
| `undo_not_latest` | an undo targets a group that isn't the latest active one |
| `undo_must_be_alone` | it mixes an undo with other commands |
| `cannot_undo_undo` | an undo targets another undo |
| `nothing_to_undo` | an undo comes when no group is left to undo |
| `game_over` | the game has already ended |
| `invalid_runner_destination` | a runner goes backward or stays, a caught stealing or pickoff isn't an out, or a stolen base is |
| `stealing_home_not_allowed` | a runner steals home where the rules allow scoring only on a passed ball |
| `balks_not_allowed` | it records a balk where the rules have none |
| `pitcher_reentry_not_allowed` | a removed pitcher comes back where the rules don't allow it |
| `bunting_not_allowed` | it records a bunt where the rules don't allow bunting |

When the queue stops, the phone shows how many plays are waiting, for example "3 plays waiting. Tap to fix." The fix is **Discard from here**. It deletes the stuck group and every group after it on the phone, and it runs only when the scorer taps it. The phone never deletes pending plays on its own.

## Voice

Two functions serve voice scoring. Both need a signed-in phone (an anonymous sign-in is enough for the demo), allow 30 requests a minute per user, and return `502 voice_unavailable` when OpenAI fails, which the phone treats as "Voice is unavailable right now. Tap to score." (A10). Neither writes to the database or logs a request body, a transcript or a name: bodies carry the lineup's display names and what was said (rule 5). The scorer-lock check (A8) and the monthly limit (A9) wait until the phone uploads games (#29).

The phone gives each request its own timeout, about 25 seconds, because a clip goes through two OpenAI calls, and on a timeout it falls back to taps. A `401` can also come from the Supabase gateway before the function runs, with the gateway's own body, so the phone branches on the status, not the `error` code.

**Cost.** The per-user rate limit and the 60-second secret are not a spending cap. The secret only limits when a session can start: once connected, OpenAI keeps a transcription session open for up to 60 minutes, so the phone closes the socket when the scorer lets go. A hard monthly budget on the OpenAI project is the real cap, and setting it is a required step before the first deploy, until the monthly limit (A9) arrives with #29.

**Privacy.** Audio, the transcript and the names the phone sends go to OpenAI. `voice-session` sends only last names as transcription keywords. `voice-parse` sends the lineup's display names to the parser model, with `store: false`. OpenAI still keeps API data for up to 30 days for abuse monitoring unless the project has zero data retention. Whether to ask for zero data retention, and the fewest names the parser needs, are Christian's and Kevin's decision before the beta.

**`voice-session`** starts one press's live transcription. The phone sends `{ names: string[] }`, the lineup's display names (at most 40). A list that isn't all text is `invalid`. The server drops any name it can't use, then asks OpenAI for a client secret that must be used within 60 seconds and opens only a `gpt-live-transcribe` transcription session, with the last names and scoring words as keywords. It returns `{ url, secret, expiresAt, sampleRate }`. The phone streams 16-bit mono PCM at `sampleRate` to `url` with that secret. The server's key never leaves the server.

**`voice-parse`** finishes a press the phone couldn't read alone. The phone sends `{ transcript, context }` or, when live streaming didn't connect (A4, A5), `{ audio, context }` with the press's 16-bit mono PCM at 24 kHz in base64, at most 15 seconds (A2). `context` is `{ batting, fielding, runners }`, lists of display names. The server transcribes a clip with `gpt-transcribe`, reads the words with the phone's own grammar, and asks a parser model (`gpt-6-luna`, with Structured Outputs) only for what the grammar can't read. It returns `{ transcript, parsed }`, where `parsed` is the same `ParseResult` `packages/voice` returns, or `null` for an empty transcript. The model only proposes: the phone routes `parsed` with `route()`, and the engine decides. A model answer that breaks the schema becomes `unclear`.

| Error | HTTP status | Phone action |
| --- | --- | --- |
| `unauthenticated` | 401 | Sign in again, then retry |
| `slow_down` | 429 | Tap to score for now |
| `too_long` | 413 | Tap to score |
| `invalid` | 400 | The phone has a bug. Tap to score |
| `voice_unavailable` | 502 | "Voice is unavailable right now. Tap to score." |
| `auth_unavailable` | 503 | Sign-in is busy or down. Keep the session and tap to score for now |

## Scoring handoff

`take_over(game_id, user_id)` locks the same game row, raises the epoch, and starts a new session. Only the service role can call it. No screen uses it before the beta. It exists so that the race and stale-epoch tests can run.

## Live page

- `get_snapshot(game_id, after_seq)` returns `{ gameId, revision, engineVersion, schemaVersion, rules, setup, state, events }`. `events` holds the events after `after_seq` in seq order, in the shape `get_base` builds, or `[]` when there are none. The page asks only for events it does not have yet. The function is security invoker, so row-level security decides access. It returns null when the caller cannot see the game or the game does not exist.
- The page subscribes to updates on its game's row. When the subscription is active, the page fetches a snapshot. It fetches again after every reconnect.
- The page fetches when a message or a snapshot has a higher revision than the one shown. It ignores any message or snapshot with a lower revision. It also fetches on load and every 30 seconds, even while the subscription is down, so the score still catches up.
- Messages and snapshots carry player IDs, never names.
- The page also reads its game's row in `recordings` (`playback_id`, `clock_offset_ms`) on load and every 30 seconds. Row-level security shows it wherever the game is visible, and only a public game can have one until playback is signed.

## Demo access

- `games.visibility` is `private` or `public`. Anyone can read a public game and its events. Only the demo game is public. Access comes from that column, not from a secret link.
- The scorer signs in anonymously on the phone. A seed script makes that user the demo game's scorer.
- A policy lets a scorer read their own game and session.
- Scorer and owner columns live in `scoring_sessions`, not `games`, because every live page viewer receives the whole `games` row.
- Anonymous sign-in has CAPTCHA or rate limits turned on. A test checks that an anonymous user cannot read a private game.
- A reinstall of Expo Go creates a new anonymous user. Before each rehearsal, rerun the seed script and reset the demo game.

## Public games and team names (proposed)

Proposed in [ADR 0005](adr/0005-kids-video-never-goes-on-the-public-link.md) and [ADR 0006](adr/0006-team-names-and-jersey-numbers-live-in-the-server-roster.md). It changes nothing above until Christian and Kevin both sign off. It is built after the demo. Table and column names are Kevin's.

- Every game starts private. Only the scoring team's admin can make it public. Either team's admin can make it private again at any time, and the next snapshot or Realtime message the page asks for stops coming.
- A game has a setting that says its footage needs no consent. Only the service role can set it, and only the demo game has it.
- A recording is allowed only on a game with that setting until playback is signed. After that, any game can have one, but the public link plays video only for a game with that setting. `get_snapshot` and the `recordings` row give a public viewer no playback ID for any other game.
- Each game keeps a copy of its two team names and every rostered player's jersey number from when it was set up. A later roster change doesn't change an old game. A player may have no number, and two players on one team may share one.
- The team admin keeps the team's roster of names and numbers. For an opponent not on Sandlot, the scorer enters the team name and jersey numbers at setup, and never names.
- A public viewer reads team names and jersey numbers through a view with no name column. Names never go in any row a public viewer can read, including `games`, whose whole row every live page viewer receives.
- Events, snapshots and Realtime messages still carry player IDs only. The engine never sees names or numbers.
- Once games carry their names and numbers, the live page drops its copy of the demo roster.

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
