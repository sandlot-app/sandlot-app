# YC demo plan

Last updated October 22, 2026. Christian Alcala.

The deliverable is a submitted YC Winter 2027 application, due November 2, 2026. The demo video is its centerpiece. It shows one moment a reviewer remembers: a parent scores a real game by voice, keeps scoring with no signal, and their family watches it live and gets a stat card of their kid at the end. This plan cuts milestones 2 to 9 of [plan.md](plan.md) down to what the application needs, and nothing else.

## What the application needs

Every field maps to something we make or write. Fields only a founder can answer stay with the founders.

| Field | What we submit | Owner |
| --- | --- | --- |
| Founder profiles and co-founder | Christian and Kevin both listed, both profiles complete. The form won't submit otherwise. | Christian and Kevin |
| Founder video | One minute, both founders on camera: who we are, why this, why us | Christian and Kevin |
| Company name and 50-character description | "Sandlot" and a line such as "Voice scorekeeping for youth baseball and softball" | Christian |
| Demo | The demo video below, under 3 minutes and 100 MB | Both |
| Product link | The family live page for the recorded demo game, deployed at a public URL, with no login | Kevin |
| What you're making | Drafted from the lead and the family features in plan.md | Claude drafts, Christian edits |
| Who writes code | Christian and Kevin, each directing Claude Code and Codex. No code from non-founders. | Claude drafts |
| Tech stack, AI models and coding tools | Expo, React Native, TypeScript, Supabase, OpenAI speech-to-text, an AI parser model, a hosted streaming service, Claude Code and Codex | Claude drafts |
| Are people using the product | The parents who scored a game with Sandlot before the deadline, and what they said | Both |
| Competitors and what we understand | GameChanger, Bleacher Notes, Rizzler and the rest, after we try Bleacher Notes ourselves | Claude drafts, Christian edits |
| How you'll make money | Leagues pay, families use it free, plus sponsors and a paid family tier. Christian picks the lead model. | Christian, with a Claude draft |
| Other ideas | Ideas from the brainstorm that didn't make the plan | Christian |
| Location, time worked, legal entity, investment, why YC, how you heard | Only the founders know these | Christian and Kevin |

The drafted answers live in a shared doc, not in this repo, because the application includes personal details.

## The story the demo tells

The demo video runs about two minutes, under the application's 3-minute limit. Each scene shows one reason a team would switch.

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
| Family live page | Real, deployed at a public URL. The same link goes in the application as the product link. |
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
| 6. Family live page | A page in `apps/web` that subscribes to one game's events, replays them through the engine, and shows the score, diamond and play-by-play. Deployed at a public URL. | Kevin | Accounts, public pages |
| 7. Live streaming | A hosted service, a second phone with an existing streaming app, a player on the live page, the score overlay | Kevin | Our own broadcaster, recording, clips |
| 8. Game stat card | One child's line as an image, shared from the phone's share sheet | Christian | Card designs for other divisions |
| 9. YC demo | Real parents trying the app, the demo video, the founder video, the written answers, the submitted application | Both | |

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

Each step ends in a check. Christian's and Kevin's steps run side by side, and the evidence steps can start as soon as the tap app works.

1. **Engine core for the demo plays.** Done when a fixture for every play in the script passes.
2. **Live page replays events through the engine and is deployed** (Kevin). Done when the public URL shows the right score for the sample events on a phone that isn't on our network.
3. **Tap app scores a half-inning and syncs.** Done when the live page matches the phone, play for play.
4. **Try Bleacher Notes and talk to the Moraga commissioner.** Done when we have scored a game video with Bleacher Notes, and have written notes from the commissioner on scores, pitch counts and playing time. Both feed the competitors answer.
5. **Voice.** Done when 50 spoken plays recorded over the demo footage parse right, and complex plays show a confirm card.
6. **Streaming with the score overlay** (Kevin). Done when the video plays on the live page with the right score on top.
7. **Stat card.** Done when the card matches the box score.
8. **Put Sandlot in front of real parents.** At least three parents who keep score score an inning or more with the app, live or from video. Done when we have their names, what they scored, and what they said in their own words.
9. **Film and score the demo game live.** Done when the whole game is scored in the app and the live page matches.
10. **Rehearse the script twice, then record the demo.** Keep a backup take of every scene. Export at 1080p. About 5 Mbps keeps a 2-minute video near 75 MB, under the 100 MB limit. Done when the exported file is under 3 minutes and under 100 MB.
11. **Record the founder video.** One minute, both founders. Done when the file is under 100 MB and both founders approve it.
12. **Write the answers.** Claude drafts the answers in the table above, and the founders write the rest. Done when both founders have read every answer.
13. **Submit.** Both profiles complete, every required field filled. Done when the application shows as submitted.

## If time runs short

Cut in this order:

1. The video stream. The live page still shows score and play-by-play.
2. The offline scene, shortened to a few seconds.
3. The stat card's styling. A plain card still works.

Never cut voice scoring, the rule rejection, the family live page, the real-parent step or the founder video. The first three are the story. The last two are what the application asks for.

## Demo risks

| Risk | Response |
| --- | --- |
| Voice fails on camera | Record each scene separately and keep the best take. Tap scoring as the fallback is itself worth showing. |
| Bad signal where we film | Film where the signal is known to be good. The offline scene uses airplane mode on purpose. |
| Footage of children | Film adults only. No youth game footage until consent rules exist. |
| The live page lags | Measure play-to-page time before recording, and fix anything over a few seconds. |
| A secret lands in the repo | Keys stay in `.env` files, which git ignores. |
| No one is using the product yet | Step 8 puts the app in front of at least three real parents before the deadline, and the answer cites them honestly. |
| The product link breaks after we submit | Keep the demo game's live page deployed and unchanged until YC decides. |

## What the demo leaves out

Accounts, privacy controls, the correction preview, highlight clips, GameChanger import, recruiting profiles, payments and softball. The application names them as what comes next.
