# Game setup and lineups

Starting the local demo game opens Game setup, built to the Figma frames "Scorer — Game setup (milestone 4)" and "Scorer — Lineup · Hawks (full length)". The scorer checks the season half, saves each team's lineup, and starts the game. Start saves the chosen half and both lineups as the game's first play, and reopening the game rebuilds it from them. The engine rejects an unusable lineup or start, and the screen says why.

## Sub-features

- `setup-details` shows the game's Away, Home, When, Field and Division.
- `setup-half` is the Season half control (`half-first`, `half-second`), pre-filled from the date the league switches, with its note (`half-note`).
- `setup-lineups` is a row per team, the Hawks first (`lineup-away`, `lineup-home`; the Hawks are the away side) reading "Not set yet" or "10 players · T. Nguyen pitching" (`lineup-summary-<side>`).
- `setup-start` is the button (`start-setup`): "Set both lineups to start" and off until both lineups are saved, then "Start game". A rejection appears above it (`setup-message`).
- `lineup-order` is the batting order. Everyone present bats, a player with no position reads "Bats only", and a handle drags a batter to a new place (`drag-handle-<n>`, `order-row-<n>`).
- `lineup-position` is the list a position pill opens (`position-<n>`, `position-sheet`, `position-choice-<label>`). A position another player holds swaps with them. "Not playing today" (`position-remove`) takes the batter out of the lineup.
- `lineup-pitcher` shows the starting pitcher (`starting-pitcher`) and the sheet "Change starting pitcher" opens (`change-pitcher`, `pitcher-sheet`, `pitcher-choice-<id>`, `pitcher-confirm`, button "Pitch first").
- `lineup-add` is "Add a player from the roster" (`add-player`, `add-sheet`). The sample lineups hold everyone on the roster, so until someone is taken out it reads "Everyone on the roster is already in the lineup." A player taken out is listed (`add-choice-<id>`) and goes back last with no position.
- `lineup-save` is Save lineup (`save-lineup`), which returns to Game setup, or shows the engine's reason (`lineup-message`).

## How to get to it (user POV)

- From Your games, tap Start demo game (`start-game`) while the slot is empty. A saved game has no Start button.

## Driving it with Maestro

Preconditions:

- `verify.sh launch` printed READY and `verify.sh doctor` reports every line ok.
- The phone has no saved local game. This path only exists before Start, and the flow never clears app data.

- **The whole path.** Run `verify.sh drive lineups-28.yaml`. It checks Start is off, tries the half control, changes a position and puts it back, drags K. Moss down and back, changes the starting pitcher and back, opens the empty roster list, takes B. Lane out with Not playing today and adds him back from the roster, saves the Hawks and checks the row (screenshot `setup-hawks-set`, the Figma state), saves the Marlins with nobody pitching (their row reads "no starting pitcher yet") and sees Start rejected with "The Marlins need a starting pitcher." (screenshot `setup-rejected`), fixes it, starts, undoes a pitch, reads it as Undone in Plays, and finds it again after reopening.
- **Other flows.** `_start-local-game.yaml` is the shared start: both lineups saved as they are, then Start. Every flow that scores the local demo game uses it.
- **Figma pairs.** `setup-hawks-set` pairs with `167:11241`, and `lineup-hawks-top` and `lineup-hawks-bottom` with `168:11244`. They are uploaded to the `proof-28` release.

## Gotchas

- Save lineup sits at the bottom of a scrolling page, so scroll to it before tapping.
- The flow gives the Marlins' pitcher "Bats only" on purpose, to show the rejection, then picks the pitcher again.
- Game setup is only for the local demo game. The live game still starts with the sample setup the server issued.
