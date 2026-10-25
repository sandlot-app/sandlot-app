## Video tab (added 2026-10-24)

Figma: Viewer page, section "Video tab" `101:4905`, placed after "Plays & Box score tabs". Scorer and Player card sections moved down 1164px.

### Screens
- **Viewer — Video tab (live)** `101:4996`: Status bar, Nav bar, Scoreboard (Live, Expanded, Batting=Home), Tabs (Selected=Video), Stream Card (State=Live), then a centered Caption in text/tertiary: "The stream can run a few seconds behind the score."
- **Viewer — Video tab (no stream)** `101:5162`: same header stack, Stream Card (State=Empty). No caption, since the card explains itself.
- Both are 393×852 phone frames with the home indicator, laid out like the other tab screens (Content: 16px sides, 12px gap).

### Rules
- Live scoring is the source of truth. The video usually lags, so the caption warns that the score can be ahead of the picture.
- The Stream Card's score panel repeats the scoreboard on purpose: it stays on the video when the player goes full screen.

### Deferred
- **Video tab (ended)** waits for the Final game state (task 3). The Ended card shows "Final", which conflicts with the live sample game (Bottom 5). It will sit next to a Final scoreboard.

### Open questions
- Where does a parent add a stream link from the Empty state? The card says "A parent or the scorer can add a stream link", but there's no action on the screen. Options: a button in the card, or the nav More menu.
- A stream that ends mid-game (the streamer leaves): the Ended variant only covers Final. This may need an "Ended early" variant that shows the inning it stopped in.
