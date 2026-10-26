# Implementation loop

How an agent takes one ticket from the issue tracker to a pull request. It adds to `AGENTS.md`; where the two differ, `AGENTS.md` wins. Codex names the pstack skills with a `pstack-` prefix.

## Before you start

1. Read the ticket, its parent spec, and everything they link: the design note in `docs/design/`, the Figma frame images on the ticket, and the ADRs in `docs/adr/` that touch the area.
   - **Screen tickets:** open every Figma frame the ticket names through the Figma connection (file `J8F4zRkkV63ji3AYhcHHwA`) and read its design context: the layout, sizes, spacing, colors, components and exact wording. Build from that, not from the PNG alone. The PNGs in `docs/design/frames/` are only a quick reference.
2. Use the words in `GLOSSARY.md`. If you need a concept it doesn't have, stop and ask (see Stop rules).
3. Check the ticket's blockers are merged. Work only on a ticket whose blockers are all closed.
4. Make a worktree on a new branch from the current `origin/main`. One ticket, one branch.

## The loop

1. **Sketch.** For anything beyond a small change, run `pstack-architect`: types, signatures and module boundaries first.
2. **Fail first.** Write the failing behavior test before the code. Engine changes start with a failing fixture, as `AGENTS.md` requires.
3. **Build** the smallest change that makes it pass.
4. **Check.**
   - Run `pnpm verify`. For the phone app, also run its lint, typecheck and `bundle`.
   - **Screen tickets:** for every screen you touched, put the app screenshot (the Mac simulator for phone tickets, otherwise the web build at 393 px wide) next to the Figma frame at the same size, and upload the pairs to the ticket's [proof release](#proof-release). Check them element by element before review.
   - **Phone tickets:** add the Maestro flow for the ticket's user path under `.claude/skills/verify-sandlot-mobile`. On the Mac, run it yourself with that skill:
     - Run `launch`, `doctor`, `drive` and `cleanup` inside **one** shell command, so the simulator's dev server stays alive for the whole run, and record the screen with `xcrun simctl io sandlot-verify recordVideo` while the flow drives.
     - Only one Mac check runs at a time, because every run shares the `sandlot-verify` simulator and port 8091.
     - Commit only the passing run's `RESULT.txt` and `maestro.log` to `docs/verification/<number>/`. Git ignores everything else in that folder.
     - Upload `final.png`, the screenshots, the video and any other evidence to the ticket's [proof release](#proof-release).
     - Comment on the PR with `RESULT.txt`, the commit, the simulator and iOS version, and the release link.
     - If app code changes after a passing run, run the check again.
5. **Review.**
   - `code-review` against the ticket (Spec) and this repo's rules (Standards).
   - `pstack-blast-radius` for what else the change could break.
   - `pstack-interrogate` as well when the change touches engine rules, privacy or security.
   - Rate every finding **high**, **medium** or **low**. Fix every high and medium finding, then run the reviews again. List low findings in the PR; they don't block.
6. **Hand off.** On a long run, keep a `show-me-your-work` log. Work happens on Christian's PC or Mac, never the VM: push the branch and open a **draft** PR whose body says `Closes #<number>`. The description covers:
   - what changed
   - the exact checks run and their results
   - review findings and how each was resolved
   - a link to the proof release, and what's left

## Proof release

Screenshots, Figma pairs and videos never go in git. Once committed, they stay in every clone's history for good, even after they're deleted. Each ticket gets one GitHub prerelease named `proof-<number>` instead:

```sh
gh release create proof-<number> --prerelease --latest=false --title "Proof for #<number>" --notes "<what ran, and what it doesn't cover>"
gh release upload proof-<number> <files> --clobber
```

- Release files sit in one flat list, so prefix files from a subfolder: `figma-score.png`, `web-more.png`.
- After a new passing run, upload its files with `--clobber` and delete any left over from the old run.
- The release's tag is only a name. `RESULT.txt` in `docs/verification/<number>/` says which commit passed.

## Done means all of these

