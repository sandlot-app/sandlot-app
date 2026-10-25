## Time limit, called and suspended games (added 2026-10-25)

Follows "Fix a play and Delay". It answers that note's three open questions and adds the screens they needed. Figma: Viewer page, Scorer section (time limit and resume rows) and Game states section (family views). Glossary terms: Final, Called game, Suspended game, Time limit.

### Decisions (asked and answered)
1. **Delays and the 2-hour limit:** delays count, following Mustang D.16 as written ("two hours from the start of the game"). "Delays pause the time limit" is a league rule setting, off for Moraga.
2. **Time limit:** the Scorer Bar shows a heads-up about 15 minutes before the limit. When an inning's last out comes after the limit, the app asks "End as Final?". **Not yet** covers an umpire allowing another inning. Families see "Final · time limit".
3. **Stopped too early:** a game that hasn't reached its complete-game length becomes Suspended and resumes from exactly where it stopped. "Replay from the start" is a league rule setting.
4. **Called game:** the normal Final badge, with the reason everywhere families look: the Game list ("Final · called in 5th"), the scoreboard ("Final · called"), a Summary line, and the recap story's first sentence. Unplayed innings stay blank in the linescore.
5. **Suspended game (families):**
   - The Suspended badge, and a dimmed, frozen field reading "Suspended · resumes Sun 9:00 AM" (or "resume date to be set").
   - In the Game list it stays under Today on that day, then moves to Upcoming.
   - No recap teaser or story until it finishes. The Final-only rule already covers this.
6. **Rescheduling:** the team admin sets the resume date and time in the team schedule, as an entry linked to the suspended game. At the field, the scorer only taps Suspended.
7. **Resuming:** starts with a "Check who's here" step on the frozen situation, where the scorer marks absent players or adds a late arrival (Mustang: "everyone present bats; a late arrival joins at the end").
8. **Pitching on the resume day:** daily limits (Pitch Smart counts, outs per day) start fresh for that day, and "a removed pitcher can't pitch again that game" still applies.
9. **Colors:** Cancel (sheet headers), See all (Recent plays) and the fielder step's Skip link are blue `action/primary`. Undo (its arrow, its label and the Scorer Bar's round Undo) is neutral `text/primary`. Orange now lives only in `ring/followed` and the `logo/*` tokens. The `accent` variable is deleted, after a check found no remaining uses on any page.

### Scorer screens
1. **Delay panel** (all Delay screens): "Since 7:42 PM · No new inning after 8:30 PM · delays count".
2. **Time limit · 1 Heads-up** `139:9505`: a quiet line above the Scorer Bar reading "Time limit 8:30 PM · this may be the last inning".
3. **Time limit · 2 Reached** `139:9728`:
   - Behind the sheet: the end of Bottom 5, with 3 outs, empty bases and no batter.
   - Sheet: "The last out of Bottom 5 came at 8:34 PM, after the 8:30 PM limit. No new inning can start."
   - Result card, as label and value rows: Result "Final: Hawks 2, Marlins 1", Innings "5", Families see "Final · time limit". See the sheet spacing note.
   - Buttons: **End as Final**, and **Not yet · the umpire allowed another inning**.
4. **Resume · Check who's here** `139:9973`, with Rays at Cubs suspended in the Top 3:
   - "Picks up in Top 3, 2 outs, 0–0 count, runner on 2nd."
   - The Rays lineup has a toggle per player. B. Cho is "Not here · skipped in the order", and there's an "Add a late arrival · joins at the end" link.
   - Cubs row: "all 9 here", with Change.
   - Note: "Pitching limits start fresh today. J. Kim was removed in the 2nd and can't pitch again this game."
   - Button: Resume · Top 3.

The Rays–Cubs game is used for the suspended examples because the sample game (Hawks–Marlins, Bottom 5) reached Mustang's complete-game length, so stopping it would make it a called game, not a suspended one.

### Family screens
1. **Final · Summary · Called in the 5th** `140:10099`:
   - "Final · called" on the scoreboard, and a Summary line reading "Called in the 5th because of rain · counts as final".
   - The recap teaser is "Hawks top Marlins 2–1 in a rain-shortened game". Its first sentence ends "…in a game called in the fifth because of rain."
2. **Suspended (Rays at Cubs)** `140:10274`:
   - The Suspended badge, and the dimmed field reading "Suspended · resumes Sun 9:00 AM".
   - A details card titled "Suspended in the Top 3", with Resumes "Sun, Oct 25 · 9:00 AM · Field 3", Picks up "2 outs · 0–0 count · runner on 2nd", and "The Cubs' team admin set the date. The score and stats so far are saved."
3. **Game list · suspended game (excerpt)** `140:10680`:
   - Today (Sat): "Rays 4–4 Cubs · Suspended · Top 3".
   - Upcoming (from Sun): "Rays 4–4 Cubs · Resumes Sun 9 AM".
4. **Game list · All**: two of the finals now read "Final · called in 5th" and "Final · time limit".

### Library changes
- **Game Row:** a new `State=Suspended` variant shows the score in full contrast, with nobody grayed out. Its team names and followed dots are bound to the same component properties as the other states.
- Sheet Header, Recent Plays, Icon Button and Scorer Bar have the color changes in decision 9.
- **Stress test:** a worst-case Suspended row (long team names, both followed, 14–12), and the time-limit row is relabeled "Final · time limit".

### Rules
- Called game is offered only once the division's complete-game length is met (Mustang D.17: 4 innings, or 3½ if the home team leads). Otherwise End for today offers only Suspended.
- The time-limit check runs on event timestamps, so it needs no live clock. The moment of an inning's last out decides.
- Leagues can change two rule settings: "Delays pause the time limit" (default off) and "Replay suspended games from the start" (default off).

### Upcoming row copy (decided 2026-10-25)
The Upcoming row reads "Resumes Sun 9 AM". The longer "Resumes Sun 9:00 AM · Top 3" doesn't fit the Game Row's center column, which caps status text at 140px so team names keep at least 80px. The inning still shows on the Today row and on the game screen.
