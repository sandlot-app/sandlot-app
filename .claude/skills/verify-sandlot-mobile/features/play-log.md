# Play log

The scorer's Plays tab, built to the Figma frame "Viewer — Plays tab (full length)". It shows the expanded scoreboard and the tabs, then the saved book newest half-inning first. Each half lists its plate appearances, newest first, with what happened, the outs and runners after it, and the count it ended on; open, an at-bat shows its pitches. An undone play stays where it was, struck through and marked Undone. The current half has the live dot and is always open, and the batter still up is always open.

## Sub-features

- `log-tabs` switches between Field and Plays (`tab-field`, `tab-plays`). Video and Box score stay hidden until they exist.
- `log-scoreboard` is the expanded scoreboard: role badges, big scores, the count in dots and the Live badge. Screen readers hear the same summary as the Field tab (`score-summary`).
- `log-halves` lists half-innings newest first with runs and hits, and errors on finished halves. Older halves start closed and open on a tap (`half-<top|bottom>-<inning>`).
- `log-at-bats` reads each finished plate appearance in words, such as "J. Soto walks." or "L. Darcy doubles to right. J. Soto scores.", and the batter still up as "<name> at bat" with the pitcher's pitch number (`at-bat-<id>`).
- `log-undone` keeps an undone play in its at-bat with "Undone" in place of its count (`play-undone-<id>`). After undoing a third out, the half the game went back to is the current one.

## How to get to it (user POV)

- From the scoring screen, tap Plays under the scoreboard.

## Driving it with Maestro

Preconditions:

- `verify.sh launch` printed READY and `verify.sh doctor` reports every line ok.
- Any saved demo state works. The flow records two balls and undoes both, so the game ends as it began.

- **Plays tab.** Run `verify.sh drive play-log.yaml`. It records two balls and undoes the second, opens Plays and sees the scoreboard, a half-inning header and the batter at bat (screenshot `plays`), scrolls to the Undone row (screenshot `plays-undone`) and the hint, taps the pinned Field tab and undoes the first ball.
- **Ticket 28 acceptance.** Run `verify.sh drive acceptance-28.yaml`. It runs `tap-plays.yaml` first, then the scoring screen, the matchup ticket and the play log.
- **Figma pair.** The `plays` screenshot is the app half of the Figma comparison with `69:1895`, uploaded to the `proof-28` release as `figma-plays-pair.png`.

## Gotchas

- The log is built from the saved events each time Plays opens, so a long game takes a moment longer to open than a new one.
- iOS folds the list's container and the scoreboard's parts into their rows, so wait on visible text (a header's "batting", a row's "at bat") rather than `play-log`.
- The expanded scoreboard and the tabs stay pinned while the list scrolls. They don't shrink to the compact scoreboard yet.
