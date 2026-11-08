## Game states (added 2026-10-24)

Figma: Viewer page, section "Game states" `111:5333`, after "Video tab". Scorer and Player card moved down.

### Decisions (asked and answered)
- **Before first pitch:** lineups on the field. Changed from the original option: instead of always showing the home team, a Team Toggle above the field opens on the followed player's team, the same rule the Box score uses.
- **Rain delay:** freeze and dim. The scoreboard keeps the frozen score and count with the Delayed badge, and the field uses its Dimmed variant with the reason and start time.
- **Final:** a Summary with the followed player, linescore, key plays and W/L pitchers, plus a very short recap version.

### Story (keeps every screen consistent with the sample game; Mustang rules)
The beta division is Mustang (ages 9–10): 6 innings, at most 9 outs a day per pitcher in the second half (6 in the first), Pitch Smart's 75-pitch daily limit, and no re-entry for a removed pitcher.
- Hawks 1 in the 1st, 1 in the 3rd (T. Nguyen single scores J. Ruiz), Marlins 1 in the 4th. Bottom 5: L. Darcy's sac fly scores N. Cole, 2–2. Top 6: J. Ruiz doubles to left-center and K. Moss scores, 3–2. Final **Hawks 3, Marlins 2** (6 innings).
- Linescore: HAW 1 0 1 0 0 1 · 3 R 7 H 0 E. MAR 0 0 0 1 1 0 · 2 R 6 H 1 E. The Linescore component hides inning 7 by default.
- Hawks pitching: T. Nguyen starts, 3.0 IP, 38/75, 0 H, 0 R. A. Kindle relieves in the 4th. At Bottom 5 with 1 out he has 1.1 IP, 24/75, 4 H, 1 R, and 5 outs left today. He finishes 3.0 IP, 45/75, 5 H, 2 R, 0 BB, 3 K and gets the win.
- Marlins pitching: M. Brandt starts, 3.0 IP, 4 K. P. Shah relieves for the last three, 52/75, and takes the loss. (B. Ortega was renamed M. Brandt to avoid a clash with the Hawks bench player J. Ortega.)
- J. Ruiz: 3 for 4, a double, 2 RBI, 1 R.
- The Pitching change screen now shows the no-re-entry rule: T. Nguyen is dimmed, "Pitched innings 1–3 · can't pitch again today." R. Hale "Needs rest until Tue · threw 68 on Thu" follows Pitch Smart's 4-day rest at 66+ pitches.

### Public link (signed out), section "Public link (signed out)"
- Field `119:6197`, Plays `119:6489`, Box score `119:6739`.
- Children appear as jersey numbers (#6, #3); field chips show their position; no followed markers; no back button.
- A banner reads: "Public link · Names are hidden. Have the team's invite? Join to see names and follow players."
- Following requires being a team member. Team members can follow players on either team in their games. The Game list is for team members only; a public link opens straight to its game.

### Screens
- **Before first pitch (full length)** `111:5334`. Scoreboard: Batting=Away (the Hawks bat first), 0–0, "6:30 PM" in place of the inning, empty bases, no count footer. Then Tabs (Field), Team Toggle (Hawks), the Field with the Hawks in position and J. Ruiz marked as followed (orange ring), no runners or batter. Then a "Hawks batting order" card (Batting Rows with the stat columns hidden) and the caption "Lineups can change until first pitch."
- **Rain delay (phone)** `111:5895`: the live Field screen with the Delayed status badge and Field Dimmed=On, "Rain delay · since 7:42 PM". The count, runners and matchup stay frozen.
- **Final · Summary (full length)** `112:5906`. Scoreboard: "Final", no bases, no bat or glove badges, no footer. The first tab reads **Summary** (replaces Field once the game is final). Cards, in order:
  1. Followed player: orange dot, J. Ruiz, #6 · SS · Hawks, and Stat Tiles for H-AB, RBI, R and 2B, with a one-line note.
  2. Linescore with no current-inning highlight.
  3. Key plays: three Recent Play rows (Run scored), newest first.
  4. Decisions: Pitching Rows for W and L, without the pitching-now dot.
  5. Caption.
- **Final · Short recap (phone)** `112:6324`: a single Recap card with three rows (J. RUIZ · SS, DECISIONS, KEY PLAY) and a "See full summary" link in action/primary.
- **Video tab (ended)** `112:6487`, in the Video tab section: the Final scoreboard, Tabs set to Video, and Stream Card Ended with 3–2. This closes the item deferred from the Video tab task.

### Rules
- Pregame and Final use overrides on the existing Scoreboard instance (hidden footer and badges, replaced inning text). There is no Pregame/Final Scoreboard variant yet. Adding a "Game state" axis would push the Scoreboard past 30 variants, so it needs a decision (see below).
- After Final, the Field tab becomes Summary. Plays, Box score and Video stay.
- Link-style actions use action/primary (blue). Orange is reserved for "followed". (Superseded: the Field Day direction makes action/primary orange. See `docs/design/reimagined/direction/README.md`.)

### Open questions
- Should the Scoreboard get real Pregame and Final states, perhaps as a separate "Scoreboard / Final" component, instead of instance overrides? That's a library change, so it waits for your OK.
- The existing Field tab screens show J. Ruiz with Followed=Off at shortstop, while the Box score marks him as followed. Pregame now shows the orange ring. Should the live Field screens match?
- Is the short recap a separate screen, the top of Summary, or the content of a Final push notification?
