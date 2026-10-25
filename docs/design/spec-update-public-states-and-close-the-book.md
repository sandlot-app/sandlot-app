## Public game states, Close the book, and the time-limit warning (added 2026-10-25)

Three design jobs the specs needed before their tickets: public versions of the game-state screens (#42), Close the book (#41), and where the time-limit warning sits (#40).

### Public game states
Figma: Viewer page, section "Public link · Game states". These are the screens a public viewer sees, made from the signed-in versions with the wording the Public link screens already use.

| Screen | Node |
|---|---|
| Public — Before first pitch | `176:11254` |
| Public — Rain delay | `176:11572` |
| Public — Final · Summary | `176:11870` |
| Public — Final · Summary · Called in the 5th | `176:12046` |
| Public — Suspended (Rays at Cubs) | `176:12221` |

Rules applied, so the web page follows them everywhere:

- **Field chips** show the position (P, C, 1B…) under the jersey number, never a name.
- **Players in text become numbers:**
  - "#8 singles to center. #5 to 3rd."
  - "On deck: #14"
  - the batting order and decisions ("W · Hawks #3", "L · Marlins #11")
  - the at-bat card reads "Marlins batter" and "Hawks pitcher".
- **Hidden:**
  - the recap teaser, because it needs accounts
  - the "Followed player" card, because public viewers can't follow
  - the Video tab, the open question in #42
- **No orange follow markers** anywhere.
- **The "Names are hidden" banner** sits under the tabs, as on the public Field screen, with no Join button until accounts exist.

M. Brandt, the Marlins' starter, had no jersey number on any screen. He's **#21** from now on.

### Close the book
Figma: Viewer page, section "Scorer · Close the book".

1. **Check the book** `178:12143`:
   - The game is Final. The scoreboard reads "Final · 6 innings" without the live dot, and the field has no runners or batter.
   - A bottom panel says "Fix any play that's wrong, then close the book. After that, this game can't be changed."
   - Its buttons are **Close the book** and **Fix a play**.
2. **Confirm** `178:12598`, a sheet titled "Close the book" with Cancel:
   - "Check the summary. Closing can't be undone."
   - A label and value card: Final "Hawks 3, Marlins 2", Plays recorded 84, Plays fixed 2, Uploaded "All 84 plays".
   - A note: "The box score and stats become official, and plays can't be fixed after this. Close the book only once every play has uploaded."
   - The button is **Close the book**.
3. **Book closed** `178:12453`:
   - The panel reads "Closed Sat, Oct 24 · 9:14 PM. The box score and stats are official."
   - Its one button is **View box score**. Fix a play is gone.

Rules:

- **Closing is a game-control event after Final.** A game with a closed book rejects fixes with a reason the scorer can read (glossary: Closed book).
- **Close the book stays disabled while any play is waiting to upload**, because closing makes the box score official.

### Time-limit warning
Chosen from three placements on the Archive page ("Exploration — Time limit heads-up"):

- **Placement:** option C, at the **top of the scrolling page**, under the tabs. It pushes the field down instead of floating over it, so it no longer covers the catcher.
- **Style:** pale yellow, `surface/warning` with a 1px `border/warning` outline. It's deliberately paler than the yellow of occupied bases and strikes, so the two don't blur.
- **Applies to:** Heads-up `139:9505` and Tied at the limit `165:11758`.

New tokens, also in `packages/tokens/figma-variables.json`:

| Token | Value |
|---|---|
| `yellow/100` (Primitives) | `#FDF1CC` |
| `surface/warning` (Color) | `yellow/100` |
| `border/warning` (Color) | `yellow/400` |
