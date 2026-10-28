# Sandlot

Sandlot is an app for scoring and following youth baseball and softball games. These terms are how the team talks about it in designs, plans and code.

## Scoring

How a parent keeps the book for one game, and how the game is rebuilt from what they recorded.

**Scorer**:
The one person whose phone records a game's plays. Only the scorer writes to the game.
_Avoid_: Scorekeeper (except when quoting league rules), statistician

**Official scorer**:
The scorer whose record counts when more than one is kept. Under Mustang rules, this is the home team's scorer.
_Avoid_: Main scorer, primary scorer

**Official scorebook**:
The official scorer's record of a game. Everything written about the game comes from it.
_Avoid_: Hawks scorebook, team scorebook

**Play**:
Everything one scorer action records: one tap action or one voice press. Undo reverses a whole play, and the sync badge counts plays.
_Avoid_: Group (in conversation), action, entry

**Event**:
One recorded command inside a play, stored in order in the game's log and never changed.
_Avoid_: Record, row

**Undo**:
A play that reverses the latest play not already undone. An undo can't itself be undone.
_Avoid_: Delete, remove, scratch

**Fix**:
The scorer's replacement of an earlier play with what really happened. It is recorded as a new play; the earlier play's events are never changed.
_Avoid_: Edit, correction (except in code), redo

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

**Delay**:
A stop in play, with a reason and a start time, during which the game state is frozen.
_Avoid_: Pause, timeout, rain-out

**Final**:
A game that counts. It is final when it is played to its full length, called after reaching its complete-game length, or ended by its time limit.
_Avoid_: Over, finished, complete (except "complete-game length")

**Called game**:
A game ended early by the umpire that counts as final, because it reached its division's complete-game length.
_Avoid_: Rain-out, forfeit, shortened game

**Suspended game**:
A game stopped before it could count, to be finished another day from exactly where it stopped. It is the default for a game stopped too early, unless the league replays such games from the start.
_Avoid_: Postponed game, paused game

**Closed book**:
A Final game whose scorer has closed the book, which makes its box score and stats official. Its plays can no longer be fixed. The book can be closed only once every play has uploaded.
_Avoid_: Locked game, finalized game, archived game

**Season half**:
The part of a division's season whose rules a game uses. In Mustang, the second half allows 9 outs a day per pitcher instead of 6, and leadoffs and full stealing if the coaches agreed before the season. A game takes it from its setup, pre-filled from the date the league switches.
_Avoid_: Season phase, split, second season

**Time limit**:
A division's rule that no new inning starts once a set time has passed since the game's start. The moment of an inning's last out decides, and delays count toward it unless the league says otherwise.
_Avoid_: Curfew, game clock, drop-dead time

## Teams and families

**Team member**:
Anyone who has joined a team through its invite link, whether or not they have claimed a child.
_Avoid_: Fan, follower, team family

**Public game**:
A game its team admin has opened to anyone with its public link. Every game starts private. A public game shows its score, plays and field, never video of children.
_Avoid_: Shared game, open game

**Public viewer**:
Someone watching a game through its public link without being a team member. They see jersey numbers and positions, never children's names.
_Avoid_: Guest, anonymous user, fan

**Team admin**:
The team member who set the team up in Sandlot and manages it.
_Avoid_: Coach (Sandlot has no coach role), owner, manager

**Follow**:
A team member's choice to track a player on either team in their games. It marks that player in orange everywhere they appear, and grants nothing beyond what team members can already see.
_Avoid_: Favorite, subscribe, watch

**Claim**:
A registered family's verified link to their own child. Anything that leaves the app with a child's stats on it requires a claim.
_Avoid_: Follow (a claim is not a follow), own, adopt

**Registered family**:
An adult account that has claimed at least one child.
_Avoid_: Parent account, user

**Stat card**:
A shareable image of one child's line from one game, for that child's claiming family only.
_Avoid_: Player card (that's the in-app profile screen), stat image

**Stat sticker**:
A see-through image of one child's game, in one ink, that the claiming family lays on their own photo or video. It never shows the score or the result.
_Avoid_: Overlay, badge

## Recap

**Recap story**:
A newspaper-style story about one Final game, written automatically from the official scorebook as soon as the game ends. Read only by team members of the two teams.
_Avoid_: Recap, summary, game story, article

**Team version**:
One of a Recap story's two tellings, one from each team's side, built from the same facts.
_Avoid_: Perspective, side, slant

**Recap teaser**:
The headline and first sentence of a Recap story, shown at the top of a Final game's Summary.
_Avoid_: Short recap, preview

**Play link**:
A reference from a sentence in a Recap story to the recorded play it describes.
_Avoid_: Play chip, receipt, citation

**Hidden story**:
A Recap story that the official scorer or either team admin has withdrawn for one game. It is not shown to anyone.
_Avoid_: Deleted story, unpublished story

**Unnamed child**:
A child whose claiming family has chosen not to have them named in Recap stories or share images. Other readers see them by team and position ("the Hawks' shortstop"); their own family and the in-app game screens still use their name.
_Avoid_: Anonymous player, hidden player

**Share image**:
The image of a Recap story's cover that a team member sends outside the app. It names a child only when the person sharing has claimed that child.
_Avoid_: Story card, recap card
