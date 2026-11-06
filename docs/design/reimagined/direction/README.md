# Sandlot: the new UI direction

The screens chosen on 2026-11-05, as moving mockups, plus the colors, parts and rules behind them. Use this as the starting point for updating the Figma or starting a new one.

Live page (private to Christian until shared): https://claude.ai/artifact/SPmzvRhuJJwqbYfYN3BNuo
Open `built-page/index.html` from a local web server to see the same page offline.

## Chosen

- **Getting started:** Welcome (Continue with Apple or Google; sign up and log in are the same button), Get set up (roles, then join the team and pick your player), Home (today's game with Keep score, Stream video, Share live link). Uses the Figma logo. Source: `../getting-started/`.
- **Scorer, voice: Field Day.** The Rec field fills the screen under the TV score bug. Tap the mic once, say the play, the play runs on the field and saves itself with one Undo. Ball and Strike stay one tap. Source: `../field-day-youth/`.
- **Scorer, no voice: Big buttons.** 2×2 tiles (Ball, Strike, Foul, In play). In play asks what happened, then where. Source: `../field-day-tap/`.
- **Fan screens:** Live game, Player page, Lock screen (Live Activity and notification), following one player. Source: `../field-day-fan/`.
- **Streaming screens** (the in-app broadcaster, a later milestone): Set up, Live, End, all landscape on a phone mounted on the backstop. The camera view is a still photo (`live-stream.jpg`, from Christian) standing in for live video. Source: `../field-day-stream/`.

- **Before the game:** Games tab, Start a game (simple: one screen filled from the schedule, replacing Game setup and Lineup), Before first pitch. Source: `../before-game/`, `../simpler/`.
- **During the game:** More menu (simple, 4 tiles), Fix a play (simple, two taps), Rain delay, No signal, Two readings (voice question). Source: `../during-game/`.
- **After the game:** End of game (simple, one card replaces Close the book), Final summary, Recap and stat card, Box score (simple, plain sentences). Source: `../after-game/`, `../simpler/`.
- **Team and account:** Team (simple, roster grid + invite), Me (simple, three cards), Public link (names hidden). Source: `../team-account/`, `../simpler/`.

The seven simpler screens replaced their first versions on the direction page on 2026-11-05; the first versions stay in their folders for reference.
- **Team share card:** a no-names team card for families who haven't claimed a player, with a one-tap Claim that turns it into their kid's card. Source: `../share-and-plan/`.
- **Video plan:** scores stay free; one family plan for video, replays and clips, offered from the locked Video tab. Prices ($4.99/month, $39.99/year) are placeholders until the streaming cost test. Source: `../share-and-plan/`.
- **Recruiting (13 and up):** parent's profile with one who-can-see-this choice and scout requests; scout view with no contact details; an under-13 note. Source: `../recruiting/`.
- **Highlights:** Top plays of the week (plan milestone 14). Source: `../top-plays/`.

**Less like Figma** (2026-11-05): six screens were rebuilt from baseball objects instead of lists, tables and tabs, and replaced their earlier versions on the direction page: Game day board, Before first pitch (lineup runs out on the field), Final scoreboard, Box score cards, Maya's card (flips to the season), Team on the field. Source: `../less-figma/`.

## Player chips on the field

Our players are orange chips with the number and a dark name pill under them; the other team is small navy chips with no names. (An old-Figma-style version, white and blue with names, was tried on 2026-11-05 and dropped.)

## Colors

| Name | Hex | Used for |
|---|---|---|
| Sandlot orange | #FF7519 | Mic, our runners, Undo, In play |
| Sandlot green | #0C4C39 | Headings, saved tick |
| Ball | #2FB862 | Ball button and dots |
| Strike | #F2AC16 | Strike button and dots |
| Out | #E5484D | Out dots |
| Hawks navy | #25447E | The other team's fielders |
| Grass | #56A04B | Field |
| Infield dirt | #C8915F | Rec infield |
| Fence cap | #F4C430 | Chain-link top |
| Paper | #F4F1E8 | Bottom sheet, pages |

## Rules

- Youth field, not a stadium: no stands, crowds or light towers.
- The mic is tap once, never hold.
- A described play saves without asking; a banner and one Undo fix it.
- Ball and Strike are always one tap.
- Every play runs on the field so the scorer can see it's right.
- Names show on screen only; saved data refers to players by ID.
- Streaming is landscape. The video's score comes from the scorer's phone, never typed by the streamer.

The mockups are built with the stageshow kit (React and CSS), not Expo. They show the look and motion; the real screens get built in `apps/mobile`.
