# A press saves its clear calls and asks only about the rest

Status: replaced by [ADR 0007](0007-the-ai-reads-the-whole-press.md) on 2026-10-31, and never shipped.

When a press holds several calls and one isn't clear, the clear, legal calls before it save at once as the press's Play, with the banner and undo. Only the rest goes on one "Not sure" card. This replaces rule B6 of September's voice edge-case spec, which isn't in the repo: when any call in a press couldn't be recorded, nothing saved, and a button offered to save the calls before it. Natural speech puts many calls in one press, so all-or-nothing made one fumbled word cost the whole press. The plan's rule that no wrong play saves without a confirm still holds, because only clear, legal calls save on their own.

## Considered Options

- **All or nothing (B6).** It is simple, but the scorer has to stop and tap the button, or say everything again.
- **Hold the whole press until the card is answered.** It blocks scoring, and the clear calls are lost if the scorer moves on without answering.

## Consequences

- Answering the card is a tap, so it records its own Play. Undo after it removes only the answer, so one spoken sentence can take two undos. The plan's data model and "Voice scoring" sections point here.
- Only calls before the first unclear one can save, because each call is checked against the game after the calls before it.
- If the clear calls need a card anyway (a complex play, for example), the whole press goes on one card. The scorer never sees two cards at once.
- The card never blocks. The next press or tap drops it, along with the calls it held.
