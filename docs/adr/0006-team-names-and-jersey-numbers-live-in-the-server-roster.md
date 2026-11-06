---
status: proposed
---

# Team names and jersey numbers live in the server roster, copied into each game

Team names and jersey numbers are kept in the server's roster, in the same table as children's names, and each game keeps a copy of them from when it was set up. The live page reads them through a view that leaves names out for public viewers. We didn't put them in the engine's game setup, though the setup already lists each game's players, because the engine needs neither to score. Keeping it free of them keeps names and numbers under the one set of privacy rules the plan puts in that table. Until this ships, the live page keeps its own copy of the demo game's teams and numbers.

## Consequences

- An old game shows the numbers its players wore that day. When a child switches from #7 to #12, April's box score and play log still say #7.
- The team admin keeps the team's own roster of names and numbers. For an opponent not on Sandlot, the scorer enters the team name and jersey numbers at game setup, and never their players' names, because those families never agreed to anything in Sandlot.
- A player with no number shows a dash. Two players on one team may share a number. The scorer is warned at setup, and the play log still tells them apart by ID.
- `docs/contract.md` changes, so both Christian and Kevin sign off. Once games carry their own names and numbers, the live page drops its copy of the demo roster.
