# Sandlot

A youth baseball and softball scoring app for the parents who keep the book. Scoring by voice or one tap, one-step fixes, and full games with no signal.

The plan is in [docs/plan.md](docs/plan.md): who owns what, the milestones in order, and the check that ends each one. Read it before starting a task.

## Layout

- `packages/engine`: the rules engine. Pure TypeScript, zero runtime dependencies.
- `packages/engine/fixtures`: YAML scenarios the engine must pass, each citing its rule book.
- `apps/mobile`: the Expo app. It has its own `AGENTS.md` with Expo rules. Read it before touching the app.

## Commands

- `pnpm install`
- `pnpm verify` runs typecheck and tests for every package. Run it before every PR.
- `pnpm --filter @sandlot/mobile bundle` builds the app's iOS and Android bundles. CI runs it too, which proves the app still imports the engine.
- `.claude/skills/verify-sandlot-mobile/scripts/verify.sh launch`, then `drive <flow>.yaml` and `cleanup`, opens the app in its own iOS simulator and saves proof that a change works. Read `.claude/skills/verify-sandlot-mobile/SKILL.md` before using it. It needs a Mac with Xcode, Java 17 and Maestro.

## Rules

1. The engine is pure. No I/O, no clock, no randomness. Time comes from event timestamps and the game setup, never `Date.now()`.
2. A game is an append-only list of events. Game state is always computed by replaying them. Undo and corrections are new events.
3. Engine changes start with a failing fixture. Never change an existing fixture's expected result without a rule-book citation in the fixture and a note in the PR.
4. League rules are data in a `RuleSet`, never `if (league === ...)` branches.
5. Player names never appear in events, stats, logs, or analytics. Refer to players by ID.
6. The AI parser never saves a play. It proposes commands, and the engine decides whether they are legal.

## Workflow

- Claude Code orchestrates every task and writes most of the code. Codex takes implementation tasks Claude Code hands it. Both read this file.
- Each agent works in its own git worktree, for example `git worktree add ../sandlot-codex -b <branch>`. Two agents never share a checkout.
- One task per branch and PR. Small diffs. `pnpm verify` must pass.
- Agents push branches and open PRs. Agents never push to `main` and never merge. Christian merges every PR.
- Christian reviews anything that changes engine rules, security, or privacy.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `sandlot-app/sandlot-app`, through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## pstack models

The model each pstack role runs on, set with `/setup-pstack` at the `large` budget (xhigh reasoning). The same lines are in `~/.cursor/rules/pstack-models.mdc` for Cursor. In Claude Code, `claude-sonnet-5-5-xhigh` means a subagent with `model: sonnet` and `effort: xhigh`.

```
feature, refactoring: claude-sonnet-5-5-xhigh
bug-fix: claude-sonnet-5-5-xhigh
perf-issue: claude-sonnet-5-5-xhigh
hillclimb: claude-sonnet-5-5-xhigh
judgment and prose: claude-opus-5-5-xhigh
hardest tasks: claude-opus-5-5-xhigh
how explorer: claude-sonnet-5-5-xhigh
how explainer: claude-opus-5-5-xhigh
why investigators: claude-sonnet-5-5-xhigh
why synthesizer: claude-opus-5-5-xhigh
reflect tooling: claude-sonnet-5-5-xhigh
reflect judgment, divergent, synthesizer: claude-opus-5-5-xhigh
arena runners: claude-opus-5-5-xhigh, claude-sonnet-5-5-xhigh
arena cross-judge pool: claude-opus-5-5-xhigh, claude-sonnet-5-5-xhigh
swarm workers: claude-sonnet-5-5-xhigh
architect runners: claude-opus-5-5-xhigh, claude-sonnet-5-5-xhigh
interrogate reviewers: claude-opus-5-5-xhigh, claude-sonnet-5-5-xhigh
```
