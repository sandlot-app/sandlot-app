---
status: proposed
---

# Video of children never goes on the public link

A public game shows its score, plays and field to anyone with the link, but its video and clips are only for team members. The one exception is a game whose footage needs no consent, such as the adult demo game. We considered letting a team admin turn video on for a public game, and showing it only when every player on the field has media consent. We rejected both. The other team's children are in every frame, their families can't consent through Sandlot, and once a stream of a 9-year-old has been watched and saved it can't be taken back. This follows [ADR 0002](0002-recap-stories-stay-inside-the-teams.md), which keeps Recap stories off the public link for the same reason. GameChanger also streams only to a team's followers.

## Consequences

- A game gains a setting that says its footage needs no consent. Only the service role can set it, and only the demo game has it. Kevin names it.
- Until playback is signed, a recording is allowed only on a game with that setting, not on any public game as the recordings table allows today.
- Team members can't watch any video until signed playback ships, because a private game can't have a recording before then. Signed playback is planned for the Moraga beta (milestone 12). Kevin's estimate of its cost and effort can move that date but not the goal.
- The public link never shows a Video tab for a game without that setting, even after signed playback ships.
- Every game starts private. Only the scoring team's admin can make it public, and either team's admin can make it private again at any time. The link stops showing the game as soon as it does.
