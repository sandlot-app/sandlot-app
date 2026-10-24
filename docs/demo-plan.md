# YC demo plan

Last updated October 23, 2026. Christian Alcala.

The deliverable is a submitted YC Winter 2027 application, due November 2, 2026. The demo video is its centerpiece. It shows one moment a reviewer remembers: a parent scores a real game by voice, keeps scoring with no signal, and their family watches it live and gets a stat card and a highlight clip of their kid at the end. The close shows where that leads: a league's top-plays feed and verified profiles that scouts can trust. This plan cuts milestones 2 to 9 of [plan.md](plan.md) down to what the application needs, and nothing else.

## What the application needs

Every field maps to something we make or write. Fields only a founder can answer stay with the founders.

| Field | What we submit | Owner |
| --- | --- | --- |
| Founder profiles and co-founder | Christian and Kevin both listed, both profiles complete. The form won't submit otherwise. | Christian and Kevin |
| Founder video | One minute, both founders on camera: who we are, why this, why us | Christian and Kevin |
| Company name and 50-character description | "Sandlot" and a line such as "Voice scorekeeping for youth baseball and softball" | Christian |
| Demo | The demo video below, under 3 minutes and 100 MB | Both |
| Product link | The family live page for the recorded demo game, deployed at a public URL, with no login | Kevin |
| What you're making | Drafted from the lead and the family features in plan.md: voice scoring today, and every scored play becomes a tagged clip that grows into a highlights and recruiting network | Claude drafts, Christian edits |
| Who writes code | Christian and Kevin, each directing Claude Code and Codex. No code from non-founders. | Claude drafts |
| Tech stack, AI models and coding tools | Expo, React Native, TypeScript, Supabase, OpenAI speech-to-text, an AI parser model, a hosted streaming service, Claude Code and Codex | Claude drafts |
| Are people using the product | The parents who scored a game with Sandlot before the deadline, and what they said | Both |
| Competitors and what we understand | GameChanger, Bleacher Notes, Rizzler and the rest, after we try Bleacher Notes ourselves. GameChanger's scoring is free, and it charges families to follow games. | Claude drafts, Christian edits |
| How you'll make money | "Scoring and following the game are free. Families pay for video and highlights of their own kid, for less than GameChanger charges just to watch." Verified scout access and sponsors come later. Details in plan.md under Pricing. | Christian, with a Claude draft |
| Other ideas | Ideas from the brainstorm that didn't make the plan | Christian |
| Location, time worked, legal entity, investment, why YC, how you heard | Only the founders know these | Christian and Kevin |

The drafted answers live in a shared doc, not in this repo, because the application includes personal details.

## The story the demo tells

The demo video runs about two and a half minutes, under the application's 3-minute limit. Each scene shows one reason a team would switch.

| # | Scene | What the viewer sees | Length |
| --- | --- | --- | --- |
| 1 | The problem | A parent in the stands, phone in hand, tapping through menus while the game moves on | 10 s |
| 2 | Setup | Sandlot opens on a Mustang game with the lineup already loaded | 10 s |
| 3 | Voice scoring | The parent holds the button and says "ball", "strike", "Ramirez singles to left", "Chen steals second". The diamond moves and a banner reads each play back. "Runner scores" with two runners on shows buttons instead of guessing. "Scratch that" undoes a play. | 40 s |
| 4 | The rules are built in | A bunt is rejected with "Bunting isn't allowed in Mustang." A pitch-count warning appears for the pitcher. | 10 s |
| 5 | No signal | Airplane mode on, scoring continues. Airplane mode off, "3 plays synced." | 15 s |
| 6 | Family watches live | A second phone opens a text-message link with no app: live score, play-by-play, and video with the score drawn on top | 25 s |
| 7 | After the game | One child's stat card appears with a clip of their double, and is shared to Messages in one tap | 20 s |
| 8 | Close | What comes next, shown as labeled mock-ups: the league's top plays of the week, ranked by game situation, and a scout's view of a 15U player's profile with an "Opted in by parent" badge. Then the team. | 20 s |

## What is real and what is staged

Everything the scorer and the family touch is real. Only setup that a reviewer never sees is staged.

| Part | In the demo |
| --- | --- |
| Rules engine | Real. Every play goes through it. |
| Tap and voice scoring | Real. Voice needs signal and falls back to taps without it. |
| Offline scoring | Real for taps, shown with airplane mode |
| Family live page | Real, deployed at a public URL. The same link goes in the application as the product link. |
| Video stream | Real, from a second phone through a hosted service, and recorded |
| Stat card | Real, computed from the scored game |
| Highlight clip | Real, cut from the stream's recording around one play. The clock offset is entered by hand from a clap on camera at the first pitch. |
| Feed and scout view | Design mock-ups, not code, labeled on screen as what comes next. Made only from the adult demo footage. |
| Accounts and sign-in | Staged. One demo team and one demo family are built in, with no sign-in. |
| Roster | Staged. Made-up names and numbers in one JSON file the app and the page both read. |
| Game footage | A pickup or wiffle ball game played by adults we know, filmed and scored live. No children's footage, because no consent rules exist yet. |

## What each milestone delivers for the demo

