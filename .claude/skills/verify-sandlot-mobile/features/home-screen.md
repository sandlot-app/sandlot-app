# Home screen

Opening Sandlot shows Your games. The single demo slot either starts a preloaded game or reopens its saved pitches. Opening the app never creates another starting lineup or resets the existing game.

## Sub-features

- `home-open` draws the Sandlot brand and Your games.
- `home-start` offers Start demo game only before a game has been saved. It opens Game setup (see lineups.md).
- `home-resume` offers Continue scoring for the existing local game.
- `home-blocked` preserves unreadable or incompatible saved data and pauses scoring.

## How to get to it (user POV)

- Open the Sandlot project in Expo Go.
- Tap Games from the scoring screen.

## Driving it with Maestro

Preconditions:

- `verify.sh launch` printed READY and `verify.sh doctor` reports every line ok.
- Leave existing app data intact. The flow supports both the empty demo slot and a saved game.

- **Open the app.** Run `verify.sh drive home-screen.yaml`. The flow checks `sandlot-brand`, Your games, and either Start demo game or Continue scoring. It captures `home-screen.png`.
- **Return from scoring.** Tap `games-navigation`. Your games and `resume-game` appear. The saved summary shows the committed score and inning.
- **Blocked storage.** If `game-error` appears, capture the screen and stop. Do not delete data or replace the game to force a pass.

## Gotchas

- A saved game has no Start button. Continue scoring reopens SQLite and replays its original events.
- `sandlot-brand` identifies the lowercase wordmark without relying on its punctuation or accessibility label.
- Metro must be reachable to load the Expo Go development bundle. A bundle load failure is separate from a local storage failure.
- These updated flows are prepared but have not run on the Windows implementation host.
