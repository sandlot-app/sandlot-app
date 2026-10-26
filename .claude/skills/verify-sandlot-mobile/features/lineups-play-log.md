# Lineups and the saved play log

Before the first saved game, the scorer can set both lineups, choose starting pitchers and the season half, then start the book. Plays shows the saved ordered history and keeps undone plays visible after reopening.

## Sub-features

- `setup` covers both saved lineup selections, Start completeness and the season-half override.
- `lineup` covers real drag, unique position assignment, starting-pitcher changes and adding from the existing roster.
- `history` covers ordered saved plays and whole-play Undo without removing historical events.
- `reopen` covers the chosen setup, score and undo history after connected Expo Go reopening.

## How to get to it (user POV)

- On Your games before any book is saved, tap New game (`new-game`). The existing Start demo game remains available.
- On New game, tap the Hawks or Marlins lineup row (`setup-lineup-away` or `setup-lineup-home`).
- In a lineup, drag its handle, tap a position, add a roster player or change the starting pitcher. Save lineup returns to New game.
- After both lineups are saved, tap Start game (`start-configured-game`).
- From the scorer, tap Plays (`tab-plays`). Field (`tab-field`) returns to scoring and its Undo control.

## Driving it with Maestro

Preconditions: the first-game setup path needs a verification simulator with no saved book. Keep every existing simulator's book. Use the script's supported `SANDLOT_SIM_NAME` override for a new dedicated simulator, and port8091 while no other Mac check runs. Set the same values for launch, doctor, drive and cleanup in one shell. Record that simulator during the single `lineups-play-log.yaml` drive. Do not clear app data to repeat setup.

- **Start completeness and half.** Tap `new-game`, capture `game-setup` and assert Start is disabled. Choose First half and Second half and capture the six- versus nine-out notes.
- **Rejection, drag and position.** Open `setup-lineup-away` and capture the original lineup. Set the current pitcher's position to Bats only, attempt Save lineup and capture the readable missing-pitcher reason. Restore P. Swipe down from `lineup-drag-sample-away-1` and confirm its visible batting-order number changed. Assign P through `lineup-position-sample-away-1` and `position-P`; the starting-pitcher row must identify K. Moss.
- **Pitcher and roster.** Choose `change-starting-pitcher`, then `choose-pitcher-sample-away-3`. Add `sample-away-11` through the roster picker and confirm Bats only. Save and confirm the eleven-player summary names S. Bell pitching.
- **Both teams and save.** Start stays disabled until the home lineup is also saved. Change its starting pitcher to N. Cole before saving. Start game creates one waiting play. Capture the saved scorer and copy the visible batter and pitcher identities.
- **Ordered history and undo.** Record Ball and a Single through the real In play sheets. Plays exposes saved sequences4 and5. Return to Field and Undo. The score has one ball and empty bases. Plays still exposes sequence5 with its undone marker and the later undo entry.
- **Reopen.** Stop Expo Go and reopen its localhost project link, then Continue scoring. The waiting count, score and copied batter and pitcher identities remain. Reopen Plays and capture the original Ball and the undone Single.

## Gotchas

- This app keeps one local book. A saved book cannot be replaced, reset or silently migrated to make the recipe run. Use another new dedicated verification simulator if source changes require a fresh before-Start run.
- Position selection swaps an existing occupant. The editor cannot add a player twice. It requires both saved selections and a pitcher; it does not invent a new minimum-fielder engine rule. Actual engine rejections remain roster membership and missing pitcher.
- New sample games use the second half from the planned Oct24 game date and documented Oct1 switch. The scorer can override the half before Start. Existing first-half books retain their stored rules.
- Display names and jersey numbers belong to presentation. The saved setup and events contain player IDs. Original numbered demo players keep their numbered fallback.
- The connected Expo Go reopen path is not #30's standalone no-signal cold launch proof.
