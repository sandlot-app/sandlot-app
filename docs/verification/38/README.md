# Ticket 38 design stop

Needs Christian: Hit by pitch has no Figma design

[Issue 38](https://github.com/sandlot-app/sandlot-app/issues/38) requires applying Field frame 165:11107 while preserving all scoring behavior and tests from issue 26. On 2026-10-25 the user explicitly instructed this run to stop if a ticket needs Hit by pitch on screen, without inventing its design.

Current base is b3478ecff359f2dc4f2f948950d2f0b31068f27f. Native GitHub blocked-by issues 26 and 37 are closed. The branch starts from that current main. Only this handoff and reference artifacts change. No screen implementation was attempted.

## Observed design context

The live Figma connection opened Field 165:11107 and More 165:11367 in session e12597e2-ceec-4c22-af53-d229e21c47dd. The Field is 393 by 852. Its compact scoreboard is 361 wide with radius 28. The Field is 361 by 390 at x16, y229. Pitch controls are Ball, Strike, Foul and In play. Voice=Off supplies Undo and More. The current at-bat card sits beneath the Field. The palette uses the exported page, card, scoreboard and grass tokens. More lists Steal attempt, Wild pitch, Passed ball, Pickoff and Pitching change. Neither frame supplies a Hit by pitch control.

The current score screen explicitly includes `hit_by_pitch` in its pitch array and records it through the public pitch command. Removing it loses existing behavior. Adding it to the Scorer Bar or More invents a design. The existing behavior and required Figma match cannot both be completed under the current specification.

Christian needs to supply a Figma placement and interaction for Hit by pitch, or explicitly approve a scope change to its existing behavior. No default was chosen because this is the user's named stop rule.

## Evidence limits

The committed figma/ pair places the live Field render beside the historical Mac screenshot from merged PR50 at app source a3338ee91a12626c4c45641d3180793ba6e45a8a. `git diff a3338ee91a12626c4c45641d3180793ba6e45a8a b3478ecff359f2dc4f2f948950d2f0b31068f27f -- apps packages` is empty. This identifies the unchanged baseline; it is not a ticket 38 acceptance capture.

The original Mac image is 1206 by 2622 from an iPhone 17 Pro, iOS 26.5. make-pair.py scales its width to 393, preserves aspect ratio and crops the final two pixels to match 852. This does not simulate a fresh 393-point viewport or prove visual parity. Left is Figma, right is the existing app. Obvious layout and component differences remain. Gate 5 fails. No UI correction follows the missing-design stop.

The historical tap-plays Mac check passed for that baseline, as preserved in ../27/RUN.md. No new ticket 38 Mac check was run. Gate 6 is not claimed. No VM was used. The new requirement is unimplemented, so architecture exploration and new failing behavior tests were skipped rather than creating prohibited UI work.

## Checks

Pinned pnpm 10.28.0 frozen installation and full pnpm verify passed on this unchanged app source. Engine 722, web 27, tokens 5 and mobile 48 tests passed. Mobile lint, typecheck and both iOS and Android bundles passed. These checks validate the baseline, not completion of ticket 38. Exact-head independent review remains required before any merge; this draft cannot pass because the screen is unimplemented.
