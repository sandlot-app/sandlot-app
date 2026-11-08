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

These are the direction's colors. They are in `@sandlot/tokens` since #112 (2026-11-07); the "Token today" column shows the values from before it. The implementation loop's Done rule says screens use tokens only, never raw hex, so screen tickets use the token names, never the hex values below.

| Name | Hex | Used for | Token today | Change |
|---|---|---|---|---|
| Sandlot orange | #FF7519 | Mic, our runners, Undo, In play | `logo/emblem` #FF7519; `action/primary` is still blue #1D5FD6 | Make the primary action orange |
| Sandlot green | #0C4C39 | Headings, saved tick | `logo/background` #0C4C39 | Same, reuse it |
| Ball | #2FB862 | Ball button and dots | `count/ball` #5CCB76 | Update |
| Strike | #F2AC16 | Strike button and dots | `count/strike` #F5C04A | Update |
| Out | #E5484D | Out dots | `count/out` #EF5A4C | Update |
| Hawks navy | #25447E | The other team's chips | none | Add |
| Grass | #56A04B | Field | `field/grass` #3B7A3A | Update |
| Infield dirt | #C8915F | Rec infield | `field/dirt` #C4855A | Update |
| Fence cap | #F4C430 | Chain-link top | none | Add |
| Paper | #F4F1E8 | Bottom sheet, pages | `surface/page` #F7F5EF | Update |

Labels and icons on orange fills use `text/on-action` (near-black, 6.24:1), not white: white on #FF7519 is 2.69:1, under every contrast minimum. Link-style actions on the page and cards use `text/link` (#A84706, a deeper orange, 5.21:1 on paper), not `action/primary`, which is 2.38:1 as text. Christian chose both on 2026-11-07 in the tokens PR.

Selected-state graphics on light backgrounds (outlines, switch tracks, small marks, spinners) use `action/strong` (the same #A84706, 5.88:1 on white), not `action/primary`, which is 2.69:1 on white, under the 3:1 bar for graphics. Icons on an `action/strong` fill are white `text/on-accent` (5.88:1): the dark `text/on-action` is 2.85:1 on the deeper orange. Large button fills stay `action/primary`. Christian chose the white check on the share screen's picked mark on 2026-11-07.

The orange primary replaces the old rule in `docs/design/spec-update-game-states.md` that link-style actions are blue and orange is reserved for "followed". `ring/followed` (#F07A1A) is now almost the same color as `action/primary`, so the first screen ticket that shows a followed player picks a new followed-ring color.

## Rules

- Youth field, not a stadium: a chain-link fence, trees and small aluminum bleachers, as on the Rec field. No grandstands, crowds or light towers.
- The mic is tap once, never hold.
- A described play saves without asking; a banner and one Undo fix it.
- Ball and Strike are always one tap.
- Every play runs on the field so the scorer can see it's right.
- Names show on screen only; saved data refers to players by ID.
- Streaming is landscape. The video's score comes from the scorer's phone, never typed by the streamer.

## Open decisions before screen tickets

- **Video plan prices.** $4.99 a month and $39.99 a year (and "Save 33%") are samples until Kevin's streaming cost test sets the price. The mockup labels them "Sample prices, not final" on screen. Don't copy them into product UI or App Store text.
- **The stand-in photo.** `live-stream.jpg` is a real youth-game photo Christian supplied. It stands in for live video on the streaming screens and for clips on Top plays, Recruiting and the Video plan. Christian chose to keep it for now (2026-11-06). Revisit before this direction is shared outside the team: keep it, or replace it with a synthetic or fully anonymized still.
- **Long names.** The mockups use short first names. Check long names and numbers against the Figma Stress test before building each screen.

The mockups are built with the stageshow kit (React and CSS), not Expo. They show the look and motion; the real screens get built in `apps/mobile`.
