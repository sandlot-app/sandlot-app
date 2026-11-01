## Milestone 4 screens (added 2026-10-25)

What the scorer app shows in milestone 4, the tap scoring app ([#25](https://github.com/sandlot-app/sandlot-app/issues/25)). Figma: Viewer page, section "Scorer · Milestone 4". The rule is that nothing unbuilt is on screen: these frames are the other scorer screens minus what milestone 4 doesn't build.

### Scorer Bar without voice
- The Scorer Bar component has a third property, **Voice** (On / Off), next to Mode and Sync.
- Voice=Off replaces the "Hold to score by voice" bar with a wide **Undo · \<last play\>** pill beside the round More button, so the row stays full.
- Milestone 4 uses Voice=Off everywhere. Voice (milestone 5) switches it on.
- **Scorer — Field tab (milestone 4)** `165:11107`: the Field tab with the Voice=Off bar.

### More (milestone 4) `165:11367`
- **Runners:** Steal attempt, Wild pitch, Passed ball, Pickoff.
- **Lineup:** Pitching change.
- **Hidden:**
  - Substitution and the whole Game group (Delay, Fix a play). Each comes back with its own spec.
  - Balk, which shows only for leagues that call balks. The engine reports turning balks on as not implemented, and Mustang doesn't call them.

### Game setup `167:11241`
Reached from the Game list when the scorer starts a game.
- **Game:** a label and value card with Away, Home, When, Field and Division.
- **Season half:** a two-part control, First half and Second half. It's pre-filled from the date the league switches, with the note "Second half since Oct 1, so pitchers can get 9 outs a day. Change it if your league switched on another date."
- **Lineups:** one row per team, with its player count and starting pitcher, or "Not set yet". Each row opens that team's lineup.
- **Button:** "Set both lineups to start" stays disabled until both lineups are set, then reads "Start game".

### Lineup · Hawks `168:11244`
- **Batting order:** a card with one row per player: order, jersey number, name, a position pill and a drag handle.
  - Everyone present bats (Mustang). A tenth batter without a fielding position shows "Bats only".
  - Tapping a position changes it, and dragging reorders the batting order.
- **Starting pitcher:** the selected pitcher as a Bench Player Row ("Fully rested · 75 pitches available today"), with "Change starting pitcher" below.
- **Add a player from the roster:** adds a player to this game's lineup from the existing roster. Roster editing itself is out of scope (#25).
- **Position list** `262:14318`: tapping a position pill opens a sheet with every position (P, C, 1B, 2B, 3B, SS, LF, CF, RF) and "Bats only", the batter's own marked with a check. A position another player holds says "Swaps with <name>". A separate card under it, **Not playing today** ("Takes <name> out of today's lineup"), takes the batter out of this game's lineup.
- **Add a player** `262:14532`: the sheet behind "Add a player from the roster" lists the roster players not in the lineup (a player taken out with Not playing today comes back here), tapped to add, last in the order and with no position. With nobody to add it reads "Everyone on the roster is already in the lineup."
- **Empty states** (no frame; copy only): an emptied batting order reads "Nobody is in the batting order yet.", and the starting pitcher sheet with nobody in the lineup reads "Add a player to the lineup first."
- **Save lineup** returns to Game setup.

### Sample lineup
Hawks, second half: K. Moss CF, J. Ruiz SS, S. Bell 2B, D. Park 1B, R. Hale LF, A. Kindle 3B, T. Nguyen P, M. Ortiz C, E. Brooks RF, B. Lane (bats only). T. Nguyen starts and A. Kindle relieves in the 4th, which matches the live screens.
