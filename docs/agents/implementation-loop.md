# Implementation loop

How an agent takes one ticket from the issue tracker to a pull request. It adds to `AGENTS.md`; where the two differ, `AGENTS.md` wins. Codex names the pstack skills with a `pstack-` prefix.

## Before you start

1. Read the ticket, its parent spec, and everything they link: the design note in `docs/design/`, the Figma frame images on the ticket, and the ADRs in `docs/adr/` that touch the area.
2. Use the words in `GLOSSARY.md`. If you need a concept it doesn't have, stop and ask (see Stop rules).
3. Check the ticket's blockers are merged. Work only on a ticket whose blockers are all closed.
4. Make a worktree on a new branch from the current `origin/main`. One ticket, one branch.

## The loop

1. **Sketch.** For anything beyond a small change, run `pstack-architect`: types, signatures and module boundaries first.
2. **Fail first.** Write the failing behavior test before the code. Engine changes start with a failing fixture, as `AGENTS.md` requires.
3. **Build** the smallest change that makes it pass.
4. **Check.**
   - Run `pnpm verify`. For the phone app, also run its lint, typecheck and `bundle`.
   - **UI tickets:** take web-build screenshots of each screen you touched at 393 px wide, next to the ticket's Figma frames.
   - **Phone tickets:** add the Maestro flow for the ticket's user path under `.claude/skills/verify-sandlot-mobile`. It's run on the Mac before the PR is ready.
5. **Review.**
   - `code-review` against the ticket (Spec) and this repo's rules (Standards).
   - `pstack-blast-radius` for what else the change could break.
   - `pstack-interrogate` as well when the change touches engine rules, privacy or security.
   - Medium or higher findings block. Fix them, then run both reviews again.
6. **Hand off.** On a long run, keep a `show-me-your-work` log. Export the branch with `vm_export.py`, and write `pr-body.txt` covering:
   - what changed
   - the exact checks run and their results
   - review findings and how each was resolved
   - the screenshots, and what's left

## Done means all of these

- Every acceptance check in the ticket passes, and the ticket's "Not in this ticket" list is untouched.
- `pnpm verify` passes. For phone tickets, so do lint, typecheck and `bundle`.
- Screens match their Figma frames in layout, spacing, size, weight and color. The typeface is the platform's own.
- Colors, spacing and radii come from `@sandlot/tokens`. No raw values.
- Phone tickets: the Maestro flow passed on the Mac, with screenshots and video attached to the PR. A Windows or VM run alone doesn't count.
- Reviews show no open medium or higher findings.

## Stop rules

Stop, and write the question into the handoff instead of building, when:

- The ticket needs a screen, state or rule that has no Figma frame, design note or ADR.
- You'd add a dependency, a new package, a database change or a shared-contract change the ticket doesn't name.
- You'd edit files another track owns. `apps/web` is Kevin's.
- You'd show a control for a feature that isn't built yet. Hide it instead; the milestone's Figma frames show what stays.
- The same check fails after three honest attempts. Write down what you tried.

Never push to `main`, merge, close a ticket, or mark a PR ready. Christian does that.

## Running more than one

At most two tickets run at once, and never two in the same package. Each run has its own worktree and branch.
