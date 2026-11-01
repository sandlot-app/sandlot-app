# Voice scoring

The scorer holds the Voice Bar, says a pitch or a play, and lets go. While held, the Transcript Card shows the live words. Pitch calls and a lone "undo" are read on the phone; anything else goes to the AI with the whole game in view (ADR 0007). A legal play saves, and a banner above the bar names each runner's result, built from what the engine recorded. An unclear press shows "Not sure — which one?" with big choices, and nothing saves until one is tapped. Sliding off the bar cancels the press. Anything voice can't handle shows one line, and the pitch buttons keep working.

## Sub-features

- `voice-save` saves a simple play on release ("strike swinging"). The status line and the Undo label name it (`voice-bar`, `waiting-plays`, `scorer-undo`).
- `voice-live` shows the Listening card with the live words while the bar is held (`voice-card`, `voice-status`, `voice-words`). Nothing reads the words until the press ends, so there is no Got it state any more.
- `voice-whole-press` (#103) saves a whole play said in one press with its banner (`voice-banner`, in the voice color rather than the warning one), refuses a name in the wrong role with a line saying who is up, and shows two readings when "the runner" could mean either of two runners.
- `voice-not-sure` shows the readings as choices and saves only the one tapped (`voice-choice-0`, `voice-choice-1`).
- `voice-cancel` saves nothing when the finger slides off the bar.
- `voice-fallback` shows one line (`voice-message`) when voice can't help, such as "Voice is unavailable right now. Tap to score." A press the engine refuses because the game moved says "That voice play didn't save. Say it again or tap to score." Holding the bar again before the last result arrives says "The last voice play didn't save. Say it again or tap to score." These are covered by the app's controller tests, not the Maestro flow, because the stub answers too fast to overlap two presses.

## How to get to it (user POV)

- Tap Start demo game (then save both lineups and tap Start game, as in lineups.md) or Continue scoring from Your games, then hold "Hold to score by voice" in the Scorer Bar.

## Driving it with Maestro

Preconditions:

- Start the run with the stub on, for every verify.sh command: `EXPO_PUBLIC_VOICE_STUB="strike swinging|strike" verify.sh launch`. A simulator can't speak, so the stub replaces the mic, voice-session and OpenAI's socket. Each finished press hears the next phrase. The press controller, decide() and the engine run for real.
- `verify.sh doctor` reports every line ok.
- The saved demo game has fewer than two strikes, so both strikes are plain pitches. The flow undoes both at the end.

- **Save, Not sure and cancel.** Run `verify.sh drive voice-scoring.yaml`. Hold 1 hears "strike swinging" and saves it (screenshot `voice-saved`). Hold 2 hears "strike", shows Not sure with Strike looking and Strike swinging (screenshot `voice-not-sure`), and saves Strike looking on the tap. A slide off the bar saves nothing (screenshot `voice-cancelled`). It then undoes both plays.
- **The whole press (#103).** Relaunch with `EXPO_PUBLIC_VOICE_STUB="double, everybody scores|Soto doubles|double, the runner scores"` and run `verify.sh drive acceptance-103.yaml`. The stub answers those three phrases the way the AI would, from the game the phone sends. Press 1 saves a double with everyone on base scoring (screenshot `voice-whole-play-banner`). Press 2 says "<batter> is up, not J. Soto." and saves nothing (screenshot `voice-wrong-role`); it assumes Soto isn't the batter due up. Four Ball taps then put runners on first and second, and press 3 shows two readings (screenshot `voice-two-readings`) and saves the second on a tap. The flow undoes its six plays at the end.
- **Listening.** Maestro waits while it holds, so it can't screenshot mid-hold. Record the simulator during the drive (`xcrun simctl io <udid> recordVideo`) and take the Listening frame from the first hold.
- **Figma pairs.** The Listening and `voice-not-sure` screens pair with frames `87:3663` and `87:4112`, in the ticket's `proof-<number>` release. The Got it frame (`87:3886`) is no longer shown: since #103 nothing reads the words until the press ends.

## Gotchas

- Without `EXPO_PUBLIC_VOICE_STUB`, and with no Supabase settings, every press says "Voice is unavailable right now. Tap to score." That's the fallback working, not a failure of the flow.
- The stub counts finished presses, so a second drive in the same launch starts on a later phrase. Relaunch before driving it again.
- The stub never runs in a release build. It's for the Mac check only.
