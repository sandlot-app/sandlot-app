# YC demo plan

Last updated October 22, 2026. Christian Alcala.

The demo shows one moment a reviewer remembers: a parent scores a real game by voice, keeps scoring with no signal, and their family watches it live and gets a stat card of their kid at the end. The YC application is due November 2, 2026. This plan cuts milestones 2 to 9 of [plan.md](plan.md) down to what the demo shows, and nothing else.

## The story the demo tells

The demo video runs about two minutes. Each scene shows one reason a team would switch.

| # | Scene | What the viewer sees | Length |
| --- | --- | --- | --- |
| 1 | The problem | A parent in the stands, phone in hand, tapping through menus while the game moves on | 10 s |
| 2 | Setup | Sandlot opens on a Mustang game with the lineup already loaded | 10 s |
| 3 | Voice scoring | The parent holds the button and says "ball", "strike", "Ramirez singles to left", "Chen steals second". The diamond moves and a banner reads each play back. "Runner scores" with two runners on shows buttons instead of guessing. "Scratch that" undoes a play. | 40 s |
| 4 | The rules are built in | A bunt is rejected with "Bunting isn't allowed in Mustang." A pitch-count warning appears for the pitcher. | 10 s |
| 5 | No signal | Airplane mode on, scoring continues. Airplane mode off, "3 plays synced." | 15 s |
| 6 | Family watches live | A second phone opens a text-message link with no app: live score, play-by-play, and video with the score drawn on top | 25 s |
| 7 | After the game | One child's stat card appears and is shared to Messages in one tap | 15 s |
| 8 | Close | What comes next: league tools, highlight clips, the team | 10 s |

## What is real and what is staged

Everything the scorer and the family touch is real. Only setup that a reviewer never sees is staged.

| Part | In the demo |
| --- | --- |
| Rules engine | Real. Every play goes through it. |
| Tap and voice scoring | Real. Voice needs signal and falls back to taps without it. |
| Offline scoring | Real for taps, shown with airplane mode |
| Family live page | Real, on a private link |
| Video stream | Real, from a second phone through a hosted service. Cut if not ready. |
| Stat card | Real, computed from the scored game |
| Accounts and sign-in | Staged. One demo team and one demo family are built in, with no sign-in. |
| Roster | Staged. Made-up names and numbers in one JSON file the app and the page both read. |
| Game footage | A pickup or wiffle ball game played by adults we know, filmed and scored live. No children's footage, because no consent rules exist yet. |

## What each milestone delivers for the demo

| Milestone | Demo slice | Owner | Left for later |
| --- | --- | --- | --- |
| 2. Shared contract | The event JSON, `games` and `events` tables, upload by direct insert under a demo-only policy | Both | The `sync-events` server recheck |
| 3. Engine core | Mustang pitches, walks, strikeouts, hits with runner advances, steals, outs, innings, score, undo, bunt rejection, pitch-count warning, box score | Christian | Correction preview, missed-play suggestions, time limit, outs-per-day across games |
| 4. Tap scoring app | Preloaded lineup, diamond, pitch bar, outcome buttons, undo, an upload queue on the phone, a "plays waiting to sync" badge | Christian | Lineup editor, play log editing, handing off scoring |
| 5. Voice | Hold to talk, clip uploaded for transcription, a phrase list plus an AI parser, confirm card, read-back banner | Christian | Streaming transcription, a large test set |
| 6. Family live page | A page in `apps/web` that subscribes to one game's events, replays them through the engine, and shows the score, diamond and play-by-play | Kevin | Accounts, public pages |
| 7. Live streaming | A hosted service, a second phone with an existing streaming app, a player on the live page, the score overlay | Kevin | Our own broadcaster, recording, clips |
| 8. Game stat card | One child's line as an image, shared from the phone's share sheet | Christian | Card designs for other divisions |
| 9. YC demo | Rehearse, record, edit, write the application | Both | |

## The shared contract

Both tracks build against this. Change it only when both people agree.

**The event.** The engine's `Event` type, sent as JSON. Players appear only as IDs.

