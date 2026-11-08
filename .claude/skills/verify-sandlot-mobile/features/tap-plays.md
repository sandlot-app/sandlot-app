# Tap outcomes and runner moves

From a saved local game, tap In play to choose an outcome, the fielder and runner destinations. More offers steals, wild pitches, passed balls and pickoffs. Save play updates the score on this phone; Undo reverses the whole play, including its pitch and runner changes.

## Sub-features

- `outcome` covers the twelve outcome choices, fielder selection and changed destinations.
- `runners` covers selecting one or several runners through the four More actions.
- `third-out` covers the force versus tag question when a crossing may count, plus the order of multiple outs.
- `rejection` covers a forbidden Mustang bunt without changing the saved game.
- `reopen-undo` covers the saved result after reopening and complete play undo.

## How to get to it (user POV)

- From Your games, tap Start demo game (`start-game`, then both lineups and Start game as in lineups.md) or Continue scoring (`resume-game`).
- From the scorer, tap In play (`pitch-in-play`). Choose a result, select a fielder or Skip, then review every destination and Save play.
- From the scorer, tap More (`scorer-more`), then Steal attempt (`more-steal`), Wild pitch (`more-wild_pitch`), Passed ball (`more-passed_ball`) or Pickoff (`more-pickoff`).
- Tap Undo (`scorer-undo`) in the scorer to reverse the most recent saved play.

## Driving it with Maestro

Preconditions: use the baseline launch and doctor steps in the index. Keep the saved demo game. The scorer must be in progress, and the demo uses Mustang rules. Run `verify.sh drive tap-plays.yaml` once for the composite recipe; it preserves the initial score and pitch count by undoing every setup play at the end.

- **Outcome and cancel.** Tap `pitch-in-play`, capture `play-outcomes`, then Cancel. The waiting-play count must remain unchanged. The composite flow uses a saved Home run and two Singles to establish two runners through normal scoring controls.
- **Fielder and destinations.** Tap `outcome-double`, then `fielder-CF` and `play-next`. Capture `play-runners` and tap `save-play`. The waiting count increases by one and the pitcher count increases by one.
- **Saved result and undo.** Capture the score, stop Expo Go and reopen the project link on port8091, then tap `resume-game`. The score and pitch total must match. Tap `scorer-undo`; the complete setup score and pitcher count return.
- **Choose a runner.** Tap `more-passed_ball` and the second `destination-.*-home` control. After `save-play`, the selected lead runner scores while the other runner remains on base. The pitcher count stays unchanged. Undo must restore the previous score.
- **Other runner paths.** Use `more-steal` to move the lead runner to third and the trailing runner to second. Use `more-pickoff` and the first `destination-.*-out` control for an out. Use `more-wild_pitch` to score the chosen runner. Save and Undo each path before starting the next one.
- **Bunt rejection.** Open `outcome-sac-bunt`, Skip and Save play. `play-message` must say bunting is not allowed, and the waiting count must be unchanged. Cancel leaves the previous saved score.
- **Third-out evidence.** The composite flow advances the lead runner to third and records the needed Called strikes to reach two outs. Choose `outcome-fielders-choice`, the lead runner Home and the trailing runner Out. Select `out-type-.*-force`, save and confirm no run; Undo. Repeat with `out-type-.*-non_force`, save and confirm the run counts; Undo. Capture the choices and both results.
- **Restore the original game.** Undo the added strikes, runner setup and three original setup plays. `score-summary` and `pitch-total` must equal their values before the flow.

## Gotchas

- Run the composite recipe in one Maestro process. Its helper `_tap-outcome.yaml` is part of the same process.
- Home asserts that the runner crossed before the third out. A tag before a forced base is still a force; the non-force choice means the runner had reached the required base before the tag.
- Pickoff requires an Out destination. Out during a steal is caught stealing. Stealing home is forbidden by the demo’s Mustang rules. Balk and Pitching change are absent.
- Do not clear app data or inject runners to make the recipe pass. If a run stops midway, inspect the saved score and use the real Undo control to resolve its partial setup before reporting proof.
- Pitch-limit near and at-limit alerts have real store tests; the browser additionally drives the near-limit display and undo. This native recipe avoids sixty extra foul taps, so do not claim a native threshold exercise from it.
- Expo Go reopening through its localhost link is connected runtime proof. It does not prove a no-signal cold launch; that check belongs to30.
