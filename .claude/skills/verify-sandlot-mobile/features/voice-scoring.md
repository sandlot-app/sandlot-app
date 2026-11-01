# Voice scoring

The scorer taps the Voice Bar, says a pitch or a play, and taps again. There is no hold and no pause ending: a second tap, or the 30 s safety limit, ends the press. While the mic is open the Transcript Card shows the live words. Pitch calls and a lone "undo" are read on the phone; anything else goes to the AI with the whole game in view (ADR 0007). After the second tap the bar shows a spinner and "Reading your play…" with no button, then a plain "Saved" with a banner above the bar naming what saved, then the button grows back as "Tap to score by voice". An unclear press shows "Not sure — which one?" with big choices, and nothing saves until one is tapped. Tapping a scoring button while the mic is open drops that press. Anything voice can't handle shows one line, and the pitch buttons keep working.

## Sub-features

- `voice-whole-press` (#103) saves a whole play said in one press with its banner (`voice-banner`, in the voice color rather than the warning one), refuses a name in the wrong role with a line saying who is up, and shows two readings when "the runner" could mean either of two runners.
- `voice-save` saves a simple play on the second tap ("strike swinging"). The status line and the Undo label name it (`voice-bar`, `waiting-plays`, `scorer-undo`).
- `voice-live` shows the Listening card with the live words while the mic is open, and the bar reads "Listening… tap to finish" (`voice-card`, `voice-status`, `voice-words`).
- `voice-reading` shows "Reading…" on the card and "Reading your play…" with a spinner on the bar while an ended press is read. Nothing has saved yet, and the scoring buttons wait too, so a tap on Ball does nothing until the play is read (`voice-bar`, `voice-status`, `pitch-ball`). A press still unread after 15 s is dropped with one line, and the buttons come back; the controller tests cover that, because the stub always answers.
- `voice-saved` shows a plain "Saved" for a moment after a voice play saves, then the button grows back (`voice-bar`).
- `voice-not-sure` shows the readings as choices and saves only the one tapped (`voice-choice-0`, `voice-choice-1`).
- `voice-drop` drops the open press, saving nothing, when a scoring button is tapped. The tapped button still saves (`pitch-ball`).
- `voice-queue` reads presses that ended one after another and saves them in the order they ended, each on top of the one before. The bar has no button while a play is read, so a second press can't start from it: the app's controller tests cover the queue, not the Maestro flows. A queued press the AI read doesn't save behind another voice play, because the AI never saw that game: it says it didn't save. That includes a spoken correction said while the play it corrects is still saving, on purpose.
- `voice-warm-mic` keeps the phone's mic listening while the scoring screen is open and in the foreground, and keeps only the last second in memory so a press starts with it (ADR 0005). The idle bar's accessibility label reads "Mic ready. Tap to score by voice" (`voice-bar`). It stops on leaving the screen, on the Plays tab, and when the app leaves the foreground.
- `voice-mic-first-open` shows one line above the bar the first time a scoring screen opens, before iOS asks for the mic: "Sandlot listens only while you're on this screen, and only sends what you say after you press." (`voice-message`).
- `voice-mic-refused` shows "Turn on the mic in Settings" on the bar when the mic was refused. A press says it can't use the microphone, and the buttons keep scoring (`voice-bar`, `voice-message`).
- `voice-limit` ends a press at 30 s of audio with no tap (screenshot `voice-limit-reading`). The flow waits the full 30 s, because the stub's mic delivers silence at real speed.
- `voice-blank-retry` sends the recording to voice-parse once when the live transcript comes back blank, and shows "Didn't catch that" only when that is blank too. It is covered by the app's press and controller tests, not the Maestro flows, because the stub never returns a blank transcript.
- `voice-fallback` shows one line (`voice-message`) when voice can't help, such as "Voice is unavailable right now. Tap to score." A press the engine refuses because the game moved says "That voice play didn't save. Say it again or tap to score." This is covered by the app's controller tests, not the Maestro flow, because the stub answers too fast to overlap two presses.

## How to get to it (user POV)

- Tap Start demo game or Continue scoring from Your games, then tap "Tap to score by voice" in the Scorer Bar, say the play, and tap again.

## Driving it with Maestro

Preconditions:

- Start the run with the stub on, for every verify.sh command: `EXPO_PUBLIC_VOICE_STUB="strike swinging|strike|ball" EXPO_PUBLIC_VOICE_STUB_READ_MS=2500 verify.sh launch`. A simulator can't speak, so the stub replaces the mic, voice-session and OpenAI's socket. Each finished press hears the next phrase. The press controller, decide() and the engine run for real. `EXPO_PUBLIC_VOICE_STUB_READ_MS` (default 150) is how long the stub takes to answer after the second tap, so "Reading your play…" stays up long enough to see and film.
- `verify.sh doctor` reports every line ok.
- The saved demo game has fewer than two strikes, so both strikes are plain pitches. The flow undoes all three plays at the end.

- **Tap, read, save, Not sure and drop.** Run `verify.sh drive voice-scoring.yaml`. Press 1 shows Listening with live words (screenshot `voice-listening`), the second tap shows the reading line (screenshot `voice-reading`), then "Saved" (screenshot `voice-saved`) and the button back (screenshot `voice-button-back`). Press 2 hears "strike", shows Not sure with Strike looking and Strike swinging (screenshot `voice-not-sure`), and saves Strike looking on the tap. Press 3 opens the mic and a tap on Ball drops it: only the Ball saves (screenshot `voice-dropped`). It then undoes the three plays.
- **Spinner and "Saved" in motion.** Record the simulator during the drive (`xcrun simctl io <udid> recordVideo`). The spinner turning, the check and the button growing back only show in the video.
- **Warm mic.** Start the run with `EXPO_PUBLIC_VOICE_STUB="strike swinging" EXPO_PUBLIC_VOICE_STUB_MIC=granted`, then run `verify.sh drive voice-warm-mic.yaml`. The bar's accessibility label reads "Mic ready. Tap to score by voice" on opening the scoring screen (screenshot `mic-ready`), still reads it after a press saves, and drops it on the Plays tab.
- **First open.** Start with `EXPO_PUBLIC_VOICE_STUB_MIC=undetermined` and run `voice-warm-mic-first-open.yaml`: the line shows (screenshot `mic-first-open-line`), then the bar's label reads "Mic ready" and the line goes.
- **Refused mic.** Start with `EXPO_PUBLIC_VOICE_STUB_MIC=denied` and run `voice-warm-mic-refused.yaml`: the bar says to turn the mic on in Settings (screenshot `mic-refused`), a press says why it can't listen, and tapping Ball still saves.
- **Figma pairs.** The Listening and `voice-not-sure` screens pair with frames `87:3663` and `87:4112`, in the ticket's `proof-<number>` release. Figma has no frame for Reading or Saved, and its Listening frame still says "release when done"; the design was chosen in chat (C1) and is in the PR.
- **The whole press (#103).** Relaunch with `EXPO_PUBLIC_VOICE_STUB="double, everybody scores|Moss doubles|double, the runner scores"` and run `verify.sh drive acceptance-103.yaml`. The stub answers those three phrases the way the AI would, from the game the phone sends.

## Gotchas

- Without `EXPO_PUBLIC_VOICE_STUB`, and with no Supabase settings, every press says "Voice is unavailable right now. Tap to score." That's the fallback working, not a failure of the flow.
- The stub counts finished presses, so a second drive in the same launch starts on a later phrase. Relaunch before driving it again.
- `EXPO_PUBLIC_VOICE_STUB_MIC` (`granted`, `undetermined`, `denied` or `busy`) turns the warm mic on over the stub's silent mic. Without it the stub mic only runs during a press, so the bar keeps reading "Tap to score by voice" and the other flows here are unchanged. The warm mic runs on iOS only, so Android keeps starting the mic on touch-down (ADR 0005). The stub says yes or no for the mic itself, so no iOS permission prompt shows in these runs: whether iOS's own prompt, the orange dot and the mic stopping on lock or app switch behave is the iPhone check.
- The stub never runs in a release build. It's for the Mac check only.
