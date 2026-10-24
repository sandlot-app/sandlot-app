#!/usr/bin/env bash
# Drive the Sandlot mobile app (Expo Go on a dedicated iOS simulator) and capture evidence.
# Usage: verify.sh launch | doctor | drive <flow.yaml> | screenshot <name> | cleanup [--delete-sim]
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(git -C "$SKILL_DIR" rev-parse --show-toplevel)"
SIM_NAME="${SANDLOT_SIM_NAME:-sandlot-verify}"
PORT="${SANDLOT_METRO_PORT:-8091}"
RUN="$ROOT/.verify/run/$SIM_NAME"
EVIDENCE_ROOT="$ROOT/.verify/evidence"
DEVICE_TYPE="com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro"
EXPO_GO_ID="host.exp.Exponent"
APP_URL="exp://localhost:$PORT?__expo_disable_fab=1&__expo_disable_auto_launch=1&__expo_disable_onboarding=1"
MAESTRO="${MAESTRO:-$HOME/.maestro/bin/maestro}"

export EXPO_NO_TELEMETRY=1 MAESTRO_CLI_NO_ANALYTICS=1 MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true
export JAVA_HOME="${JAVA_HOME:-$(/usr/libexec/java_home -v 17 2>/dev/null || true)}"

log() { printf '[verify] %s\n' "$*" >&2; }
die() { log "FAIL: $*"; exit 1; }

sim_udid() {
  xcrun simctl list devices available -j | python3 -c '
import json, sys
name = sys.argv[1]
for devices in json.load(sys.stdin)["devices"].values():
    for d in devices:
        if d["name"] == name:
            print(d["udid"]); sys.exit()' "$SIM_NAME"
}

sim_state() {
  xcrun simctl list devices -j | python3 -c '
import json, sys
for devices in json.load(sys.stdin)["devices"].values():
    for d in devices:
        if d["udid"] == sys.argv[1]:
            print(d["state"]); sys.exit()' "$1"
}

latest_ios_runtime() {
  xcrun simctl list runtimes available -j | python3 -c '
import json, sys
ios = [r for r in json.load(sys.stdin)["runtimes"] if r["platform"] == "iOS"]
print(max(ios, key=lambda r: [int(p) for p in r["version"].split(".")])["identifier"])'
}

