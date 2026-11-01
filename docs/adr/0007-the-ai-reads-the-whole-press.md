# The AI reads the whole press

Status: accepted by Christian on 2026-10-28 and 2026-10-31. Replaces [ADR 0006](0006-a-press-saves-its-clear-calls-and-asks-about-the-rest.md).

Every press except a pitch call or a lone undo goes to the AI, which sees the whole game and answers with the whole play's result: what the batter did and where every runner finished, by role and base. The phone turns that answer into commands, the engine decides whether they're legal, and a legal play saves with a banner naming each runner's result. We chose this because phrase patterns can't keep up with how parents talk. On 65 made-up parent sentences on 2026-10-28, today's reader got 23 right and held back 36, and this one got 64 right and held back none. Those sentences were typed, so real speech still has to pass [the plan's test](../plan.md#voice-scoring) before this replaces today's reader.

## Considered Options

- **Add more phrase patterns, and give the AI labeled roles (#83, #87, #98).** It keeps the first reader in charge, and each new way of saying something needs a new rule. Sentences about moving runners scored 0 of 12.
- **Save the clear calls and ask about the rest (ADR 0006).** It only helps a reader that works call by call. The AI reads the press as one thing, and two undos for one sentence was a cost we no longer need to pay.

## Consequences

- **The phone's reader shrinks.** It handles only presses made up entirely of pitch calls, and "undo" or "scratch that" on its own. Those stay instant and use no AI call. Anything else goes to the AI.
- **The AI never decides.** Rule 6 holds: the answer is a proposal, and its schema allows only roles, bases and fixed outcomes. The banner comes from the commands the engine accepted, never from the model's words, so the parent sees what was actually recorded. The answer's free-text notes are never shown or logged.
- **Cards are rare.** A card appears only when two readings are both believable and nothing said picks one, when the same Play arrives twice within 3 s, or when "confirm everything" is on. Complex plays, assumed runners and read-back mismatches no longer force one.
- **A wrong save is possible.** The bar on real speech is at least 95% right and at most 2% wrong, with every wrong save shown on the banner. The one miss on 2026-10-28 was a judgment call, a hard grounder saved as an error.
- **A fix saves right away.** "No, that was a double" records a Fix with the banner and Undo, with no preview. Undo brings back the original play. This needs the engine to apply `correct`, which it doesn't yet, so it starts with a failing fixture (rule 3). An undo plus a new play was rejected, because a second Undo would leave no play at all.
- **A question must carry its readings.** A card needs two full readings for its buttons, each checked by the engine. The prototype's answer only returned a note, so the real schema adds them.
- **A name in the wrong role must not save.** Answering by role loses which name was said, so "Moss doubles" with Ruiz due up could save as Ruiz. The answer has to report the mismatch so the phone can say who holds that role. The prototype didn't test this.
- **More goes to OpenAI.** The AI gets the game state, display names and jersey numbers labeled by role, and the last play in words, which also carries display names. Rule 5 is unchanged: names stay out of events, stats, logs and analytics. Zero data retention has to be in place before any real children's game ([#77](https://github.com/sandlot-app/sandlot-app/issues/77), item 3), and the contract's Voice section changes with Christian's review and Kevin's sign-off.
- **Nearly every press costs an AI call**, which makes #77's first item, anyone being able to spend the OpenAI account, more urgent. It has to be fixed before any real children's game. Voice still needs signal, as it does today.
- **The mic ends on a second tap or at 30 s, never on a pause.** Without phrase patterns the phone can't tell that a play is complete, and a pause timer would cut off a scorer who stops to think or to watch the play. So a press ends only when the scorer taps again, or when the 30 s safety limit closes a forgotten mic. Christian chose this on 2026-10-31 in #88, which withdraws the earlier plan of one pause length. Live words still show while the scorer talks, but the greyed calls don't, since nothing reads them until the press ends. While the play is read the bar shows a spinner, then "Saved", then the button comes back.
