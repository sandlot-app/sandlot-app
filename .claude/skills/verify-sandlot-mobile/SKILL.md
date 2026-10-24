---
name: verify-sandlot-mobile
description: Drive the Sandlot mobile app (Expo, apps/mobile) in its own iOS simulator with Maestro, and capture screenshots and the on-screen accessibility tree as proof. Use when you need to show that a change to apps/mobile or to packages/engine works in the real app, not just in tests.
---

# Verify Sandlot mobile

Sandlot's user surface is the Expo app in `apps/mobile`, run in Expo Go on an iOS simulator. This skill gives it a dedicated simulator (`sandlot-verify`) and a dedicated Metro port (8091), so it never touches the simulator or dev server a person is using. One script does everything:

```bash
.claude/skills/verify-sandlot-mobile/scripts/verify.sh launch | doctor | drive <flow.yaml> | screenshot <name> | cleanup [--delete-sim]
```

Run it from anywhere in the repo. The engine in `packages/engine` has no screen of its own. Prove engine rules with `pnpm verify`, and use this skill when a rule has to show up in the app.

## Prerequisites

- macOS with Xcode and an iOS simulator runtime (`xcrun simctl list runtimes`).
- Java 17 (`/usr/libexec/java_home -v 17`). The script sets `JAVA_HOME` from it.
- Maestro at `~/.maestro/bin/maestro`, or set `MAESTRO` to its path. Homebrew refuses to install it while Xcode is older than Homebrew wants. The GitHub release zip works: download `maestro.zip` from `github.com/mobile-dev-inc/Maestro/releases`, check it against `checksums_sha256.txt`, and unzip it so `~/.maestro/bin/maestro` exists.
- `pnpm install` has run at the repo root.

The script turns off Maestro and Expo telemetry for every command.

## Launch

Run `verify.sh launch`. It:

1. Creates the `sandlot-verify` simulator (iPhone 17 Pro, newest iOS runtime) if it doesn't exist, and boots it. If that simulator is already booted and this worktree's run didn't boot it, `launch` refuses, because another run (often another worktree) is driving it.
2. Installs Expo Go from `~/.expo/ios-simulator-app-cache`. With no cached copy, it lets the Expo CLI download Expo Go, and refuses if any other simulator is booted, because the CLI installs on whichever one is booted.
3. Starts Metro with `npx expo start --localhost --port 8091` in `apps/mobile`, in CI mode, and waits for `/status` to answer `packager-status:running`. It refuses to start if another process holds the port.
4. Opens `exp://localhost:8091` in Expo Go and runs `flows/_ready.yaml`, which waits until the text `Sandlot` is on screen.

Ready means the line `[verify] READY: Sandlot is on screen in sandlot-verify, Metro on port 8091`. A first launch on a new simulator can take several minutes while Expo Go downloads. Later launches take about two minutes, most of it Expo Go's slow first start after a boot. Each `drive` takes another two to three minutes, because Maestro starts a Java process and a driver app on the simulator every time. Run long commands in the background rather than under a short timeout.

To run a second instance alongside the first, such as an agent in another worktree, set both `SANDLOT_SIM_NAME` and `SANDLOT_METRO_PORT` to new values for every command of that run. Run state lives in each worktree's `.verify/run/`, but the simulator name and port are shared across the machine.

## Doctor

Run `verify.sh doctor` first whenever anything looks off. It changes nothing and exits non-zero on any failure. It checks that the simulator exists and is booted, that Expo Go is installed, that Metro is listening on the port, that this skill started that Metro, that Metro answers `/status`, and that Maestro runs. It also prints the commit and whether `apps/` or `packages/` has uncommitted changes, so you know which build you are driving.

## Drive

Write the user's steps as a Maestro flow in `flows/`, with `appId: host.exp.Exponent`, then run `verify.sh drive <flow>.yaml`. Don't use `launchApp`, which opens Expo Go's home instead of Sandlot. `launch` has already opened the project.

- Find elements by visible text (`tapOn: "Ball"`) or by a React Native `testID` (`tapOn: { id: "pitch-ball" }`). When you add a control to the app, give it a `testID` so flows don't depend on wording.
- Assert what the user sees after each step: `assertVisible: "Inning 1, top. 0 outs. Count 1-0."`.
- Wait for slow screens with `extendedWaitUntil` instead of fixed sleeps.

The feature map in `features/` is the list of what to drive. Read `features/README.md` first, then the feature file for what you changed. A proof that drives one entry point is incomplete when the map lists others.

## Evidence

Each `drive` makes `.verify/evidence/<UTC time>-<flow>/` at the repo root, which git ignores, and fills it with:

- `RESULT.txt`: the flow, PASS or FAIL, the commit, and the simulator.
- `maestro/`: Maestro's own report. Each `takeScreenshot: <name>` lands at `maestro/<local time>/<flow>/takeScreenshot/<name>.png`.
- `maestro.log`: each step and whether it passed.
- `hierarchy.json`: the accessibility tree on screen when the flow ended. Use it to show text and state, not just pixels.
- `final.png`: the screen when the flow ended.
- `metro.log`: the bundler log, including JavaScript errors.

`verify.sh screenshot <name>` adds one more screenshot to the latest evidence folder.

Proof standards:

- Drive the real user path: the buttons and screens a scorer uses. Don't call engine functions or set state from a test hook.
- Capture the action and the result. Screenshot before and after each step that changes the screen.
- When a change writes data (once the app saves games on the phone), show the saved result from a second view, such as reopening the game, not only the screen that saved it.
- Don't mock the engine. It runs inside the app.

## Cleanup

Run `verify.sh cleanup`. It stops only the Metro process this run started (by the PID it recorded), shuts down the simulator only if this run booted it, and removes `.verify/run/`. It never kills by process name and never touches a simulator it has no record of booting. Evidence in `.verify/evidence/` stays. Add `--delete-sim` to delete the simulator too, under the same rule. The next `launch` recreates it.

Run cleanup after every failed attempt as well, so a broken run doesn't leave Metro holding port 8091.
