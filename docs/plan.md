# Youth baseball and softball scoring app: engineering plan

Last updated October 22, 2026. Christian Alcala.

Backend design revision: Kevin's ten approved decisions are the reference for this update. This is a design update only; it does not implement the backend or approve changes to Christian's engine/mobile contracts.

Sandlot is a GameChanger competitor for baseball and softball that wins on scoring. A parent scores by voice or one tap, fixes any mistake in one step, and keeps scoring with no signal, while family follow the score and the video live. This plan orders the work by dependency, not by date. Christian and Kevin build two tracks side by side, which meet at the YC demo and then grow into the beta and the public launch.

## Team and ownership

Two people build Sandlot, each directing their own coding agents. Each person owns separate directories, so their agents rarely touch the same files.

| Person | Owns | Directories |
| --- | --- | --- |
| Christian, with Claude Code and Codex | Rules engine, tap scoring app, voice | `packages/engine`, `packages/voice`, `apps/mobile` |
| Kevin, with Claude Code and Codex | Supabase backend, event sync, the family live page, live streaming | `supabase/`, `apps/web` |

- **Shared contract.** The engine's `Event` type, game setup, persistence shape, upload request and acknowledgment, and viewer snapshot. Kevin has approved the backend decisions below. Changes to shared contracts still require Christian's sign-off before implementation; the current types do not imply that agreement.
- **Root files.** Only one person at a time changes root config or `pnpm-lock.yaml`.
- **Agents.** Both people use Claude Code and Codex for now. In each person's track, Claude Code orchestrates and writes most of the code, and Codex takes tasks Claude Code hands it. Every agent reads `AGENTS.md`, works in its own git worktree, and opens PRs. Only people merge.

## Goal

A team switches only when scoring gets clearly easier for the scorekeeper and the families following along lose nothing. So the first version matches GameChanger on what families see and beats it on what the scorekeeper does.

The table describes the broader product through beta, not the November 2, 2026 YC MVP. That demo prioritizes one scorer, durable offline recording, reliable sync, latest-group undo, and the family live page. Handoff/review screens and arbitrary historical corrections wait until beta. Video is optional; basic authentication and access control are required for the demo.

| Capability | First version | Later |
| --- | --- | --- |
| Pitch-by-pitch scoring, baseball and softball | Taps for pitches, voice or taps for plays | |
| Fixing mistakes | Undo, spoken fixes, and a play log that previews what a fix changes | Parents flag a play they think is wrong |
| Scoring with no signal | A whole game offline, synced afterward | |
| Live score and play-by-play for family | A private web link, with no app to install | Public game pages |
| Live video | A second phone streams through a hosted service, shown on the family live page | Our own in-app broadcaster, replays and highlights |
| Box scores and season stats | Yes | Spray charts, more stats |
| Pitch-count report for the league | Yes | |
| Roster, lineups, handing scoring to another parent | Yes | |
| Team schedule | Yes | |
| Team messaging | Not planned | |
| Paid tier | Not in the first version | After parents show they like the app |

