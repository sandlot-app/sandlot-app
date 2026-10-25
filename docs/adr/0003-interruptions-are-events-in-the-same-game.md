# Delays and suspensions are events in the same game

A delay (its start, reason and end) and a suspension (suspend, then resume) are recorded as events in the game's own log, and a suspended game is the same game continuing later, not a new game. We chose this because game state is always replayed from events: families see a delay as it happens, the time limit can count the minutes of a delay, and pitching limits tell the resume day from the original day by event timestamps. The alternative, closing a suspended game and starting a linked new one, would split one game's box score and pitch counts across two logs.

## Consequences

- The engine gains game-control events for delays and for suspend and resume. Their exact shapes are sketched with `architect` and approved before any code.
- Until the team schedule exists (milestone 10), a suspended game shows "Suspended · resume date to be set", and the scorer resumes it by reopening the game. Where the schedule stores the resume date is Kevin's decision then.
- Daily pitching limits start fresh on the resume day, and "a removed pitcher can't pitch again that game" still applies, because both read the same log.
