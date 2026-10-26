# Offline scoring

A scorer records pitches and latest-play undo through the real engine. The app shows a new count only after SQLite saves the complete play and pending entry. Closing and reopening reconstructs the same game from its saved events.

## Sub-features

- `pitch-save` records Ball, Called strike, Swinging strike, Foul, or Hit by pitch.
- `pitch-count` displays the engine's count, outs, inning, score, runners, batter, and pitcher total.
- `pitch-undo` appends an undo play and restores the last active pitch. Setup cannot be undone here.
- `pitch-waiting` counts saved plays waiting to sync, including the opening and undo.
- `pitch-reopen` reads the same saved game after returning to Games and restarting the app.
- `pitch-layout` anchors the pitch dock while normal-size game content scrolls. Large text keeps every action reachable by scrolling.
- `pitch-spoken-result` announces each completed pitch or undo and any save failure without moving focus away from the control.

## How to get to it (user POV)

- Tap Start demo game from Your games when the slot is empty.
- Tap Continue scoring from Your games when a local game exists.

## Driving it with Maestro

Preconditions:

- `verify.sh launch` printed READY and `verify.sh doctor` reports every line ok.
- The existing demo is in progress. The flow reads its actual count and pending total and does not assume inning 1 or an empty count.
- The relaunch step uses the default Metro port 8091. A run on another port needs an external copy of the flow with only that link changed.

- **Complete Mac acceptance.** Run `verify.sh drive offline-acceptance.yaml` after launch and doctor. It combines the layout, all pitch controls and gallery paths in one Maestro session. Its passing result and log are in `docs/verification/26`, with screenshots and video in the `proof-26` release.
- **Pitch and undo.** Run `verify.sh drive offline-scoring.yaml`. It captures the existing count, records a ball, confirms the count changes and waiting total increases by one, then undoes it. The exact prior count returns and waiting increases by another play.
- **Reopen.** The same flow returns to Games, taps Continue scoring, and compares the exact prior count and pending total. It then stops Expo Go without clearing data, reopens the project link, and compares them again.
- **Other pitch buttons.** Capture the count before and after tapping `pitch-called_strike`, `pitch-swinging_strike`, `pitch-foul`, and `pitch-hit_by_pitch`. Undo each accepted pitch before trying the next. Use three strikes and four balls to show an out and a runner on first. Save before and after screenshots and the resulting accessibility tree.
- **Airplane mode.** On a native device capable of disabling network access, load the app and record the network state, turn on airplane mode, score and reopen, then compare the saved count and waiting plays. A development bundle may need Metro to launch. If that prevents a cold launch without signal, report the missing bundled-build check rather than claiming airplane-mode proof from the connected simulator flow.
- **Normal-size dock.** On a short portrait phone at the default text size, run `verify.sh drive scoring-layout.yaml`. It opens the saved game, scrolls the field while every pitch button and Undo remain visible, then records and undoes a ball without scrolling to the dock. It compares the restored count after scrolling back. Repeat on the smallest supported portrait screen. Capture the dock above the bottom safe area and the field at both scroll positions.
- **Large text.** On the same small screen, select the device's large accessibility text size and open Continue scoring. Scroll through the entire page in both directions. The decorative field may disappear, while pitch buttons, Undo, saved status, and Games remain reachable by scrolling. Check VoiceOver reads count and runner destinations in words.
- **VoiceOver.** Enable VoiceOver on the actual iOS app and record device audio with the before and after screens. Open Continue scoring and wait without acting. Opening a saved game must not announce a new saved pitch. Focus Ball, activate it, and keep focus there. After the saved waiting total increases, hear the saved result, score, inning and half, count, outs, and occupied bases. Activate Undo and hear the restored committed result. Focus and navigate the screen without scoring; those actions must not repeat the prior result.
- **Repeated results.** With VoiceOver still enabled, use pitch buttons to reach a two-strike count and note the pitches you add. Activate Foul twice and let each save finish. The count remains two strikes, but each tap increases the saved waiting total and requests its own spoken result. Undo every pitch added by this check to restore the prior game. If a genuine failed write can be reproduced safely, retry the same failed action twice and hear both failure results without a saved waiting-total increase. Report failure speech as unverified when no native failure can be reproduced. Do not substitute a mocked engine, staged success, or cleared game.
- **TalkBack.** Repeat the Ball, Undo, two-strike Foul, repeated-result, and failure checks on Android with TalkBack. Hear changed results through the existing live updates without an additional iOS announcement. Capture actual audio and the accessibility tree. A tree alone cannot prove spoken delivery, interruption behavior, or duplicate speech. If a recorded pitch ends the game, hear that the game is final with its saved result.
- **Save failure.** If a storage problem appears, capture `game-error` or `action-message` and the prior committed count. No success result or waiting-count increase may appear for an unsaved play. Automated real-SQL tests separately exercise rollback and lock contention.

## Gotchas

- Local demo means local storage only. The badge makes no claim of holding a hosted scorer lock or having uploaded plays.
- Undo adds pending work. The pending count does not fall when a pitch is undone.
- Do not clear data, add a reset shortcut, or use a test hook to establish the desired state. A final saved demo needs a separately authorized fresh test installation for more scoring.
- `scoring-layout.yaml` requires normal text size. Its fixed-dock assertions do not apply to the approved large-text whole-page scrolling layout. Check that layout separately.
- Mac proof covers native touch, SVG rendering, saved-game and Expo Go relaunch, every pitch control and the normal-text dock on iPhone 17 Pro with iOS 26.5. Small-screen font scaling, VoiceOver and TalkBack speech, physical-phone use and standalone airplane-mode cold launch remain unverified. Bundles and accessibility trees do not prove spoken delivery or offline cold launch.
