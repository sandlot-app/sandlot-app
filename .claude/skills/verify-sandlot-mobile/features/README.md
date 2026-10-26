# Sandlot mobile verification map

This directory is the maintained source for verifying what a scorer sees and does in the Sandlot mobile app. Read this index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- Run `.claude/skills/verify-sandlot-mobile/scripts/verify.sh launch` from the repo root and wait for the `READY` line.
- Run `verify.sh doctor` and require every line to read `ok`.
- The app runs in Expo Go on the `sandlot-verify` simulator, served by Metro on port 8091. Both belong to this run.
- The app keeps one local demo game in SQLite. A later launch preserves that game. Never clear app data to make a verification pass.
- Never drive a simulator or Metro server that `verify.sh launch` did not start.

## Driving conventions

- Start every recipe from a fresh `launch` unless its preconditions say otherwise.
- Find elements by their visible text or by a `testID`, never by screen coordinates.
- Put each recipe's steps in a Maestro flow under `flows/` and run it with `verify.sh drive <flow>.yaml`.
- Treat quoted text as literal. The app renders it exactly, including punctuation.

## Proof and skip reporting

- Capture the action and the resulting screen, not only the final screen. Use `takeScreenshot` in the flow after each step that changes the screen.
- Every `drive` writes `RESULT.txt`, `maestro.log`, `hierarchy.json` (the on-screen accessibility tree), `final.png`, and a copy of `metro.log` into its evidence folder.
- Name the feature file and the flow with every artifact you report.
- Report an unreachable path with the command you ran and the precondition that was missing.
- Do not report a path as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with Maestro` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands, and observable proof.

## Features

- [Home screen](./home-screen.md) covers the saved-game entry point.
- [Offline scoring](./offline-scoring.md) covers pitches, undo, saved state, and reopening.
- [Tap outcomes and runner moves](./tap-plays.md) covers In play, the four More actions, third-out evidence and whole-play undo.
- [Lineups and the saved play log](./lineups-play-log.md) covers first-game setup, chosen lineups and pitchers, season half, saved history and undo markers.

The first tap slice adds a preloaded lineup, diamond, pitch bar, undo, and a local pending-play badge. The tap outcomes and runner-move recipe adds hits, outs, chosen destinations and runner actions. The lineup recipe adds first-game setup and the saved play log. Hosted sync, voice scoring, and the stat card remain later work. The local Mac acceptance flow passed with evidence in docs/verification/26. It covers saved-game reopening, every pitch control, the normal-text dock and the development gallery. Standalone airplane-mode launch and spoken screen-reader delivery remain separate checks.
