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

1. Creates the simulator (`sandlot-verify` by default, an iPhone 17 Pro unless `SANDLOT_DEVICE_TYPE` names another phone, newest iOS runtime) if it doesn't exist, and boots it. If that simulator is already booted and this worktree's run didn't boot it, `launch` refuses, because another run (often another worktree) is driving it.
2. Installs Expo Go from `~/.expo/ios-simulator-app-cache`. With no cached copy, it lets the Expo CLI download Expo Go, and refuses if any other simulator is booted, because the CLI installs on whichever one is booted.
3. Starts Metro with `npx expo start --localhost --port <port>` in `apps/mobile`, in CI mode, and waits for `/status` to answer `packager-status:running`. It refuses to start if another process holds the port.
4. Opens `exp://localhost:<port>` in Expo Go and runs `flows/_ready.yaml`, which waits until the text `Sandlot` is on screen.

Ready means the line `[verify] READY: Sandlot is on screen in <simulator>, Metro on port <port>`. A first launch on a new simulator can take several minutes while Expo Go downloads. Later launches take about two minutes, most of it Expo Go's slow first start after a boot. Each `drive` takes another two to three minutes, because Maestro starts a Java process and a driver app on the simulator every time. Run long commands in the background rather than under a short timeout.

Every run needs its own simulator and port. Set both `SANDLOT_SIM_NAME` and `SANDLOT_METRO_PORT` for every command of that run. The script uses the port for Metro, for the `exp://localhost:<port>` link it opens in Expo Go, and for its port checks. Run state lives in `.verify/run/<simulator>/` in each worktree, but simulator names and ports are shared across the machine.

## Both simulators at once

Phone tickets are checked on two simulators, and they run side by side:

| Simulator | Phone | `SANDLOT_DEVICE_TYPE` | `SANDLOT_METRO_PORT` |
| --- | --- | --- | --- |
| `sandlot-verify-38` | iPhone 17 Pro | `iPhone-17-Pro` | 8091 |
| `sandlot-verify-se` | iPhone SE | `iPhone-SE-3rd-generation` | 8092 |

With `SANDLOT_DEVICE_TYPE` set, `launch` creates a missing simulator as that phone and refuses one that's a different phone, and `doctor` checks it. That way an iPhone 17 Pro never passes as SE proof. Without it, new simulators are iPhone 17 Pro and nothing is checked.

Each run keeps `launch`, `doctor`, `drive` and `cleanup` in one shell command, so its Metro stays alive for the whole run, and records its own video. From the repo root:

```bash
v=.claude/skills/verify-sandlot-mobile/scripts/verify.sh
check() { # check <simulator> <port> <phone> <flow.yaml>
  ( export SANDLOT_SIM_NAME=$1 SANDLOT_METRO_PORT=$2 SANDLOT_DEVICE_TYPE=$3; s=1
    if "$v" launch && "$v" doctor; then
      xcrun simctl io "$1" recordVideo --force ".verify/$1.mp4" & rec=$!
      "$v" drive "$4"; s=$?
      kill -INT $rec; wait $rec
    fi
    "$v" cleanup; exit $s ) >".verify/$1.log" 2>&1
}
mkdir -p .verify
check sandlot-verify-38 8091 iPhone-17-Pro <flow>.yaml & a=$!
check sandlot-verify-se 8092 iPhone-SE-3rd-generation <flow>.yaml & b=$!
wait $a; ra=$?; wait $b; rb=$?
echo "sandlot-verify-38: $ra, sandlot-verify-se: $rb (0 is a pass)"
```

Run it in the background: both runs together take about as long as the slower one. Each run's output is in `.verify/<simulator>.log` and its video is `.verify/<simulator>.mp4`. The evidence for each run is in the `evidence:` folder its log names. Folder names include the simulator, so the two runs never share one.

- **Expo Go must be cached first.** With no copy in `~/.expo/ios-simulator-app-cache`, `launch` refuses while another simulator is booted. Run one simulator alone once to fill the cache.
- **One ticket's pair at a time.** These names and ports belong to one ticket's check. A second ticket checking at the same time uses its own simulator names and ports, such as 8093 and 8094. If it doesn't, `launch` refuses it, because the simulator or port is already taken.

### Committing both runs

Git keeps only one `RESULT.txt` and one `maestro.log` per ticket, so both simulators' passing runs go into the same two files. Each run's log goes under a header line naming its flow and simulator:

```bash
d=docs/verification/<number>; : >"$d/RESULT.txt"; : >"$d/maestro.log"
for e in <evidence folder> <evidence folder>; do
  { cat "$e/RESULT.txt"; echo; } >>"$d/RESULT.txt"
  { echo "== $(sed -n '1p;4p' "$e/RESULT.txt" | paste -sd' ' -)"; cat "$e/maestro.log"; echo; } >>"$d/maestro.log"
done
```

## Doctor

Run `verify.sh doctor` first whenever anything looks off. It changes nothing and exits non-zero on any failure. It checks that the simulator exists and is booted, that Expo Go is installed, that Metro is listening on the port, that this skill started that Metro, that Metro answers `/status`, and that Maestro runs. It also prints the commit and whether `apps/` or `packages/` has uncommitted changes, so you know which build you are driving.

## Drive

Write the user's steps as a Maestro flow in `flows/`, with `appId: host.exp.Exponent`, then run `verify.sh drive <flow>.yaml`. Don't use `launchApp`, which opens Expo Go's home instead of Sandlot. `launch` has already opened the project.

- Find elements by visible text (`tapOn: "Ball"`) or by a React Native `testID` (`tapOn: { id: "pitch-ball" }`). When you add a control to the app, give it a `testID` so flows don't depend on wording.
- Assert what the user sees after each step: `assertVisible: "Inning 1, top. 0 outs. Count 1-0."`.
- Wait for slow screens with `extendedWaitUntil` instead of fixed sleeps.

The feature map in `features/` is the list of what to drive. Read `features/README.md` first, then the feature file for what you changed. A proof that drives one entry point is incomplete when the map lists others.

## Evidence

Each `drive` makes `.verify/evidence/<UTC time>-<simulator>-<flow>/` at the repo root, which git ignores, and fills it with:

- `RESULT.txt`: the flow, PASS or FAIL, the commit, the simulator and its phone.
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

Run `verify.sh cleanup`. It stops only the Metro process this run started (by the PID it recorded), shuts down the simulator only if this run booted it, and removes `.verify/run/`. It never kills by process name and never touches a simulator it has no record of booting. Evidence in `.verify/evidence/` stays. Add `--delete-sim` to delete the simulator too, under the same rule. The next `launch` recreates it, as the phone `SANDLOT_DEVICE_TYPE` names.

Run cleanup after every failed attempt as well, so a broken run doesn't leave Metro holding its port.
