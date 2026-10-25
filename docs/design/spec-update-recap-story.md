## Recap story (added 2026-10-24, revised after grilling)

A newspaper-style story, written automatically from the **official scorebook** as soon as a game is Final. Only **team members** of the two teams can read it. Terms are defined in `GLOSSARY.md`. The visibility decision is recorded in `docs/adr/0001-recap-stories-stay-inside-the-teams.md`.

### Rules
**Who reads it**
- Team members of the two teams that played: anyone who joined through a team's invite link, claimed child or not.
- Public viewers (public link, not a team member) see the score and linescore, but no Recap teaser and no story.

**When it's written**
- When the game is Final under its division's rules. Mustang: 6 innings, or called after 4 (3½ if the home team leads), or a tie after one extra inning.
- The official scorebook must also have both lineups and every half-inning recorded.
- A called game says so in the story. A game that doesn't qualify shows no teaser and no explanation to families.

**Whose book it uses**
- Only the official scorer's (the home team's under Mustang rules). Both team versions come from it.
- Byline: "Written from the official scorebook."

**Publishing**
- The story publishes immediately; there's no review step.
- When the scorer fixes a play, the story rewrites itself, and the byline adds "Updated 10:14 PM".

**Hiding**
- The official scorer or either team's **Team admin** can hide a story and unhide it later.
- A hidden story and its teaser disappear for families; the scorer and team admins see a "Recap story · Hidden" card with Unhide.

**Which team version opens**
- The team of your claimed child, else the team of a followed player, else the team whose invite you joined, else the home team.

**Naming**
- No child is named for an error, strikeout, wild pitch or the losing play.
- The losing pitcher is credited, never blamed.
- A claiming family can turn off naming their child. Everyone else then reads "the Hawks' shortstop"; the family's own copy still uses the name. In-app game screens keep names for team members.

**Share image**
- It names a child, and shows their line, only if the person sharing has claimed that child (and naming is on).
- Everyone else shares the team-level image: "Hawks edge Marlins, 3–2" and "Final · 6 innings".

**Division stats**
- The story mentions only stats the division tracks. In Pinto (coaches pitch) there's no pitchers paragraph, and no walks or pitch counts.

**Notifications**
- Push notifications aren't in the beta. A Final notification with the teaser headline is post-beta work.

### Screens (Viewer, section "Recap story")
- **Recap story · Hawks side** `115:6141`: byline shows "Updated 10:14 PM".
- **Recap story · Marlins side** `115:6289`: C. Vance is the example unnamed child ("The Marlins' center fielder singled him to third").
- **Recap story · Official scorer view** `120:6943`: a "You're the official scorer" bar with **Hide story** in text/danger.
- **Final · Summary · Story hidden (scorer view)** `120:7038`: a dashed "Recap story · Hidden" card with **Unhide story**.
- **Share image · claimed child** `115:6430` (J. Ruiz's family) and **Share image · team-level** `120:6925` (everyone else).
- **Final · Summary** `112:5906`: Recap Teaser on top. The Key plays card is removed, since the story links those plays.

### Components (Components page, section "Recap")
- **Play Link** `114:6483`: Description, Meta, Score (away–home).
- **Recap Teaser** `114:6495`: Headline, Lead.

### Writing rules
- Order: the deciding play, then the star of that team (the followed player first), then the other team's push, then the pitchers (winner first, everyone else credited only), then what's next.
- Every sentence must map to recorded plays. If data is missing, leave the sentence out.
