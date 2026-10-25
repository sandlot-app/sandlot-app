## Fix a play and Delay (added 2026-10-24)

Both flows start from the scorer's More menu. Figma: Viewer page, Scorer section, rows 4–6, below the existing scorer screens. Player card moved down.

### Decisions (asked and answered)
- **Picking a play:** More → Fix a play opens this game's plays, newest first, grouped by half-inning. In scorer mode, long-pressing a play in Plays or Recent plays also offers "Fix this play".
- **Editing:** the scorer reopens the same step sheets they scored with (What happened → Fielder → Runners, or the pitch result), prefilled, under a "Fixing · Bottom 5 · N. Cole doubles to left field" banner. "Remove this play" sits at the bottom of the first step.
- **Before saving:** a Review the fix sheet shows was/now, then every change (score, outs, runners, player and team lines), and flags later plays that no longer fit.
- **Delay:** the scorer picks a reason, then a timer runs. From there: Resume play, or End for today → Called game or Suspended.

### Fix a play screens
1. **0 From Plays (long-press)** `132:7245`: N. Cole's play lifted above a dimmed Plays tab, with a "Fix this play · Edit or remove it" menu.
2. **1 Pick a play** `132:7527`: Bottom 5 plays (including the at-bat in progress) as At Bat rows, then earlier half-innings.
3. **2 What really happened** `133:7766`: the In play outcome step, with Error selected and context "scored as a double".
4. **3 Who made the error** `133:8040`: the fielder step with R. Hale (LF) selected. Runners and batter are hidden, because they belong to now, not to the moment of the play.
5. **4 Review** `134:8268`. Was "N. Cole doubles to left field." Now "N. Cole reaches on an error by R. Hale (LF)." Changes:
   - Score: no change (2–1). Outs and runners: no change.
   - N. Cole: 1 for 2 → 0 for 2.
   - A. Kindle: 4 H → 3 H. Marlins: 4 H → 3 H. Hawks: 0 E → 1 E.
   - The note says the box score, stats and recap story update, and that kids are never named for errors in the story.
   - Button: Save fix.
6. **5 Review · later plays need a look** `134:8573`: P. Shah's fly out becomes a single.
   - Bottom 5 outs go 1 → 0, Shah is on 1st, Shah's line goes 0 for 1 → 1 for 1, and Kindle's goes 1.1 → 1.0 IP.
   - "2 later plays need a look": Cole's double ("Where did P. Shah end up?") and Vance's single ("Check every runner"), each with Check.
   - Button: Save and check 2 plays.
7. **6 Saved** `134:8886`: back on Field with a "Play fixed · box score updated · Undo" toast. The status line reads "Last: Fixed N. Cole's play · All pitches saved".

The example fix keeps the sample game's current situation unchanged.

### Delay screens
1. **1 Reason** `135:8836`:
   - Rain is selected among Lightning, Darkness, Field conditions, Injury and Other.
   - Shows "Started 7:42 PM · now" with Change.
   - Note: "Families see 'Rain delay · since 7:42 PM' on the field."
   - Button: Start delay.
2. **2 Delayed** `135:9130`:
   - The field is dimmed with the reason, and the count and runners are frozen.
   - The Scorer Bar is replaced by a Delay panel: "Rain delay", a running timer (18:42), and "Since 7:42 PM · 2-hour limit: no new inning after 8:30 PM".
   - Actions: Resume play, End for today.
3. **3 Lightning countdown** `135:9503`:
   - A 24:18 countdown with "30-minute rule · resume at 8:12 PM at the earliest".
   - Resume stays disabled until then. "Saw lightning again · restart 30:00" resets the countdown.
4. **4 End for today** `135:9844`. "Record what the umpire decided." Two choices:
   - **Called game** (selected): counts as final; Mustang counts a game as complete after 4 innings, or 3½ if the home team leads. Final: Hawks 2, Marlins 1.
   - **Suspended:** finish another day, picking up in Bottom 5 with 1 out, a 1–0 count and runners on 1st and 3rd.
   - Button: Call game · Hawks win 2–1.

### Rules
- A fix never edits history. It records a new correct event that replaces the old play's group, as the engine design already says. Undo after a fix reverses the fix.
- Called game appears only once the division's complete-game length is met. Before that, End for today offers only Suspended, with a line explaining why.
- The lightning wait is a rule setting (default 30 minutes), not hard-coded.

### Open questions
Answered on 2026-10-25. See [spec-update-time-limit-called-suspended.md](spec-update-time-limit-called-suspended.md): delays count toward the limit (a league setting can change that), family views for called and suspended games are designed, and sheet actions are now blue.

- Does a delay stop Mustang's 2-hour clock ("no new inning after 2 hours from the umpire's start time")? The screen shows the limit time but doesn't decide this. It should become a rule setting once the league answers.
- What families see for a Suspended game and for a Called game (badge, Summary line "Called after 5 innings", recap story wording) is not designed yet.
- The More and Fix sheets use the existing orange `accent` for Cancel and Done. Under the color rules (blue = action, orange = followed), should sheet header actions move to blue? This is a global change, so it's waiting on you.
