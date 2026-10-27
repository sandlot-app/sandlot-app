# Voice scoring

The scorer holds the Voice Bar, says a pitch or a play, and lets go. While held, the Transcript Card shows the live words and turns to "Got it" with the read-back once the words would save. Releasing saves a simple play. An unclear press shows "Not sure — which one?" with big choices, and nothing saves until one is tapped. Sliding off the bar cancels the press. Anything voice can't handle shows one line, and the pitch buttons keep working.

## Sub-features

- `voice-save` saves a simple play on release ("strike swinging"). The status line and the Undo label name it (`voice-bar`, `waiting-plays`, `scorer-undo`).
- `voice-live` shows the Listening card with the live words, then Got it with the read-back, while the bar is held (`voice-card`, `voice-status`, `voice-words`, `voice-result`).
- `voice-not-sure` shows the readings as choices and saves only the one tapped (`voice-choice-0`, `voice-choice-1`).
- `voice-cancel` saves nothing when the finger slides off the bar.
- `voice-fallback` shows one line (`voice-message`) when voice can't help, such as "Voice is unavailable right now. Tap to score."

## How to get to it (user POV)

- Tap Start demo game or Continue scoring from Your games, then hold "Hold to score by voice" in the Scorer Bar.

## Driving it with Maestro

Preconditions:

- Start the run with the stub on, for every verify.sh command: `EXPO_PUBLIC_VOICE_STUB="strike swinging|strike" verify.sh launch`. A simulator can't speak, so the stub replaces the mic, voice-session and OpenAI's socket. Each finished press hears the next phrase. The press controller, route() and the engine run for real.
- `verify.sh doctor` reports every line ok.
- The saved demo game has fewer than two strikes, so both strikes are plain pitches. The flow undoes both at the end.

- **Save, Not sure and cancel.** Run `verify.sh drive voice-scoring.yaml`. Hold 1 hears "strike swinging" and saves it (screenshot `voice-saved`). Hold 2 hears "strike", shows Not sure with Strike looking and Strike swinging (screenshot `voice-not-sure`), and saves Strike looking on the tap. A slide off the bar saves nothing (screenshot `voice-cancelled`). It then undoes both plays.
- **Listening and Got it.** Maestro waits while it holds, so it can't screenshot mid-hold. Record the simulator during the drive (`xcrun simctl io <udid> recordVideo`) and take the Listening and Got it frames from the first hold.
- **Figma pairs.** The Listening, Got it and `voice-not-sure` screens pair with frames `87:3663`, `87:3886` and `87:4112`, in the ticket's `proof-<number>` release.

## Gotchas

- Without `EXPO_PUBLIC_VOICE_STUB`, and with no Supabase settings, every press says "Voice is unavailable right now. Tap to score." That's the fallback working, not a failure of the flow.
- The stub counts finished presses, so a second drive in the same launch starts on a later phrase. Relaunch before driving it again.
- The stub never runs in a release build. It's for the Mac check only.