GameChanger has no public API, so nothing can be written into it ([Dugout](https://www.getdugout.com/gamechanger-api), [gcstats](https://gcstats.app/gamechanger-api/)). A team's official stats live in whichever app it scores in. GameChanger is Little League's official partner, so the first customers are teams not tied to it, like travel teams, PONY leagues and rec leagues. The Moraga beta runs alongside GameChanger and stays unofficial.

## Architecture at a glance

![The phone scores, the server rechecks, and family watch it live. The scorer's phone runs the rules engine and keeps the event log, voice services propose plays, Supabase rechecks and pushes live updates, and a filming phone streams video through a hosted service to the family live page.](images/architecture.png)

The diagram is a high-level illustration, not completed implementation or the full commit/recovery protocol. Its lock check must also occur in the database commit transaction, uploads contain complete groups, and family recovery requires snapshot reads in addition to Realtime. The scorer's phone records pending groups locally. Trusted TypeScript backend code runs the shared engine, and the server alone commits accepted history. Family viewers read revisioned server snapshots. Video goes from a filming phone through the streaming service, never through Supabase.

### Existing architecture and implementation status

The repository currently has a pure TypeScript engine package, branded domain types and rule presets, and an Expo shell importing the engine. `packages/engine/src/engine.ts` exports `initialState` and `apply`; `apply` returns `not_implemented`. The functions listed under Rules engine below are planned capabilities, not all existing exports. `apps/mobile/App.tsx` constructs a `GameSetup` and displays initial state; it has no SQLite recording, upload queue, sync interface, or scoring UI yet. There is no `supabase/` backend or `apps/web` implementation in this checkout.

### Shared contract changes needing Christian's sign-off

These discrepancies are documented rather than resolved by changing code. Kevin's approved backend behavior is specified under Server; the exact cross-track interfaces remain open.

| Current repository interface | Required integration decision |
| --- | --- |
| `Event` has `id`, `gameId`, `seq` starting at 1, `group`, `lockEpoch`, `source`, `at`, and `command`. It has no authenticated user/session identity or expected revision. | Agree where session identity and the expected revision live in the upload contract. `lockEpoch` alone does not authenticate a scorer. Do not silently add fields to the engine event. |
| `seq` is an event order; there is no revision type or offline dependency contract. | Agree the exact relationship between accepted revisions, event `seq`, and dependent offline groups, including retry after a lost acknowledgment. No revision formula, sequence allocation, or dependency encoding is settled here. |
| `GameSetup` contains a resolved `RuleSet` and `pitcherOutsEarlierToday`. `Event.at` and the `start` command's `umpireStart` supply time as data. | Agree the per-game manifest that pins engine version, event schema version, resolved rules, and all deterministic setup inputs, and how incompatible clients are handled. |
| `apply(setup, state, command)` returns state or a `RejectCode`; only `not_implemented` and `bunting_not_allowed` are currently typed. There is no `applyGroup` or `replay` export yet. | Agree the complete-group validation/replay interface and any timestamp context it needs. Define transport conflicts separately from rule rejections; neither is implemented. |
| `Command` includes both `undo` and `correct` targeting a `GroupId`. | Agree how the demo limits undo to the latest eligible group across accepted and pending work. Arbitrary historical corrections remain a beta capability; the type is not evidence that they work today. |
| Mobile has no upload function, queue types, acknowledgment, or viewer API; no events schema exists. | Agree immutable request content, group completeness, ID scope, acknowledgment shape, pending-group lifecycle, revisioned viewer snapshots, and authenticated access before those interfaces or schemas are implemented. |

## Data model

A game is an append-only list of events, and the current game is that list replayed through the engine. Every other part of the app, from the diamond on screen to the box score, reads that one shape. The full types live in `packages/engine/src/types.ts`. This excerpt reflects the existing event/setup types, not a new backend wire contract:

```ts
type Event = {
  id: EventId;        // identity alone does not establish safe retry semantics
  gameId: GameId;
  seq: number;        // order within the game, starting at 1
  group: GroupId;     // one voice press or one tap action
  lockEpoch: number;  // existing epoch field; not authenticated session identity
  source: 'tap' | 'voice';
  at: Timestamp;
  command: Command;
};

type GameSetup = {
  rules: RuleSet;
  pitcherOutsEarlierToday: Partial<Record<PlayerId, number>>;
};
```

- Events are never edited or deleted. Undo and fixes are new events that target a group, so one undo reverses everything one press recorded.
- Game state is always computed from the events. The stored copy on the server is a cache that can be rebuilt.
- Accepted history belongs to the server. The phone's pending groups are durable local work, not accepted server history, and remain until acknowledged or explicitly resolved. Refreshing the accepted state must not erase them.
- Events and stats refer to players by ID. Names live in one table, which keeps privacy rules in one place.
- Branded IDs provide compile-time protection against mixing ID types in checked TypeScript code. Brands do not survive JSON serialization or validate incoming data. Every untrusted JSON boundary requires runtime validation of IDs, payload structure, and values before domain types are used; referenced entities must also be checked for the correct game/context and authorized access. A type assertion is not runtime validation. Exact wire formats and validation contracts still need shared sign-off.
- Sport is part of the rule set from day one. Adding softball later, after these types are fixed, would mean rewriting the engine.

## Rules engine

The engine is the critical path. Voice, stats, corrections and the family view all depend on it being right. It is pure TypeScript with no network, clock or randomness, so the same events always give the same game, on the phone and on the server.

| Function | What it does |
| --- | --- |
| `apply`, `applyGroup` | Accept or reject one command, or a whole press, all or nothing |
| `replay` | Build the game from its events |
| `candidates` | List every legal reading of an unclear play, such as "runner scores" with two runners on |
| `classify` | Decide whether a play saves instantly, needs a confirm, or needs a hit-or-error call |
| `explain` | Say a play in plain words for the read-back banner |
| `previewCorrection` | Show what a fix changes: score, stats, and later plays it changes or breaks |
| `missedPlayCandidates` | Suggest the missed play that would make a rejected play legal |
| `stats` | Box score and pitching lines from the replayed game |

**Baseball and softball.** Each league's rules are a rule set, which is data. A preset like Little League Minors is a published rule set, and a local league's rules are a preset plus overrides. The September plan's settings already cover innings, fielders, batting order, walks, stealing, leadoffs, dropped third strikes, run limits, mercy rules and pitch counts. Softball adds settings, such as slowpitch rules that start the count at one ball and one strike or call the batter out on a foul with two strikes. Check each against the league's rule book before writing the fixture.

**Presets ship only when a real team can prove them.** The beta team plays in Moraga's Mustang division, which follows PONY rules with local changes. So Mustang with Moraga's rules comes first, then Pinto. Softball presets ship when a softball team joins the beta.

**Testing.**

- Fixtures written first. Each is a YAML file with a starting state, commands, the expected result, and a citation to the rule book.
- Property tests. Outs stay between 0 and 2, no base holds two runners, replaying equals applying one by one, and undo restores the prior state.
- Real games. Paper scorebooks and beta games are entered as event lists, and the engine's box score must match exactly.

### Moraga rules

The first presets are Moraga's Mustang and Pinto divisions, which use PONY rules with local changes ([Moraga PONY rules](https://www.moragabaseball.org/pony-rules/), Mustang revised February 2024, Pinto revised April 2025). Settings marked new are ones the September plan didn't have.

| Rule | Mustang, ages 9 and 10 | Pinto, ages 7 and 8 | Engine setting |
| --- | --- | --- | --- |
| Pitcher | Kids pitch | Coaches pitch to their own team | Pitch source |
| Fielders | 9 | 10, with a roving outfielder | Fielders |
| Time limit | 6 innings, but no new inning after 2 hours from the umpire's start time. If tied, one extra inning, then a tie. | Same, except a tie after 6 innings can go up to 3 more innings inside the 2 hours | Time limit. New: tie rules. |
| Called game | Complete after 4 innings, or 3 and a fraction if the home team leads | Not stated | New: length of a complete game |
| Run limit | None | 5 runs in each of innings 1 to 5 | Run limit with a late-inning exception |
| Pitches per batter | No limit | 6. The batter is out after the 6th unless it's fouled off. | Max pitches per batter |
| Strikeouts | Called or swinging. The catcher doesn't need to catch the third strike. | Swinging only | Dropped third strike off. New: called strikes off. |
| Walks and hit batters | Walks allowed. Hit batters follow the PONY rule book. | None | Walks and hit-by-pitch |
| Stealing | First half: only after the ball crosses the plate, no leadoffs. Second half: leadoffs and steals if most coaches agreed. | None. A runner leaving early gets one team warning, then is out. | Stealing and leadoffs, pinned per game. New: out for leaving early. |
| Bunting | Not allowed | Not allowed | New: the engine rejects bunts |
| Infield fly and balks | Neither | No infield fly | Off |
| Batting order | Everyone present bats. A late arrival joins at the end. | Everyone present bats. Batting out of order costs one out, and plays from the wrong batter on are wiped out. | Continuous order. New: a late-arrival command and an out-of-order penalty. |
| Pitching limits | Pitch Smart counts for ages 9 and 10. At most 6 outs a day in the first half and 9 in the second, across every game that day. A removed pitcher can't pitch again that game. | None | Pitch-count table. New: an outs-per-day limit and no pitcher re-entry. |
| Playing time | Every player plays 4 defensive innings | Players sit out in rotation when one team has more players | New: playing-time alerts |
| Thrown bat | Out on the second time | Out on the second time, scored like a strikeout with no runners advancing | New: batter out by rule |
| Official scorer and reporting | The home team's scorekeeper is the official scorer. Teams report scores and pitch counts to the commissioner. | Not stated | A pitch-count report from the app |

- The engine never reads a clock. It times the 2-hour limit from the umpire's start time, which the scorer enters, and from the timestamps on events.
- The outs-per-day limit spans games. The app adds up a pitcher's outs from earlier games that day and passes them into the new game's setup.
- The rules change halfway through the Mustang season. Each game pins its own rule set, so first-half games keep replaying under first-half rules.
- Pinto's dead-ball rule at the pitcher's circle needs no engine logic. The scorer records where the runners end up.
- Pinto's out-of-order penalty wipes out later plays. That is a correction like any other: one event that removes the wrong batter's plays and adds the out.

## Phone app and offline scoring

The phone owns durable pending offline work; the server owns accepted history. Local scoring never waits on upload progress. The planned Expo/TypeScript app keeps the accepted history and pending groups in SQLite; this persistence is not implemented in the current shell.

- **Saving a play.** The engine validates the entire tap/voice action. One SQLite transaction writes its complete event group and queues that group for upload, then the screen updates. A partial action is never saved. Nothing waits on the network.
- **One scorer at a time.** Authority belongs to an authenticated user and scoring session with an epoch. Establishing authority needs signal. A previously authorized phone can keep recording offline, but cannot know whether ownership changed remotely. The server checks current authority when committing; stale-session plays never merge automatically.
- **Handing off.** Handoff and review screens wait until beta. A planned clean handoff requires signal and no pending uploads. Ownership changes, including administrative takeover, must use the same game-row lock as event commits. An old phone retains rejected work for explicit resolution even while the demo has no review screen.
- **Sync.** Upload one complete group per request, with one logical upload in flight per scoring session. Try on reconnect, app open, periodically during a live game, and before finalization. Retry the same immutable request when its outcome is uncertain; overlapping network attempts must be safe on the server. Persist acknowledgments and pending status durably so a restart or lost response cannot lose or duplicate a play.
- **Ordering and rejection.** A new append names the accepted revision it expects to extend. A conflict or rule rejection preserves the group and blocks automatic progress past it; never silently rebase, renumber, or skip it. The relationship between revisions, event `seq`, and dependent offline groups still needs Christian's agreement. New local scoring remains independent of a stalled upload.
- **Reconciliation.** Refresh accepted history separately from pending work. Only acknowledgment or explicit resolution clears a pending group. If pending work cannot validly replay on the accepted base, preserve it and surface an unresolved sync state rather than presenting it as accepted or dropping it. The minimal demo status/recovery flow needs agreement; full review screens wait until beta.
- **The screen.** The diamond, count, score and play log all come from the replayed game. Pitches are one tap on a bar that is always visible. A play is one tap on the outcome, or one voice press.
- **Corrections.** The demo supports latest-group undo as an appended event group, validated locally and then by the server. Its exact behavior across accepted/pending groups needs sign-off. Arbitrary historical corrections and their previews wait until beta; the September voice spec remains the reference for those later flows.

The September plan wanted SQLite encryption on the phone because it holds kids' names. Confirm Expo supports it before relying on it.

## Voice scoring

Voice is the main reason a team would switch, and also the biggest unknown, so a throwaway prototype tests it before the app depends on it. The rule from September stays: the AI proposes a play, and only the engine decides whether it is legal.

1. The scorer holds the mic button. The phone records immediately, before any connection opens, so no words are lost.
2. Speech goes to a transcription service. September's plan chose OpenAI's gpt-live-transcribe, and the prototype confirms that choice or replaces it.
3. A small parser on the phone handles common phrases like "ball", "steals second" or "fly out to center" with no AI. Anything else goes to an AI parser, which returns candidate commands.
4. The engine checks the commands and classifies the play. A simple legal play saves instantly, with a spoken-word banner and undo. An unclear, complex or misheard play shows a confirm card or buttons.
5. Any failure falls back to tap scoring in one step.

Taps record pitches and voice records plays. That split keeps voice cheap, at about 4 cents a game by September's estimate, and puts voice where it saves the most taps.

**What the prototype must prove.** Record 100 or more spoken plays over game video with crowd noise playing. Voice goes ahead only if all of these hold:

- [ ] At least 95% of plays parse exactly right
- [ ] No wrong play would have saved without a confirm
- [ ] 90% of simple plays show a result within 1.5 seconds of release
- [ ] 90% of complex plays show a result within 2.5 seconds
- [ ] Measured cost per game is under 25 cents

The prototype is thrown away. Its recorded test set and the on-phone phrase parser carry into the real app. September's voice edge-case spec remains the product reference, with parent flags deferred and arbitrary historical corrections and their review screens deferred until beta. Voice actions use the same complete-group persistence and upload contract as taps.

The first version records the whole press, then uploads the clip for transcription. It is simpler to build and test, and it runs in Expo Go. Streaming transcription, which shows words while the scorer speaks, comes before the beta.

## Server

### Backend decisions approved by Kevin

These are requirements for the backend to be built, not completed features or approval of new engine/mobile interfaces. Trusted TypeScript backend code runs the shared rules engine. Supabase PostgreSQL owns accepted history and a rebuildable state cache; Realtime helps deliver updates. SQL does not execute the TypeScript engine. Video runs through a hosted service for now, and payments wait.

| Part | November 2 YC MVP and later scope |
| --- | --- |
| Accounts and teams | Basic authentication and authorized scorer/viewer access before the demo. Full profiles, teams, seasons, and role onboarding wait until beta. Accounts are adults only. |
| Players | Names live only in the players table; roster entries hold jersey numbers. Opponents are jersey numbers only. Parent claims wait until beta. |
| Games | Pinned compatibility/setup inputs, accepted events, cached state with a revision, scorer user/session and epoch, and durable acknowledgments. Scheduling, full stats, and review flows follow the broader product milestones. |
| `sync-events` | One complete group per request. Trusted TypeScript validates with the pinned engine; one restricted PostgreSQL function atomically checks authority and the expected revision and commits the whole group, cache, and acknowledgment. No partial acceptance. |
| `voice-session`, `voice-parse` | Authenticate and authorize access, check scoring authority and the team's monthly voice limit, and return transcription/candidate commands. The parser never commits a play. |
| Invites and claims | Beta: parents and fans join by invite; a parent claims their child's roster entry. Demo access must still be authorized. |
| Live view | Revisioned snapshots, authorized subscription established before snapshot fetch, refetch on reconnect, and periodic snapshot reconciliation while connected. Messages carry IDs and state, never names. |
| Privacy | Before demo: restricted writes, authorized reads/subscriptions, row-level security for exposed tables, and access-control tests. Beta adds full visibility rules and in-app child/account deletion; voice transcripts have the planned 30-day retention limit. |
| Family live page | Kevin's web page in `apps/web` shows accepted score and play-by-play through authorized snapshot reads and Realtime. A private link alone does not establish authorization. Video appears when a stream is running. |
| Live streaming | Optional for demo: Amazon IVS or Mux takes a second phone's stream; the live page plays it with the accepted score. Kevin owns it. |

### Commit boundary and ownership

1. The trusted TypeScript handler validates incoming JSON at runtime, authenticates the caller, and verifies the requested scoring session belongs to that user. Before engine validation, it obtains a consistent database read of the game's accepted revision, state/history, and pinned compatibility/setup inputs. These must describe one database snapshot: the cache or replayed history must correspond to that revision, with no mixture of reads from different committed versions. The read mechanism remains an implementation decision, but independent reads without a consistency guarantee are insufficient. Client-supplied cached state, stats, or claims of successful validation are never trusted.
2. For a new append, the handler validates the complete group with the shared engine against that consistent accepted base and the game's pins. Any rejection rejects the entire action. It passes the validated events, derived state, and declared validation base to the restricted commit function through a backend-only path. The restricted TypeScript code is trusted to run the pinned engine correctly on the inputs it read and to declare that base accurately.
3. One PostgreSQL function locks the game row and checks authorization, scoring session, epoch, and the expected revision inside the transaction. It compares the declared validation base (including the base revision and pinned compatibility/setup inputs or their agreed identity) against current database values, and requires that base revision to match the request's expected revision. PostgreSQL checks this declaration for freshness; it does not rerun the TypeScript engine or prove that the submitted derived state was computed correctly. That correctness belongs to the restricted TypeScript code. If the base no longer matches, the result cannot commit. All ownership changes lock the same game row, so takeover and append cannot both succeed under inconsistent ownership.
4. The same transaction records all events in the group, the updated cached state and revision, and the durable acknowledgment, or records none of them. Publication follows successful commit. A separate initial authorization check in TypeScript is not a substitute for transaction-time checks.

Direct client writes to accepted events, cached state, ownership, or acknowledgments are prohibited. Clients cannot invoke the restricted commit function or another path that bypasses engine validation. The trusted backend may submit derived state only after engine validation; its database execution privilege and the verified caller/session context must be restricted accordingly. The exact privilege/auth-context mechanism remains to be designed and tested.

### Idempotency and ordering

An authorized exact retry of a committed group returns the original durable acknowledgment without appending again. A lost response must not turn a successful commit into a new play. The retry path authenticates/authorizes access and compares the stored immutable request content before returning that acknowledgment; it does not treat the retry as a new append against today's revision. It must work even if later groups have advanced accepted history. New appends always undergo current session/epoch/revision checks.

Reusing a group or event ID with different immutable content returns a conflict, not success. The immutable-content definition, ID scope, and equality/canonicalization rules need shared agreement; IDs alone are insufficient. Server-side serialization and uniqueness enforcement must handle overlapping retries safely: identical concurrent requests produce one commit and the same acknowledgment, while differing content with a reused ID cannot overwrite or partially commit. The client limit of one logical upload in flight does not remove this server requirement.

Every new append identifies the accepted revision it expects to extend; the transaction checks that revision before any commit. Rejected groups are never silently rebased, renumbered, or skipped. In particular, the exact relationship between revisions, event `seq`, and dependencies among groups recorded offline is **unresolved pending Christian's sign-off**. This plan does not prescribe that a revision equals an event sequence or a group count. Retry authorization after ownership changes and explicit resolution of dependent rejected work also need agreement; neither may admit new stale-scorer plays.

### Compatibility and recovery

Each game pins its engine version, event schema version, fully resolved ruleset rather than just a mutable preset name, and all deterministic setup inputs. That includes `pitcherOutsEarlierToday`; event timestamps and the umpire start remain replay inputs. Phone and backend must use compatible pinned semantics so that replay does not change after a deployment or preset edit. Version identifiers, manifest placement, supported-version policy, and upgrade behavior remain shared contract decisions, not implemented fields.

The server's accepted snapshot can replace the phone's accepted base, but cannot replace or silently delete its pending queue. Pending offline groups survive failures, rejection, reconciliation, and restart until acknowledged or explicitly resolved. Stale-scorer work stays unresolved locally; it is never automatically merged into accepted history.

Family viewers establish the authorized subscription and wait for confirmation that it is active before fetching the initial revisioned snapshot. They repeat that subscribe-then-fetch sequence on reconnect. Notifications arriving during the fetch are buffered and reconciled by revision after the snapshot arrives; if a notification indicates newer state not covered by the snapshot, fetch again. All snapshot responses and updates use the same revision comparison: ignore older revisions and tolerate duplicates, so a delayed fetch cannot overwrite a newer displayed state. Score and play-by-play must describe the same accepted revision.

While connected, viewers also periodically fetch and reconcile the latest authorized snapshot even if no notification arrives. Realtime notifications are an update signal, not the sole recovery mechanism; periodic reconciliation repairs missed updates without requiring a disconnect. Exact snapshot/notification payloads, revision comparison representation, and the reconciliation interval/backoff policy need shared agreement. Public pages and their name-visibility matrix wait until those pages ship; access control for demo data does not.

## Milestones

Milestones follow dependencies, with November 2, 2026 as the YC demo target. Each one ends in a check that has to pass before anything built on it starts. Christian's and Kevin's tracks run side by side and meet at the demo. Except for the existing foundations, these are acceptance criteria to achieve, not claims of completion. The existing diagram shows track ownership; its demo streaming and post-demo sign-in labels are superseded by the table below: video is optional and basic authentication/access control belongs in milestone 6.

![Two tracks meet at the YC demo, then the app grows toward launch. Milestones 3 to 5 are Christian's track, 6 and 7 are Kevin's, and 9 to 13 follow the demo in order.](images/milestones.png)

| # | Milestone | Owner | Includes | Done when |
| --- | --- | --- | --- | --- |
| 1 | Foundations | Christian | Repo, CI, engine package, Expo app | Done. CI passes, and the app runs on an iPhone and the Android emulator. |
| 2 | Shared contract | Both | Complete-group upload and acknowledgment, authenticated session/epoch, expected revision, offline dependencies, compatibility pins, latest-group undo, viewer snapshots | Christian and Kevin sign off on the discrepancies/open contracts above, including revision versus `seq` and offline dependencies. Agreed examples cover lost acknowledgments, ID reuse, rejection, stale ownership, and pending-work recovery. Backend approval alone does not finish this gate. |
| 3 | Engine core | Christian | Mustang rules for pitches, walks, strikeouts, balls in play with runner advances, steals, inning changes, score, undo and box score. The interface freezes early so voice and sync can build on it. | Fixtures pass, and one real game replays to the right box score |
| 4 | Tap scoring app | Christian | Lineup setup, diamond, pitch bar, play outcomes, play log, latest-group undo, atomic SQLite recording and durable pending queue | A full game scored by tap from video in airplane mode survives app restart. Complete actions save all or nothing; local scoring and latest-group undo remain usable while uploads are stalled. |
| 5 | Voice | Christian | Hold to talk, recorded clip sent for transcription, AI parser, engine check, confirm card | Meets the five targets in Voice scoring |
| 6 | Event sync and family live page | Kevin | Trusted TypeScript engine validation, restricted transactional commit, basic auth/access controls, reliable group sync, revisioned family snapshots | The sync/access-control checks below pass. An authorized second device sees accepted plays within a few seconds online and refetches the latest state after reconnect. Offline scoring, restart, and later upload lose no pending groups. |
| 7 | Live streaming | Kevin | A second phone streams through an existing app to a hosted service. The live page plays it with the score drawn on top. The demo uses footage that needs no consent. | Video plays on the live page with a correct score overlay |
| 8 | YC demo, November 2 | Both | One scorer records a game durably offline, syncs reliably, uses latest-group undo, and shares the authorized family live page; demo video and application. Live video optional. | Milestones 2, 3, 4, and 6 pass; voice meets milestone 5 or uses the documented tap-first fallback. Demonstrate disconnect/restart/reconnect without data loss, correct family recovery, and access controls; submit the application. Handoff/review screens and arbitrary historical corrections are not demo gates. |
| 9 | Full accounts, teams and privacy | Both | Full Apple/Google onboarding, invite links, parent claims, expanded visibility rules, deletion, built on demo authentication and access controls | Database tests pass for every visibility rule, and a parent claims and deletes a test child. Demo security remains enforced. |
| 10 | Beta with the Moraga Mustang team | Both | Apple developer account, TestFlight, streaming transcription, handoff/review screens, arbitrary historical corrections with previews, weekly releases | Six games in a row match GameChanger's box scores with zero data loss. Handoff/takeover preserves stale pending work for explicit review, and historical fixes preview and validate their effects before commit. |
| 11 | In-app broadcaster, replays and moderation | Kevin | Development build with a streaming module, media consent, replays, highlights, report and stop-stream tools | A full game streamed from the app, with replay and highlights |
| 12 | Payments | Kevin | Paid tier through the app stores | Sandbox purchases work on both stores |
| 13 | Public launch | Both | Pinto, softball and Little League presets, store listings, load test | Store review approves |

Milestone 7 is optional for the demo. If streaming isn't ready, the demo shows the live score page without video and nothing else changes.

**Milestone 6 acceptance checks (required before the demo).**

- A multi-event tap/voice group commits completely or leaves events, cache, revision, and acknowledgment unchanged. Invalid commands cannot bypass trusted engine validation, including through direct database calls or client-supplied derived state.
- A committed request whose response is lost returns its original acknowledgment on an authorized exact retry, including after later appends. Concurrent identical retries commit once; a reused group/event ID with different immutable content conflicts without changing accepted data.
- Concurrent writes during validation-input reads cannot produce a mixture of revision, state/history, and pinned setup from different database snapshots. The trusted TypeScript path validates against that consistent base and declares it accurately; PostgreSQL rejects a stale expected revision or declared base at commit. Tests verify the TypeScript engine invocation as well as the database freshness checks. Racing ownership changes and event commits use the same game-row lock and accept only the authorized session/epoch. New stale-scorer plays are rejected and retained on the phone.
- A full offline game survives restart and syncs after reconnect under the agreed ordering contract. One logical upload per session does not block local scoring. Rejected groups and their dependent work remain durable; reconciliation does not silently delete, rebase, renumber, skip, or merge them.
- Game replay uses the pinned engine/schema/rules/setup inputs; an unsupported compatibility combination cannot be silently interpreted using a different engine or current preset.
- Family viewers subscribe before fetching initially and on reconnect, reconcile notifications received during a fetch, and never regress when snapshot responses arrive out of order. With a notification deliberately omitted while the connection stays open, periodic snapshot reconciliation recovers the latest consistent score/play-by-play.
- Incoming JSON with malformed IDs or invalid payload structure/values is rejected at runtime; IDs referencing the wrong game/context or unauthorized entities are rejected even if a caller casts the payload to branded TypeScript types.
- Access-control tests cover unauthenticated access, unauthorized game reads/subscriptions, forged user/session context, stale epochs, and attempts to write events, cached state, ownership, or acknowledgments directly or invoke restricted commit privileges. Authorized scorer and family paths also pass. A private URL alone cannot grant unintended access.

## Changes from the September plan

The pure engine and append-only history remain the foundations. Kevin's approved backend revision clarifies authority, transactional validation, and durable reconciliation. The order of work tests the scoring experience early while requiring basic security and reliable sync before the demo.

| Area | September plan | This plan | Why |
| --- | --- | --- | --- |
| Engine, event log, scorer lock, AI proposes and engine decides | As designed | Pure engine and append-only history kept; server accepts history, phone preserves pending groups, authority binds user/session/epoch | Makes offline recording compatible with transaction-safe acceptance |
| Voice edge-case spec | Full spec | Product reference kept; parent flags deferred, historical corrections/review screens wait until beta | Keeps the demo focused on recording and latest-group undo |
| Order of work | Backend, privacy and presets before any game is scored, voice after | Engine, tap app and voice tested early; basic auth, restricted writes, authorized reads/subscriptions, and access-control tests before demo. Full onboarding, invites, and claims at beta. | Proves scoring without deferring essential access control |
| Sync and reconciliation | Scorer lock and server recheck | Complete-group commits, authorized exact retries, atomic revision checks, and durable unresolved pending work | Prevents partial actions, stale validation, duplicates, and silent offline data loss |
| Voice transcription | Streaming from the first version | A recorded clip first, streaming before the beta | Simpler to build and test, and it runs in Expo Go |
| Who builds | Codex writes all the code | Christian and Kevin, each with Claude Code and Codex | Two people with separate directories |
| Sports | Baseball presets | Baseball and softball in the rule data from day one. Softball presets ship with a softball beta team. | Adding a sport after the types are fixed means a rewrite |
| Beta presets | Little League Minors and Majors | Moraga Mustang, then Pinto, both PONY | The beta team plays Mustang |
| Live video | Our own broadcaster module before launch | A second phone through a hosted service first. Our own broadcaster after the beta. | No native module or developer account needed for the demo |
| Family view | In the app, for team members | A private web link, with no app to install | Family follow along without installing anything |
| Payments | Before the public launch | After parents show they like the app | Prove the product first |
| Schedule | Fixed dates for every milestone | Dependency gates with a November 2 YC target; one scorer, durable offline work, sync, latest-group undo, and family live page first | Keeps demo scope explicit while later milestones follow dependencies |

## Risks and open questions

The biggest risk is voice failing the prototype, because voice is the main reason to switch. Each risk below has a planned response.

| Risk | What happens | Response |
| --- | --- | --- |
| Voice misses its targets | The main reason to switch gets weaker | Ship tap-first, with outcomes in one tap. Keep voice as a beta experiment and retest with the next transcription model. |
| Leagues require GameChanger | Slower adoption | Start with travel teams, PONY leagues and rec leagues. |
| A local rule the engine doesn't know | Wrong box scores | Add a rule setting and a fixture. The beta comparison against GameChanger catches these. |
| Two people's agents editing the same files | Conflicts and broken builds | Separate directories, one owner for root files at a time, and the shared contract agreed before the tracks split |
| Many agent PRs waiting for review | Slow merges | CI must pass, fixtures come first, PRs stay small, and each person reviews the other's work |
| Streaming children without consent | Legal and trust problems | The demo streams footage that needs no consent. Media consent and moderation ship with the in-app broadcaster. |
| Saturday-morning traffic peaks | Voice, live updates or streams fail at the busiest time | Load test before launch. OpenAI, Supabase and streaming limits per plan are unverified. |
| Lost responses, stale scorers, or revision conflicts | Duplicate plays or discarded offline work | Atomic groups and durable acknowledgments, transaction-time ownership/revision checks, preserved pending work, and race/recovery tests before demo |
| Shared contract remains unresolved | Engine, phone, and server disagree on ordering or replay | Christian and Kevin settle revision/sequence/dependency and compatibility contracts at milestone 2; no silent interface changes |
| Children's privacy law | Required changes late in the project | Adults-only accounts, names in one table, and an attorney review before the public launch |

**Decisions.**

- **Beta division.** Mustang in Moraga, which uses PONY rules with local changes.
- **Team.** Christian owns the engine, tap scoring app and voice. Kevin owns Supabase, event sync, the family live page and streaming.
- **Who writes the code.** Christian and Kevin both use Claude Code and Codex for now. Claude Code orchestrates each track and writes most of the code. Codex takes implementation tasks Claude Code hands it. Every agent follows `AGENTS.md`.
- **Schedule and messaging.** The app has a team schedule. It has no messaging.
- **GameChanger.** No partnership approach is planned.
- **Email.** None in the first version. The beta onboarding plan uses Apple or Google sign-in and invites shared by link. The minimal authenticated demo access flow is still to be agreed; it cannot defer access control. Add an email service such as Resend only if parents ask for email sign-in.
- **Developer programs.** The Apple and Google programs wait until the beta needs them. The demo runs in Expo Go.

**Open questions.**

- [ ] Christian and Kevin: how do accepted revisions, existing event `seq`, and dependencies among offline groups relate? Who allocates each value, and how are lost acknowledgments and rejected predecessors handled without silently rebasing, renumbering, or skipping work?
- [ ] Christian and Kevin: where do authenticated scoring session identity and expected revision live? Define complete-group framing, ID scope, immutable-content comparison, acknowledgments, transport conflicts, and retry authorization after ownership changes.
- [ ] Christian and Kevin: what is the validation/replay interface for whole groups and time inputs? How does latest-group undo work across accepted and pending groups while preserving append-only history?
- [ ] Christian and Kevin: where are engine/schema versions, resolved rules, and deterministic setup inputs pinned, and what happens when a phone or deployment cannot execute a game's pinned version?
- [ ] Christian and Kevin: agree runtime JSON validation contracts and the declared validation-base representation, including how pinned inputs are identified. Kevin must choose a database read mechanism that guarantees a consistent validation snapshot; PostgreSQL freshness checks do not independently prove engine execution.
- [ ] Christian and Kevin: define the pending-group lifecycle and minimal visible conflict/recovery flow for the demo, including dependent local work. Full handoff/review screens remain beta work.
- [ ] Kevin, with Christian's security/privacy review: choose the trusted TypeScript runtime, restricted PostgreSQL execution privileges and verified caller context, demo authentication/access provisioning, and authorized read/subscription policy. Agree viewer snapshot/notification payloads, revision comparison representation, and periodic reconciliation interval/backoff with consumers; subscribe-before-fetch and connected reconciliation are required behavior.
- [ ] Did the Mustang coaches vote to allow leadoffs and steals in the second half this season?
- [ ] Can Christian and Kevin each merge the other's PRs after reviewing them? `AGENTS.md` now says only Christian merges.
- [ ] Which hosted streaming service, Amazon IVS or Mux? Kevin decides with a short test.

## Sources

- The September implementation plan (v1.4) and voice edge-case spec (v1), which this plan revises
- [Dugout: GameChanger API, does it exist?](https://www.getdugout.com/gamechanger-api)
- [gcstats: GameChanger API](https://gcstats.app/gamechanger-api/)
- [GameChanger: new scoring experience for baseball and softball](https://www.gc.com/post/new-scoring-experience-for-gamechanger-baseball-softball)
- [GameChanger help: pitch tracking settings](https://help.gc.com/hc/en-us/articles/19216166101261)
- [Filterjoe: review of GameChanger for youth baseball](https://www.filterjoe.com/?p=3322)

The GameChanger facts come from search results and these pages' summaries. They were not checked against GameChanger's current app.