```json
{
  "id": "6f1c2c0e-8a3b-4b7e-9d2a-1f4e5a6b7c8d",
  "gameId": "0b7e9a54-2f3c-4d1e-8a6b-5c4d3e2f1a0b",
  "seq": 12,
  "group": "c2d3e4f5-a6b7-4c8d-9e0f-1a2b3c4d5e6f",
  "lockEpoch": 1,
  "source": "voice",
  "at": "2026-10-23T03:12:09.120Z",
  "command": { "kind": "pitch", "result": "ball" }
}
```

**The tables.**

```sql
create table games (
  id uuid primary key,
  name text not null,
  preset text not null,
  created_at timestamptz not null default now()
);

create table events (
  id uuid primary key,
  game_id uuid not null references games (id),
  seq int not null,
  group_id uuid not null,
  lock_epoch int not null,
  source text not null check (source in ('tap', 'voice')),
  at timestamptz not null,
  command jsonb not null,
  received_at timestamptz not null default now(),
  unique (game_id, seq)
);
```

**The upload.** The phone upserts each unsent event by `id` and ignores ones the server already has, so a retry never adds a play twice. For the demo only, a row-level security policy lets anyone with the anon key insert and read events for the demo game. Real accounts replace that policy in milestone 10.

**Live updates.** The live page subscribes to inserts on `events` for one `game_id`, through Supabase Realtime.

**Secrets.** The Supabase URL and anon key go in `.env` files, which git already ignores. Share them directly, never in the repo.

## Tonight's goal

**An event the engine produces on Christian's machine appears on Kevin's live page within a few seconds.** That is milestone 2's check, and it proves the two tracks connect before either builds much on top.

**Christian, with Claude Code:**

- [ ] Add a script that prints a sample half-inning as event JSON, `pnpm --filter @sandlot/engine sample-events`. Both sides test against its output.
- [ ] Add a script that upserts those events into Supabase using the URL and anon key from `.env`.

**Kevin, with his agents:**

- [ ] Create the Supabase project and share the URL and anon key with Christian directly.
- [ ] Add the two tables above as the first migration in `supabase/migrations/`, plus the demo-only policy, and turn on Realtime for `events`.
- [ ] Start `apps/web` with one page that lists one game's events as they arrive.
- [ ] Stretch: try Amazon IVS or Mux and get a test stream playing in a browser.

**Done when.** Christian runs the upload script twice. Kevin's page shows each event exactly once, which proves a retry adds nothing.

**Agree before starting:** the demo game's ID, and who changes `pnpm-lock.yaml` tonight. Only one person should.

## Order of work after tonight

Each step ends in a check. Christian's and Kevin's steps run side by side.

1. **Engine core for the demo plays.** Done when a fixture for every play in the script passes.
2. **Live page replays events through the engine** (Kevin). Done when the page shows the right score for the sample events.
3. **Tap app scores a half-inning and syncs.** Done when the live page matches the phone, play for play.
4. **Voice.** Done when 50 spoken plays recorded over the demo footage parse right, and complex plays show a confirm card.
5. **Streaming with the score overlay** (Kevin). Done when the video plays on the live page with the right score on top.
6. **Stat card.** Done when the card matches the box score.
7. **Film and score the demo game live.** Done when the whole game is scored in the app and the live page matches.
8. **Rehearse the script twice, then record.** Keep a backup take of every scene.
9. **Write the application and record the founder video.** Done when the application is submitted.

## If time runs short

Cut in this order:

1. The video stream. The live page still shows score and play-by-play.
2. The offline scene, shortened to a few seconds.
3. The stat card's styling. A plain card still works.

Never cut voice scoring, the rule rejection, or the family live page. Those three are the story.

## Demo risks

| Risk | Response |
| --- | --- |
| Voice fails on camera | Record each scene separately and keep the best take. Tap scoring as the fallback is itself worth showing. |
| Bad signal where we film | Film where the signal is known to be good. The offline scene uses airplane mode on purpose. |
| Footage of children | Film adults only. No youth game footage until consent rules exist. |
| The live page lags | Measure play-to-page time before recording, and fix anything over a few seconds. |
| A secret lands in the repo | Keys stay in `.env` files, which git ignores. |

## What the demo leaves out

Accounts, privacy controls, the correction preview, highlight clips, GameChanger import, recruiting profiles, payments and softball. The application names them as what comes next.
