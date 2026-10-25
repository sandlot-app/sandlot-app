## Prototype wiring (added 2026-10-25)

Task 5. The Viewer page has two flows, shown in Figma's Present view: **Viewer · Game list** (starts at `107:5105`) and **Scorer** (starts at `74:2455`). There are 50 links, and each one was read back after wiring to confirm its destination.

### Decisions (asked and answered)
- **Player cards:** only J. Ruiz and A. Kindle have cards, so only their chips open one. The other chips stay unwired, so no one taps a name and sees someone else's card.
- **In play:** wired through all three steps, with Back and Cancel.
- **Start:** the Viewer flow starts on the Game list. The live Hawks–Marlins row opens the game.

### Motion
Every transition uses the strong ease-out curve `cubic-bezier(0.23, 1, 0.32, 1)` and stays under 300ms.
- **Screen push** (Game list ⇄ game), 280ms. The game slides in from the right, and back slides the list in from the left.
- **Smart animate**, 200ms for tabs, the Following/All filter, the Follow toggle and steps inside a sheet. Matching layers (status bar, scoreboard, tabs) stay put while the rest changes.
- **Smart animate**, 250ms for opening and closing a sheet (player card, In play).

### Links
**Game list**
- The live Hawks–Marlins row, on both Following and All, opens the Field tab.
- The filter switches between Following (`107:5105`) and All (`107:5329`).

**Game screen (viewer)**
- Tabs move between Field (`38:375`), Plays (`69:1895`), Box score (`69:2376`) and Video (`101:4996`), from every tab.
- The nav bar's back button on each tab returns to the Game list. It navigates there directly rather than stepping back, so tab switches don't pile up in the back history.
- On the Field tab, the J. Ruiz (SS) chip opens his card (`95:4106`), and the A. Kindle (P) chip opens his pitcher card (`95:4782`).

**Player card**
- Follow switches J. Ruiz's card to its Following state (`95:4444`), and Following switches it back.
- Tapping the scrim or dragging the sheet closes the card and returns to the Field tab.

**Scorer**
- In play opens step 1, What happened (`75:2900`). Any outcome goes to step 2, Who fielded it (`75:3162`).
- In step 2, "Next · K. Moss, center field" goes to step 3, Where did runners end up (`75:3487`). In step 3, Save play returns to the scorer.
- Back in steps 2 and 3 goes back one step. Cancel in every step returns to the scorer.

### Limits of the mockup
- **Sheets fade in instead of sliding up.** Each sheet is drawn inside its own full screen, so Smart animate can only fade it in. The real app slides sheets up from the bottom, matching the rest of the motion rules.
- **Save play goes back to the original scorer screen.** No "after the single" scorer screen exists yet, so the count, runners and Last line look as they did before the play.
- **Following isn't carried back to the field.** After J. Ruiz is followed, closing the card returns to the Field tab without his orange ring. A. Kindle's card has no Following state, so his Follow button isn't wired.
- **Untested in Present view.** The links were checked through the API (every destination exists and is a top-level screen), but nobody has clicked through the prototype yet.
