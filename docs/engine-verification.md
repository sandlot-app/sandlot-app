# Verify engine replay changes

Run `pnpm verify` to check types, cited fixtures, randomized games, the printed sample requests, and the current fixture result lock. Run `pnpm --filter @sandlot/mobile bundle` to check both mobile imports.

Every YAML fixture runs through one Node-only executor in `packages/engine/test/fixture-runner.ts`. It applies plays through the public engine functions, checks the fixture's expected state or rejection, and compares accepted histories with replay. Fixtures that start mid-game use the documented fixture convenience functions. The test suite and snapshot command use the same executor. The engine's runtime imports none of this tooling.

## Update fixture results

1. Add a cited fixture that demonstrates the intended behavior.
2. Run the focused fixture test and observe its failure before changing engine behavior.
3. Implement the change and run `pnpm verify`.
4. If any fixture result changes, increase `ENGINE_VERSION` in `packages/engine/src/version.ts`.
5. Run `pnpm --filter @sandlot/engine fixtures:update`.
6. Review the full result changes in `packages/engine/src/fixture-results.json`.
7. Run `pnpm verify` again.

The lock stores every fixture's full state or rejection, including fields that the fixture's smaller expected result does not mention. It also records the engine and event schema versions. New or removed fixtures change the lock and require an engine-version increase after the initial release.

## Compare with the trusted base

Run `pnpm --filter @sandlot/engine fixtures:check --base <full-commit-SHA>` to check both current consistency and the historical version rule. Use the actual base revision for the proposed change. This command does not infer a base from `origin/main` or `HEAD^`.

CI fetches the full Git history. On a pull request, it passes GitHub's PR base SHA. On a main push, it passes the event's `before` SHA. The command reads the baseline's version exports and committed lock through Git without executing old engine code. Unavailable history, malformed locks, and missing locks fail the check.

The only missing-lock exception is the initial release from commit `fcc7ed5c50335ca50a4c7d8c552015d63410eeec`. That exact predecessor exports engine `0.1.0-alpha.1` and event schema `2`. The exception accepts only the new `0.1.0` lock with schema `2`. Later comparisons require an existing baseline lock. An all-zero SHA fails.

Current consistency alone cannot detect a regenerated lock under an unchanged engine version. CI's separate baseline comparison detects that case. A changed lock requires a strictly newer semantic engine version, including the transition from a prerelease to its final release. A version pin does not provide an old-engine loader or a stored-game migration.

## Reproduce a randomized failure

The properties in `packages/engine/test/properties.test.ts` use [fast-check](https://fast-check.dev/docs/core-blocks/properties/) as an engine development dependency. Each generated game uses real lineup and start events, varied pitches, hits, fielded outs, runner moves, and undo. Every game also includes a single, a steal, and a two-command hit followed by undo. A second property varies the hit and the prior count and checks that undo restores the whole preceding state.

On failure, fast-check reports a seed, path, and minimized counterexample. Pass that seed and path to the failing property's `fc.assert` options to repeat it. The random generator belongs to the tests. The engine has no clock, random source, I/O, or runtime dependency.

These checks cover issue #16 and demo-plan step 1. They do not prove a real game's box score, the later scorer interface, hosted sync validation, or the separate milestone 6 version gate and test-game reset in issue #21.