- Every acceptance check in the ticket passes, and the ticket's "Not in this ticket" list is untouched.
- `pnpm verify` passes. For phone tickets, so do lint, typecheck and `bundle`.
- Screens match their Figma frames in layout, spacing, size, weight, color, components and wording. The only allowed differences are the platform's own typeface and controls the milestone hides on purpose.
- Colors, spacing and radii come from `@sandlot/tokens`. No raw values.
- Phone tickets: the Maestro flow passed on the Mac for the app code being merged, with `RESULT.txt` and `maestro.log` in `docs/verification/<number>/`, the screenshots and video in the `proof-<number>` release, and both linked on the PR. A run on the PC alone doesn't count.
- Reviews show no open medium or higher findings.

## Stop rules

Stop, and write the question into the handoff instead of building, when:

- The ticket needs a screen, state or rule that has no Figma frame, design note or ADR.
- You'd add a dependency, a new package, a database change or a shared-contract change the ticket doesn't name.
- You'd edit files another track owns. `apps/web` is Kevin's.
- You'd show a control for a feature that isn't built yet. Hide it instead; the milestone's Figma frames show what stays.
- A check still fails, or a high or medium finding is still open, after five fix-and-review rounds. Write down what you tried.

Never push to `main`, close a ticket by hand, or edit an issue. Merge only as the next section allows.

## Merging

Christian authorized agents on 2026-10-25 to review, fix and merge their own ticket PRs into `main` without waiting for him, as long as every gate below holds for the PR's current head commit. If a gate fails and you can't fix it within the stop rules, leave the PR as a draft, put the reason at the top of its description, and move on.

1. **It's a ticket PR.** It's your branch for one open `ready-for-agent` sub-issue, it targets `main`, and its body says `Closes #<number>`.
2. **CI passed on this exact commit.** The `verify` check succeeded for the head commit you're about to merge, and the PR merges cleanly.
3. **An independent review passed on this exact commit.**
   - A separate agent session that didn't write the code runs `code-review` (Spec and Standards) and `pstack-interrogate`.
   - It rates each finding high, medium or low. **No high or medium finding is open.** Low findings are listed but don't block.
   - It also checks:
     - **Dependencies:** any change to dependencies or `pnpm-lock.yaml` comes from the repo's pinned pnpm, passes `pnpm install --frozen-lockfile`, and is needed by the ticket. New outside libraries are named in the PR description.
     - **Engine rules:** any change to an existing fixture's expected result cites the rule book in the fixture and in the PR, as `AGENTS.md` requires.
   - Its findings, ratings and resolutions are posted as a PR comment that names the head commit.
   - After any new commit, the review runs again.
4. **It stays out of the areas only Christian changes.** The diff doesn't touch:
   - privacy or security (`supabase/`, sign-in, access rules, logging of personal data, `docs/contract.md`)
   - CI (`.github/`)
   - agent rules (`AGENTS.md`, `CLAUDE.md`, `docs/agents/`)
5. **Screen tickets match Figma.** The independent review opens each Figma frame the ticket names, compares it with the screenshot pair in the proof release, and lists every difference. It rates:
   - **High:** an element that's missing, extra or built differently (layout, component, order, color token, wording). Hidden controls for unbuilt features don't count.
   - **Medium:** a visible size or spacing difference.
   - **Low:** anything smaller.
   High and medium block the merge like any other finding. A screen ticket with no screenshot pairs doesn't pass.
6. **Phone tickets have their Mac proof.** The Maestro flow passed on the Mac for the app code being merged, whether you ran it or Christian did, with `RESULT.txt` and `maestro.log` in `docs/verification/<number>/`, the screenshots and video in the `proof-<number>` release, and both linked on the PR. The independent review looks at that evidence.

To merge, mark the PR ready, then squash-merge it pinned to the reviewed commit (`gh pr merge <n> --squash --match-head-commit <sha>`). Never enable auto-merge, use an admin override, or force-push. After merging, check that `main`'s CI run passes. If it fails, stop merging and report it.

## Running more than one

At most two tickets run at once, and never two in the same package. Each run has its own worktree and branch.
