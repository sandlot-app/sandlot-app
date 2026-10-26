# Scoring screen

The scorer's Field tab, built to the Figma frame "Scorer — Field tab (milestone 4)". It pins the nav and compact scoreboard, scrolls the field, the Matchup card and the Last pitch row, and keeps the Voice=Off Scorer Bar at the bottom. The Undo pill names the play it takes back, and the sync line names the last play and the plays saved on this phone.

## Sub-features

- `screen-scoreboard` shows team abbreviations, score, runners on the mini diamond, inning, count and outs. Screen readers hear the whole game summary (`score-summary`).
- `screen-field` places each fielder, runner and the batter at the Figma spots (`field`, `field-runner-1` to `field-runner-3`).
- `screen-matchup` shows the batter, on deck, the pitcher and their pitch count against the Mustang limit, with league alerts (`matchup`, `pitch-total`).
- `screen-last-pitch` names the last play and the pitcher's pitch number (`last-pitch`).
- `screen-undo-pill` reads "Undo · <play>" and is dimmed when nothing can be undone (`scorer-undo`).
- `screen-hit-by-pitch` records Hit by pitch from More in one tap (`more-hit_by_pitch`). The pitch bar has no Hit by pitch button.

## How to get to it (user POV)

- Tap Start demo game or Continue scoring from Your games.

## Driving it with Maestro

Preconditions:

- `verify.sh launch` printed READY and `verify.sh doctor` reports every line ok.
- Any saved demo state works. The flow reads the current summary and waiting total and returns to them.

- **Screen, Undo pill and Hit by pitch.** Run `verify.sh drive scoring-screen.yaml`. It captures the screen, records a Ball and sees "Undo · Ball", opens More (screenshot `more`), records Hit by pitch and sees "Undo · Hit by pitch" with a runner on first, undoes both, and checks the summary matches the start. It then scrolls to the Matchup card and Last pitch row.
- **Figma pairs.** The `field` and `more` screenshots are the app halves of the Figma comparison in `docs/verification/38/figma/`.

## Gotchas

- The sample names and jersey numbers come from the design's sample game. They live only in `src/scoring/demo-roster.ts` and never in events.
- The Video, Plays and Box score tabs and the nav's More menu are hidden until those features exist.
