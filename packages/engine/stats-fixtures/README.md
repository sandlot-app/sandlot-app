# Batting-line fixtures

Each fixture here plays a game the same way as those in `../fixtures/`, then checks every batter's line from `battingLines` under `batting:`. A batter left out of `batting:` must have no line.

They live outside `../fixtures/` on purpose. The release lock in `src/fixture-results.json` records the replayed state of every fixture there, and moving it means a new engine version, which stops saved games from opening. A batting line is read from the replay without changing it, so these fixtures never move that lock.
