# Sandlot

A youth baseball and softball scoring app for the parents who keep the book. Scoring by voice or one tap, one-step fixes, and full games with no signal.

## Layout

- `packages/engine`: the rules engine. Pure TypeScript, zero runtime dependencies.
- `packages/engine/fixtures`: YAML scenarios the engine must pass, each citing its rule book.
- `apps/mobile`: the Expo app (not created yet).

## Commands

- `pnpm install`
- `pnpm verify` runs typecheck and tests for every package. CI runs the same command. Run it before every PR.

## Rules

1. The engine is pure. No I/O, no clock, no randomness. Time comes from event timestamps and the game setup, never `Date.now()`.
2. A game is an append-only list of events. Game state is always computed by replaying them. Undo and corrections are new events.
3. Engine changes start with a failing fixture. Never change an existing fixture's expected result without a rule-book citation in the fixture and a note in the PR.
4. League rules are data in a `RuleSet`, never `if (league === ...)` branches.
5. Player names never appear in events, stats, logs, or analytics. Refer to players by ID.
6. The AI parser never saves a play. It proposes commands, and the engine decides whether they are legal.

## Workflow

- Claude Code orchestrates every task and writes most of the code. Codex takes implementation tasks Claude Code hands it. Both read this file.
- One task per branch and PR. Small diffs. `pnpm verify` must pass.
- Christian reviews anything that changes engine rules, security, or privacy.
