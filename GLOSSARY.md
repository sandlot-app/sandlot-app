# Sandlot scoring

How a parent keeps the book for one youth baseball or softball game, and how the game is rebuilt from what they recorded.

## Language

**Play**:
Everything one scorer action records: one tap action or one voice press. Undo reverses a whole play, and the sync badge counts plays.
_Avoid_: Group (in conversation), action, entry

**Event**:
One recorded command inside a play, stored in order in the game's log and never changed.
_Avoid_: Record, row

**Undo**:
A play that reverses the latest play not already undone. An undo can't itself be undone.
_Avoid_: Delete, remove, scratch

**Roster**:
Every player who may appear in a game, fixed in the game's setup before the first pitch.
_Avoid_: Team list, players

**Lineup**:
A team's batting order for the game, each player taken from the roster and given a position or none.
_Avoid_: Batting card, order

**Alert**:
A warning the engine raises about the game, such as a pitcher nearing the pitch-count limit, without refusing the play.
_Avoid_: Error, violation

**Rejection**:
The engine's refusal to record a play because the league's rules don't allow it, with a reason the scorer can read.
_Avoid_: Error, failure
