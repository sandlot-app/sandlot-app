# Ticket 38: Figma Field tab on the scoring screen

## Mac check

`RESULT.txt` and `maestro.log` are the passing run of `acceptance-38.yaml` at commit `3be842e`, on the simulator `sandlot-verify-38` (iPhone 17 Pro, iOS 26.5, a fresh install). The app code is the same as `cf97416`; the later commits change only flows and notes. One Maestro session ran, in order:

1. `tap-plays.yaml` (#27): In play outcomes, fielders, runner destinations, the four More runner actions, third-out evidence, relaunch, and whole-play undo.
2. `scoring-screen.yaml` (#38): the screen, a Ball named on the Undo pill and sync line, More with Hit by pitch, a runner on first after Hit by pitch, both plays undone back to the starting summary, and the Matchup card and Last pitch row.
3. `offline-acceptance.yaml` (#26): the scrolling layout with the pitch bar fixed, every pitch control with undo, saved-game reopen and app relaunch, and the scorer gallery.

The old `sandlot-verify` simulator holds a demo game saved under engine 0.1.0, which the app now correctly refuses ("This game needs a different app version") after #31. Christian chose a separate fresh simulator over clearing it.

`screenshots/` holds the #38 flow's captures. The screen recording (50 MB) is kept out of git.

## Figma pairs

`figma/*-pair.png` put the live Figma render (left, 393 × 852) beside the Mac capture (right), scaled from the iPhone 17 Pro's 402 points to 393 wide. `figma/make-pairs.py` rebuilds them from `figma/*-figma.png` and `screenshots/`.

| Screen | Figma | Pair |
| --- | --- | --- |
| Field tab | [165:11107](https://www.figma.com/design/J8F4zRkkV63ji3AYhcHHwA?node-id=165-11107) | [field-pair.png](figma/field-pair.png) |
| More | [165:11367](https://www.figma.com/design/J8F4zRkkV63ji3AYhcHHwA?node-id=165-11367) | [more-pair.png](figma/more-pair.png) |

### Differences, and why

| Difference | Why |
| --- | --- |
| No Field / Video / Plays / Box score tabs, so the field sits right under the scoreboard | Video, Plays and Box score aren't built. Milestone 4 hides controls for unbuilt features. |
| No "•••" in the nav bar | The game menu isn't built. |
| No Pitching change row in More | #39 builds it. |
| A Pitch section with Hit by pitch in More | Christian's choice on 2026-10-26 (option A). The row uses More's card and row styles and an icons.download icon. |
| No today's line on the Matchup card ("0 for 1, BB", "· 1 K") | The engine has no box score yet. That's stat work for milestone 8, so the card shows only what the engine knows. |
| Sync line reads "Offline · N plays saved on this phone", not the green "All pitches saved" | Nothing uploads until #29, so every play is waiting on the phone. The design's Offline variant is the one that shows a count, as the ticket asks. |
| League alert lines under the pitch meter | Keeps #26/#27's visible pitch-count and league alerts. The Figma frame has no alert, so the lines sit in the Matchup card's pitcher block. |
| Score, inning, players on base and Undo state differ | The run starts from the app's own saved demo game, not the design's Bottom 5 sample. |
| Padding of 20, 18, 14 and gaps of 6, 3, 2 become 16, 16, 12 and 4, 4, 0 | Every padding and gap must be a `@sandlot/tokens` spacing value. |
| Scoreboard's top highlight gradient, chips' inner shadows and the pitch buttons' 1 px drop shadow are left out | Fixed decoration with no tokens. Low. |
| Pitch bar wording "All plays saved" (Figma "All pitches saved") in the saved state | #37's shared bar, already reviewed. This screen shows only the offline state. |
