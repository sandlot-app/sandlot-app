# Voice scoring

The scorer holds the Voice Bar, says a pitch or a play, and lets go. While held, the Transcript Card shows the live words and turns to "Got it" with the read-back once the words would save. Releasing saves a simple play. An unclear press shows "Not sure — which one?" with big choices, and nothing saves until one is tapped. Sliding off the bar cancels the press. Anything voice can't handle shows one line, and the pitch buttons keep working.

## Sub-features

- `voice-save` saves a simple play on release ("strike swinging"). The status line and the Undo label name it (`voice-bar`, `waiting-plays`, `scorer-undo`).
- `voice-live` shows the Listening card with the live words, then Got it with the read-back, while the bar is held (`voice-card`, `voice-status`, `voice-words`, `voice-result`).
- `voice-not-sure` shows the readings as choices and saves only the one tapped (`voice-choice-0`, `voice-choice-1`).
- `voice-cancel` saves nothing when the finger slides off the bar.
- `voice-partial` (ADR 0006) saves the clear calls of a press at once as one Play and puts only the rest on one card. The Undo label names every call it takes back ("Undo · Ball · Ball"). The next press or tap drops the card, and `voice-message` says what wasn't saved ("1 call not saved: Strike").
- `voice-fallback` shows one line (`voice-message`) when voice can't help, such as "Voice is unavailable right now. Tap to score." A press the engine refuses because the game moved says "That voice play didn't save. Say it again or tap to score." Holding the bar again before the last result arrives says "The last voice play didn't save. Say it again or tap to score." These are covered by the app's controller tests, not the Maestro flow, because the stub answers too fast to overlap two presses.

## How to get to it (user POV)

- Tap Start demo game or Continue scoring from Your games, then hold "Hold to score by voice" in the Scorer Bar.

## Driving it with Maestro

Preconditions:

- Start the run with the stub on, for every verify.sh command: `EXPO_PUBLIC_VOICE_STUB="strike swinging|strike" verify.sh launch`. A simulator can't speak, so the stub replaces the mic, voice-session and OpenAI's socket. Each finished press hears the next phrase. The press controller, route() and the engine run for real.
- `verify.sh doctor` reports every line ok.
- The saved demo game has fewer than two strikes, so both strikes are plain pitches. The flow undoes both at the end.

- **Save, Not sure and cancel.** Run `verify.sh drive voice-scoring.yaml`. Hold 1 hears "strike swinging" and saves it (screenshot `voice-saved`). Hold 2 hears "strike", shows Not sure with Strike looking and Strike swinging (screenshot `voice-not-sure`), and saves Strike looking on the tap. A slide off the bar saves nothing (screenshot `voice-cancelled`). It then undoes both plays.
- **Partial save and dropped card (#84).** Relaunch with `EXPO_PUBLIC_VOICE_STUB="ball, ball, strike|ball"`, from a demo game whose batter has no balls yet, and run `verify.sh drive acceptance-84.yaml`. Hold 1 saves the two balls and asks about "strike" (screenshot `voice-partial`). Hold 2 drops that card and saves a ball (screenshot `voice-dropped`). It then undoes both plays.
- **Listening and Got it.** Maestro waits while it holds, so it can't screenshot mid-hold. Record the simulator during the drive (`xcrun simctl io <udid> recordVideo`) and take the Listening and Got it frames from the first hold.
- **Figma pairs.** The Listening, Got it and `voice-not-sure` screens pair with frames `87:3663`, `87:3886` and `87:4112`, in the ticket's `proof-<number>` release.

## Gotchas

- Without `EXPO_PUBLIC_VOICE_STUB`, and with no Supabase settings, every press says "Voice is unavailable right now. Tap to score." That's the fallback working, not a failure of the flow.
- The stub counts finished presses, so a second drive in the same launch starts on a later phrase. Relaunch before driving it again.
- The stub never runs in a release build. It's for the Mac check only.
