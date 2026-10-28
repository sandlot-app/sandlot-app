# The mic stays warm on the scoring screen

While the scoring screen is open and in the foreground, the phone's microphone keeps running and holds only the last second of audio in memory. When a press starts, that second becomes its first audio. Otherwise it is thrown away, never saved, logged or sent. We chose this because starting the mic on touch-down lost the first ~0.3 s of every press and all of a quick tap (measured on an iPhone on 2026-10-28), and a lost first word is usually the player's name.

## Considered Options

- **Start the mic on touch-down and show a "ready" cue.** It makes the scorer wait, and fast talkers still lose their first word.
- **Hands-free, with the mic streaming for a whole half-inning.** A crowd sets it off, it is billed for every open minute, and it sends other people's children's voices off the phone.

## Consequences

- The phone shows its mic indicator the whole time the scoring screen is open: the orange dot on iOS, the green one on recent Android versions. The app asks for the mic when that screen first opens, with a line saying what it listens to. It does not wait for the first press.
- If the scorer refuses the mic, the voice bar says to turn it on in Settings, and tap scoring works as always. If another app holds the mic, during a phone call for example, the bar points to tap scoring and the app tries the mic again on the next press. No failure stops scoring.
- The mic runs only while the app is in the foreground, on iOS and Android alike, and never as a background service. It stops when the scorer leaves the screen, locks the phone or switches apps.
- Android's indicator and permission flow haven't been checked on a real device yet. That check comes before the warm mic ships on Android.
- Any change to voice capture must keep the rule that audio leaves the phone only after a press starts.