expo_go_installed() { xcrun simctl listapps "$1" 2>/dev/null | grep -q "\"$EXPO_GO_ID\""; }
listener_pid() { lsof -t -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -1; }
packager_running() { [ "$(curl -s --max-time 2 "http://localhost:$PORT/status" || true)" = "packager-status:running" ]; }

wait_for() { # wait_for <seconds> <description> <command...>
  local secs=$1 what=$2; shift 2
  for _ in $(seq 1 "$secs"); do "$@" && return 0; sleep 1; done
  die "timed out after ${secs}s waiting for $what"
}

ensure_expo_go() {
  local udid=$1 cached
  expo_go_installed "$udid" && return 0
  cached=$(ls -dt "$HOME"/.expo/ios-simulator-app-cache/Expo-Go-*.app 2>/dev/null | head -1 || true)
  if [ -n "$cached" ]; then
    log "installing Expo Go from $cached"
    xcrun simctl install "$udid" "$cached"
    return 0
  fi
  # No cached copy: let the Expo CLI download it. It installs on the booted simulator, so
  # refuse when another simulator is booted rather than touch the user's device.
  local booted
  booted=$(xcrun simctl list devices booted | grep -c "(Booted)" || true)
  [ "$booted" = "1" ] || die "Expo Go is not cached and $booted simulators are booted. Shut the others down and rerun launch."
  log "downloading Expo Go through the Expo CLI"
  (cd "$ROOT/apps/mobile" && CI=1 exec npx expo start --ios --localhost --port "$PORT") >"$RUN/expo-go-fetch.log" 2>&1 </dev/null &
  echo $! >"$RUN/expo-go-fetch.pid"
  wait_for 600 "Expo Go to install" expo_go_installed "$udid"
  kill_tree "$(cat "$RUN/expo-go-fetch.pid")"
  rm -f "$RUN/expo-go-fetch.pid"
  wait_for 30 "the fetch server to release port $PORT" sh -c "! lsof -t -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1"
}

cmd_launch() {
  mkdir -p "$RUN"
  [ -x "$MAESTRO" ] || die "Maestro not found at $MAESTRO (see SKILL.md, Prerequisites)"
  local udid
  udid=$(sim_udid)
  if [ -z "$udid" ]; then
    log "creating simulator $SIM_NAME"
    udid=$(xcrun simctl create "$SIM_NAME" "$DEVICE_TYPE" "$(latest_ios_runtime)")
  fi
  echo "$udid" >"$RUN/udid"
  [ "$(sim_state "$udid")" = "Booted" ] || xcrun simctl boot "$udid"
  xcrun simctl bootstatus "$udid" -b >/dev/null
  log "simulator $SIM_NAME ($udid) booted"

  ensure_expo_go "$udid"

  if [ -n "$(listener_pid)" ]; then
    [ -f "$RUN/metro.listener.pid" ] && [ "$(listener_pid)" = "$(cat "$RUN/metro.listener.pid")" ] \
      || die "port $PORT is held by a process this skill did not start (pid $(listener_pid)). Set SANDLOT_METRO_PORT to a free port."
    log "reusing Metro already started by this skill on port $PORT"
  else
    log "starting Metro on port $PORT"
    (cd "$ROOT/apps/mobile" && CI=1 exec nohup npx expo start --localhost --port "$PORT") >"$RUN/metro.log" 2>&1 </dev/null &
    echo $! >"$RUN/metro.pid"
    wait_for 120 "Metro on port $PORT" packager_running
    listener_pid >"$RUN/metro.listener.pid"
  fi

  # Expo Go's first start after a boot can take a minute or more, and openurl gives up after
  # about 10 seconds. Start Expo Go, then retry the project link until it is accepted.
  xcrun simctl terminate "$udid" "$EXPO_GO_ID" 2>/dev/null || true
  xcrun simctl launch "$udid" "$EXPO_GO_ID" >/dev/null
  local opened=0
  for _ in $(seq 1 12); do
    if xcrun simctl openurl "$udid" "$APP_URL" 2>>"$RUN/openurl.log"; then opened=1; break; fi
    sleep 2
  done
  [ "$opened" = 1 ] || die "Expo Go never accepted $APP_URL. See $RUN/openurl.log"
  "$MAESTRO" --device "$udid" test "$SKILL_DIR/flows/_ready.yaml" >"$RUN/ready.log" 2>&1 \
    || die "the app did not show its home screen. See $RUN/ready.log and $RUN/metro.log"
  log "READY: Sandlot is on screen in $SIM_NAME, Metro on port $PORT"
}

cmd_doctor() {
  local ok=1 udid pid
  check() { if eval "$2"; then printf 'ok    %s\n' "$1"; else printf 'FAIL  %s\n' "$1"; ok=0; fi; }
  udid=$(sim_udid || true)
  check "simulator $SIM_NAME exists" '[ -n "$udid" ]'
  check "simulator $SIM_NAME is booted" '[ -n "$udid" ] && [ "$(sim_state "$udid")" = "Booted" ]'
  check "Expo Go is installed on $SIM_NAME" '[ -n "$udid" ] && expo_go_installed "$udid"'
  pid=$(listener_pid || true)
  check "Metro is listening on port $PORT" '[ -n "$pid" ]'
  check "this skill started that Metro" '[ -n "$pid" ] && [ -f "$RUN/metro.listener.pid" ] && [ "$pid" = "$(cat "$RUN/metro.listener.pid")" ]'
  check "Metro reports packager-status:running" 'packager_running'
  check "Maestro runs" '"$MAESTRO" --version >/dev/null 2>&1'
  printf 'info  commit %s%s\n' "$(git -C "$ROOT" rev-parse --short HEAD)" "$(git -C "$ROOT" diff --quiet HEAD -- apps packages || echo ' (apps/ or packages/ has uncommitted changes)')"
  [ "$ok" = 1 ]
}

new_evidence_dir() {
  local dir="$EVIDENCE_ROOT/$(date -u +%Y%m%dT%H%M%SZ)-$1"
  mkdir -p "$dir"
  echo "$dir" >"$RUN/last-evidence"
  echo "$dir"
}

cmd_drive() {
  local flow=${1:?usage: verify.sh drive <flow.yaml>} udid dir name status=0
  [ -f "$flow" ] || flow="$SKILL_DIR/flows/$flow"
  [ -f "$flow" ] || die "no flow at $1"
  udid=$(cat "$RUN/udid" 2>/dev/null) || die "not launched. Run: verify.sh launch"
  name=$(basename "$flow" .yaml)
  dir=$(new_evidence_dir "$name")
  cp "$flow" "$dir/flow.yaml"
  (cd "$dir" && "$MAESTRO" --device "$udid" test "$flow" --test-output-dir "$dir/maestro" >"$dir/maestro.log" 2>&1) || status=$?
  "$MAESTRO" --device "$udid" hierarchy >"$dir/hierarchy.json" 2>/dev/null || true
  xcrun simctl io "$udid" screenshot "$dir/final.png" >/dev/null 2>&1 || true
  cp "$RUN/metro.log" "$dir/metro.log" 2>/dev/null || true
  { echo "flow: $name"; echo "result: $([ $status = 0 ] && echo PASS || echo FAIL)"; echo "commit: $(git -C "$ROOT" rev-parse HEAD)"; echo "simulator: $SIM_NAME ($udid)"; } >"$dir/RESULT.txt"
  cat "$dir/RESULT.txt"
  echo "evidence: $dir"
  return $status
}

cmd_screenshot() {
  local name=${1:?usage: verify.sh screenshot <name>} udid dir
  udid=$(cat "$RUN/udid" 2>/dev/null) || die "not launched. Run: verify.sh launch"
  dir=$(cat "$RUN/last-evidence" 2>/dev/null || new_evidence_dir manual)
  xcrun simctl io "$udid" screenshot "$dir/$name.png" >/dev/null
  echo "$dir/$name.png"
}

kill_tree() { # kill a process this skill started and everything it spawned
  local child
  for child in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$child"; done
  kill -TERM "$1" 2>/dev/null || true
}

cmd_cleanup() {
  local udid pid
  for f in metro.pid expo-go-fetch.pid; do
    [ -f "$RUN/$f" ] && kill_tree "$(cat "$RUN/$f")"
  done
  if [ -f "$RUN/metro.listener.pid" ]; then
    pid=$(cat "$RUN/metro.listener.pid")
    [ "$(listener_pid || true)" = "$pid" ] && kill -TERM "$pid" 2>/dev/null || true
  fi
  udid=$(sim_udid || true)
  if [ -n "$udid" ]; then
    [ "$(sim_state "$udid")" = "Shutdown" ] || xcrun simctl shutdown "$udid" 2>/dev/null || true
    [ "${1:-}" = "--delete-sim" ] && xcrun simctl delete "$udid" && log "deleted simulator $SIM_NAME"
  fi
  rm -rf "$RUN"
  log "cleaned up. Evidence kept in $EVIDENCE_ROOT"
}

case "${1:-}" in
  launch) cmd_launch ;;
  doctor) cmd_doctor ;;
  drive) shift; cmd_drive "$@" ;;
  screenshot) shift; cmd_screenshot "$@" ;;
  cleanup) shift; cmd_cleanup "$@" ;;
  *) sed -n '2,3p' "$0"; exit 2 ;;
esac
