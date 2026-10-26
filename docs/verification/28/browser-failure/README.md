# Browser storage-blocked failure

Two full verification runs reached the same failure in `setup-play-log.web.test.mjs` at the final fresh navigation to Games. The new browser path had already selected and saved both lineups, scored, undone a play, and successfully reopened the log in a fresh document. It then navigated from Field to `/` and could not find Continue scoring.

`failure.json` records a complete document at `/` with the actual storage error and active control IDs. `failure.png` shows that screen. This is an application storage-blocked state, not a hidden route selected by the test helper. Its cause is not yet established. The candidate does not claim data loss or a successful recovery from this failure.

The full run passed 54 of 55 mobile tests. Engine, web and token tests passed. Frozen installation, mobile lint, typecheck and both platform bundles passed. The standalone full browser path had passed before these full runs, so that earlier success is not a stability claim.

The user’s Hit by pitch design stop prevents further app changes in this candidate. The failure remains open for independent review and the draft handoff.
