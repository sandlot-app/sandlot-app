# Scoring screen

The scorer's Field tab, built to the Figma frames "Scorer — Field tab (milestone 4)" and "Scorer — Matchup ticket". It pins the nav, the compact scoreboard and the matchup ticket, shrinks the field to the room left so nothing scrolls, and keeps the Scorer Bar at the bottom: a round Undo, the Voice Bar and a round More. Undo's label names the play it takes back, and the sync line names the last play and the plays saved on this phone.

## Sub-features

- `screen-scoreboard` shows team abbreviations, score, runners on the mini diamond, inning, count and outs. Screen readers hear the whole game summary (`score-summary`).
- `screen-field` places each fielder, runner and the batter at the Figma spots. The field is hidden from screen readers (the scoreboard summary carries the runners), so Maestro can't see it; check runners through `score-summary`.
- `screen-matchup` is the scalloped ticket under the scoreboard: the batter with "At bat · 3 for 4, 2B, HR" (or "First up"), and the pitcher with "Pitching · 24/75", amber from 65 and red from 75 (`matchup`, `batter-stat`, `pitch-total`). Names shorten with an ellipsis and stat lines never do; both icon marks hide when a stat line would wrap. League alerts sit under the ticket (`league-alert-<kind>`).
- `screen-field` keeps Figma's 361 × 390 shape and shrinks to fit above the Scorer Bar. At font scale above 1.35 the whole page scrolls instead (`game-content`).
- `screen-undo` is labeled "Undo · <play>" and is dimmed when nothing can be undone (`scorer-undo`).
- `screen-hit-by-pitch` records Hit by pitch from More in one tap (`more-hit_by_pitch`). The pitch bar has no Hit by pitch button.

## How to get to it (user POV)

- Tap Start demo game (then save both lineups and tap Start game, as in lineups.md) or Continue scoring from Your games.

## Driving it with Maestro

Preconditions:

- `verify.sh launch` printed READY and `verify.sh doctor` reports every line ok.
- Any saved demo state works. The flow reads the current summary and waiting total and returns to them.

- **Screen, Undo and Hit by pitch.** Run `verify.sh drive scoring-screen.yaml`. It captures the screen, records a Ball and sees "Undo · Ball", opens More (screenshot `more`), records Hit by pitch and sees "Undo · Hit by pitch" with a runner on first in the summary, undoes both, and checks the summary matches the start. It ends on the matchup ticket (screenshot `matchup`).
- **Matchup ticket.** Run `verify.sh drive matchup-ticket.yaml`. It checks the scoreboard, ticket and whole Scorer Bar are on screen together, records a Ball and sees the ticket's pitch count go up by one, then undoes it and sees the count and batter line return.
- **Figma pairs.** The `field` and `more` screenshots are the app halves of the Figma comparison. They go in the ticket's `proof-<number>` release as `figma-field-pair.png` and `figma-more-pair.png`, as the implementation loop's Proof release section says.

## Gotchas

- The sample names and jersey numbers come from the design's sample game. They live only in `src/scoring/demo-roster.ts` and never in events.
- The tabs show Field and Plays. Video and Box score and the nav's More menu are hidden until those features exist.