| Milestone | Demo slice | Owner | Left for later |
| --- | --- | --- | --- |
| 2. Shared contract | Agreed in [contract.md](contract.md), including the public demo game and its first connection test | Both | Handoff and review screens, upgrades between engine versions, fixes to older plays |
| 3. Engine core | Mustang pitches, walks, strikeouts, hits with runner advances, steals, outs, innings, score, undo, bunt rejection, pitch-count warning, box score | Christian | Correction preview, missed-play suggestions, time limit, outs-per-day across games |
| 4. Tap scoring app | Preloaded lineup, diamond, pitch bar, outcome buttons, undo, an upload queue on the phone, a "plays waiting to sync" badge | Christian | Lineup editor, play log editing, handing off scoring |
| 5. Voice | Hold to talk, clip uploaded for transcription, a phrase list plus an AI parser, confirm card, read-back banner | Christian | Streaming transcription, a large test set |
| 6. Family live page | A page in `apps/web` that follows the demo game as [contract.md](contract.md) describes and shows the score, diamond and play-by-play. Deployed at a public URL. | Kevin | Accounts, public pages |
| 7. Live streaming and the clip | A hosted service that records, a second phone with an existing streaming app, a player on the live page, the score overlay, a `recordings` table with the clock offset, and one clip of one play shown next to the stat card | Kevin | Our own broadcaster, clips of every play, automatic clock matching |
| 8. Game stat card | One child's line as an image, shared from the phone's share sheet | Christian | Card designs for other divisions |
| Mock-ups | Design frames of the league's top-plays feed and a scout's view, labeled as what comes next | Christian | The real feed and scout access, milestones 14 and 16 |
| 9. YC demo | Real parents trying the app, the demo video, the founder video, the written answers, the submitted application | Both | |

## The shared contract

Both tracks build against [contract.md](contract.md), which Christian and Kevin agreed in PR 2. It covers the upload request, the commit checks, errors, the live page and demo access, and it wins when another doc disagrees. Its first connection test is the first step of work.

Two additions for the clip were agreed in PR 3: `Event.at` marks when the scorer started the action, and the clock offset lives in Kevin's `recordings` table, not in the game's fixed `setup`.

**Secrets.** Supabase keys go in `.env` files, which git already ignores. Share them directly, never in the repo.

## Order of work

Each step ends in a check. Christian's and Kevin's steps run side by side, and the evidence steps can start as soon as the tap app works.

0. **First connection test** from [contract.md](contract.md). Done when the second run of the sample requests adds no rows, and Kevin's page shows each play once.
1. **Engine core for the demo plays.** Done when a fixture for every play in the script passes.
2. **Live page replays events through the engine and is deployed** (Kevin). Done when the public URL shows the right score for the sample events on a phone that isn't on our network.
3. **Tap app scores a half-inning and syncs.** Done when the live page matches the phone, play for play.
4. **Try Bleacher Notes and talk to the Moraga commissioner.** Done when we have scored a game video with Bleacher Notes, and have written notes from the commissioner on scores, pitch counts and playing time. Both feed the competitors answer.
5. **Voice.** Done when 50 spoken plays recorded over the demo footage parse right, and complex plays show a confirm card.
6. **Streaming with the score overlay and recording** (Kevin). Pick IVS or Mux by testing recording, cutting a clip, and the cost of one streamed game. Done when the video plays on the live page with the right score on top, and the recording is saved.
7. **Stat card.** Done when the card matches the box score.
8. **The clip** (Kevin). Done when a clip cut from a test recording, using a play's `at` and a hand-entered offset, shows the whole play, and appears on the live page next to the stat card.
9. **Mock-ups** (Christian). Done when the feed and scout-view frames are made from the adult footage and labeled as what comes next.
10. **Put Sandlot in front of real parents.** At least three parents who keep score score an inning or more with the app, live or from video. Done when we have their names, what they scored, and what they said in their own words.
11. **Film and score the demo game live.** Someone claps on camera at the first pitch for the clip's clock offset. One pitcher throws at least 65 pitches, so the pitch-count warning in scene 4 happens for real. Done when the whole game is scored in the app, the live page matches, and the clip of the double shows the play.
12. **Rehearse the script twice, then record the demo.** Keep a backup take of every scene. Export at 1080p. About 4 Mbps keeps a 2.5-minute video near 75 MB, under the 100 MB limit. At 5 Mbps it would be about 94 MB, too close. Done when the exported file is under 3 minutes and under 100 MB.
13. **Record the founder video.** One minute, both founders. Done when the file is under 100 MB and both founders approve it.
14. **Write the answers.** Claude drafts the answers in the table above, and the founders write the rest. Done when both founders have read every answer.
15. **Submit.** Both profiles complete, every required field filled. Done when the application shows as submitted.

## If time runs short

Cut in this order:

1. The mock-ups. Scene 8 names the feed and scouting in words instead.
2. The clip. The stat card still appears without it.
3. The video stream. The live page still shows score and play-by-play.
4. The offline scene, shortened to a few seconds.
5. The stat card's styling. A plain card still works.

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
| The clip misses the play | Start the clip 10 to 15 seconds before the play's `at`, check the clap offset on a test recording first, and keep the stat card without the clip as the fallback |
| The mock-ups look like shipped features | Label them on screen as what comes next, and say so in the written answers |
| Kevin's track is overloaded | The clip moves to Christian after the stat card, still cut on the server |

## What the demo leaves out

Accounts, privacy controls, the correction preview, clips of every play, the real top-plays feed, scout access, vision models, GameChanger import, recruiting profiles, payments, observability and softball. The application names them as what comes next.
