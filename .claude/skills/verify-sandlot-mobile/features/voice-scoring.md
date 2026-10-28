# Voice scoring

The scorer holds the Voice Bar, says a pitch or a play, and lets go. While held, the Transcript Card shows the live words and turns to "Got it" with the read-back once the words would save. Releasing saves a simple play. An unclear press shows "Not sure — which one?" with big choices, and nothing saves until one is tapped. Sliding off the bar cancels the press. Anything voice can't handle shows one line, and the pitch buttons keep working.

## Sub-features

- `voice-save` saves a simple play on release ("strike swinging"). The status line and the Undo label name it (`voice-bar`, `waiting-plays`, `scorer-undo`).
- `voice-live` shows the Listening card with the live words, then Got it with the read-back, while the bar is held (`voice-card`, `voice-status`, `voice-words`, `voice-result`).
- `voice-not-sure` shows the readings as choices and saves only the one tapped (`voice-choice-0`, `voice-choice-1`).
- `voice-cancel` saves nothing when the finger slides off the bar.
- `voice-warm-mic` keeps the phone's mic listening while the scoring screen is open and in the foreground, and keeps only the last second in memory so a press starts with it (ADR 0005). The idle bar reads "Mic ready" (`voice-bar`). It stops on leaving the screen, on the Plays tab, and when the app leaves the foreground.
- `voice-mic-first-open` shows one line above the bar the first time a scoring screen opens, before iOS asks for the mic: "Sandlot listens only while you're on this screen, and only sends what you say after you press." (`voice-message`).
- `voice-mic-refused` shows "Turn on the mic in Settings" on the bar when the mic was refused. A press says it can't use the microphone, and the buttons keep scoring (`voice-bar`, `voice-message`).
- `voice-blank-retry` sends the recording to voice-parse once when the live transcript comes back blank, and shows "Didn't catch that" only when that is blank too. It is covered by the app's press and controller tests, not the Maestro flows, because the stub never returns a blank transcript.
- `voice-fallback` shows one line (`voice-message`) when voice can't help, such as "Voice is unavailable right now. Tap to score." A press the engine refuses because the game moved says "That voice play didn't save. Say it again or tap to score." Holding the bar again before the last result arrives says "The last voice play didn't save. Say it again or tap to score." These are covered by the app's controller tests, not the Maestro flow, because the stub answers too fast to overlap two presses.

## How to get to it (user POV)

- Tap Start demo game or Continue scoring from Your games, then hold "Hold to score by voice" in the Scorer Bar.

## Driving it with Maestro

Preconditions:

- Start the run with the stub on, for every verify.sh command: `EXPO_PUBLIC_VOICE_STUB="strike swinging|strike" verify.sh launch`. A simulator can't speak, so the stub replaces the mic, voice-session and OpenAI's socket. Each finished press hears the next phrase. The press controller, route() and the engine run for real.
- `verify.sh doctor` reports every line ok.
- The saved demo game has fewer than two strikes, so both strikes are plain pitches. The flow undoes both at the end.

- **Save, Not sure and cancel.** Run `verify.sh drive voice-scoring.yaml`. Hold 1 hears "strike swinging" and saves it (screenshot `voice-saved`). Hold 2 hears "strike", shows Not sure with Strike looking and Strike swinging (screenshot `voice-not-sure`), and saves Strike looking on the tap. A slide off the bar saves nothing (screenshot `voice-cancelled`). It then undoes both plays.
- **Listening and Got it.** Maestro waits while it holds, so it can't screenshot mid-hold. Record the simulator during the drive (`xcrun simctl io <udid> recordVideo`) and take the Listening and Got it frames from the first hold.
- **Warm mic.** Start the run with `EXPO_PUBLIC_VOICE_STUB="strike swinging" EXPO_PUBLIC_VOICE_STUB_MIC=granted`, then run `verify.sh drive voice-warm-mic.yaml`. The bar reads "Mic ready" on opening the scoring screen (screenshot `mic-ready`), still reads it after a press saves, and drops it on the Plays tab.
- **First open.** Start with `EXPO_PUBLIC_VOICE_STUB_MIC=undetermined` and run `voice-warm-mic-first-open.yaml`: the line shows (screenshot `mic-first-open-line`), then the bar reads "Mic ready" and the line goes.
- **Refused mic.** Start with `EXPO_PUBLIC_VOICE_STUB_MIC=denied` and run `voice-warm-mic-refused.yaml`: the bar says to turn the mic on in Settings (screenshot `mic-refused`), a press says why it can't listen, and tapping Ball still saves.
- **Figma pairs.** The Listening, Got it and `voice-not-sure` screens pair with frames `87:3663`, `87:3886` and `87:4112`, in the ticket's `proof-<number>` release.

## Gotchas

- Without `EXPO_PUBLIC_VOICE_STUB`, and with no Supabase settings, every press says "Voice is unavailable right now. Tap to score." That's the fallback working, not a failure of the flow.
- The stub counts finished presses, so a second drive in the same launch starts on a later phrase. Relaunch before driving it again.
- `EXPO_PUBLIC_VOICE_STUB_MIC` (`granted`, `undetermined`, `denied` or `busy`) turns the warm mic on over the stub's silent mic. Without it the stub mic only runs during a press, so the bar keeps reading "Hold to score by voice" and the other flows here are unchanged. The warm mic runs on iOS only, so Android keeps starting the mic on touch-down (ADR 0005). The stub says yes or no for the mic itself, so no iOS permission prompt shows in these runs: whether iOS's own prompt, the orange dot and the mic stopping on lock or app switch behave is the iPhone check.
- The stub never runs in a release build. It's for the Mac check only.
