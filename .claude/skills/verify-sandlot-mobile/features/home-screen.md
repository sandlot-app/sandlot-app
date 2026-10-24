# Home screen

Opening Sandlot shows the app's name and the state of a game that hasn't started, under Moraga Mustang rules: first inning, top half, no outs, and an empty count.

## Sub-features

- `home-open` opens the app in Expo Go and draws the home screen.
- `home-state` shows the starting game state, `Inning 1, top. 0 outs. Count 0-0.`

## How to get to it (user POV)

- Open the Sandlot project in Expo Go. There is no other entry point yet.

## Driving it with Maestro

Preconditions:

- `verify.sh launch` printed `READY`.
- `verify.sh doctor` reports every line `ok`.

- **Open the app.** `verify.sh launch` opens the project link in Expo Go and waits up to 90 seconds. The `READY` line means the text `Sandlot` is on screen.
- **Check the starting state.** Run `verify.sh drive home-screen.yaml`. The flow asserts `Sandlot` and `Inning 1, top. 0 outs. Count 0-0.` are visible and saves `home-screen.png`. `RESULT.txt` reads `result: PASS`.
- **Proof.** In the evidence folder that `drive` prints, `home-screen.png` is under `maestro/<local time>/home-screen/takeScreenshot/`, and `hierarchy.json` has both strings as `accessibilityText`.

## Gotchas

- The first launch on a new simulator downloads Expo Go and can take several minutes. Later launches install it from `~/.expo/ios-simulator-app-cache`.
- Expo Go shows `There was a problem running the requested project. Could not connect to the server.` when Metro is down. Run `verify.sh doctor`, then `cleanup` and `launch` again.
- Metro runs in CI mode, so it doesn't reload on file changes. After editing the app, run `cleanup` and `launch` again before driving.
- The state text comes from the rules engine's starting state. If the engine's starting state changes, this flow's expected text changes with it.
