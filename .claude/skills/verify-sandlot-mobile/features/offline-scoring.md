# Offline scoring

A scorer records pitches and latest-play undo through the real engine. The app shows a new count only after SQLite saves the complete play and pending entry. Closing and reopening reconstructs the same game from its saved events.

## Sub-features

- `pitch-save` records Ball, Called strike, Swinging strike, Foul, or Hit by pitch.
- `pitch-count` displays the engine's count, outs, inning, score, runners, batter, and pitcher total.
- `pitch-undo` appends an undo play and restores the last active pitch. Setup cannot be undone here.
- `pitch-waiting` counts saved plays waiting to sync, including the opening and undo.
- `pitch-reopen` reads the same saved game after returning to Games and restarting the app.
- `pitch-layout` anchors the pitch dock while normal-size game content scrolls. Large text keeps every action reachable by scrolling.

## How to get to it (user POV)

- Tap Start demo game from Your games when the slot is empty.
- Tap Continue scoring from Your games when a local game exists.

## Driving it with Maestro

Preconditions:

- `verify.sh launch` printed READY and `verify.sh doctor` reports every line ok.
- The existing demo is in progress. The flow reads its actual count and pending total and does not assume inning 1 or an empty count.
- The relaunch step uses the default Metro port 8091. A run on another port needs an external copy of the flow with only that link changed.

- **Pitch and undo.** Run `verify.sh drive offline-scoring.yaml`. It captures the existing count, records a ball, confirms the count changes and waiting total increases by one, then undoes it. The exact prior count returns and waiting increases by another play.
- **Reopen.** The same flow returns to Games, taps Continue scoring, and compares the exact prior count and pending total. It then stops Expo Go without clearing data, reopens the project link, and compares them again.
- **Other pitch buttons.** Capture the count before and after tapping `pitch-called_strike`, `pitch-swinging_strike`, `pitch-foul`, and `pitch-hit_by_pitch`. Undo each accepted pitch before trying the next. Use three strikes and four balls to show an out and a runner on first. Save before and after screenshots and the resulting accessibility tree.
- **Airplane mode.** On a native device capable of disabling network access, load the app and record the network state, turn on airplane mode, score and reopen, then compare the saved count and waiting plays. A development bundle may need Metro to launch. If that prevents a cold launch without signal, report the missing bundled-build check rather than claiming airplane-mode proof from the connected simulator flow.
- **Normal-size dock.** On a short portrait phone at the default text size, run `verify.sh drive scoring-layout.yaml`. It opens the saved game, scrolls the field while every pitch button and Undo remain visible, then records and undoes a ball without scrolling to the dock. It compares the restored count after scrolling back. Repeat on the smallest supported portrait screen. Capture the dock above the bottom safe area and the field at both scroll positions.
- **Large text.** On the same small screen, select the device's large accessibility text size and open Continue scoring. Scroll through the entire page in both directions. The decorative field may disappear, while pitch buttons, Undo, saved status, and Games remain reachable by scrolling. Check VoiceOver reads count and runner destinations in words.
- **Save failure.** If a storage problem appears, capture `game-error` or `action-message` and the prior committed count. No success result or waiting-count increase may appear for an unsaved play. Automated real-SQL tests separately exercise rollback and lock contention.

## Gotchas

- Local demo means local storage only. The badge makes no claim of holding a hosted scorer lock or having uploaded plays.
- Undo adds pending work. The pending count does not fall when a pitch is undone.
- Do not clear data, add a reset shortcut, or use a test hook to establish the desired state. A final saved demo needs a separately authorized fresh test installation for more scoring.
- `scoring-layout.yaml` requires normal text size. Its fixed-dock assertions do not apply to the approved large-text whole-page scrolling layout. Check that layout separately.
- Native touch, SVG rendering, font scaling, cold reopen, and airplane-mode proof remain pending. Windows tests and both bundles do not satisfy these checks.
