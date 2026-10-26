# Ticket 27 Mac verification

`tap-plays.yaml` passed on Christian's Mac at app commit `a3338ee91a12626c4c45641d3180793ba6e45a8a`. This rerun includes the independent review fixes that preserve the original action time and match the More card. It supersedes the earlier passing run at `211a1da` after app code changed.

The simulator was `sandlot-verify`, iPhone 17 Pro, iOS 26.5, UDID `FA09EA82-EAA7-4F77-89DC-CC6048730BE7`. Doctor passed every check and reported the committed source. Launch, doctor, recording, the single composite drive and cleanup ran in one shell command. Cleanup stopped this run's Metro and shut down its simulator. No VM was used.

The flow drives public controls with the real engine and saved SQLite game. It covers all four More actions, chosen runners, hits, a Mustang bunt rejection, connected Expo Go reopening, whole-play undo and explicit force versus non-force third outs with different score results. It cancels an unsaved draft, then undoes every setup play and added pitch. Its final assertions restore the initial score, bases, count, outs and pitcher total. The append-only waiting-play count naturally rises from the undo events.

`RESULT.txt` identifies the source commit and passing flow. `maestro.log`, `hierarchy.json`, `final.png`, `metro.log` and the twenty named images in `screenshots/` are copied from the same run at `.verify/evidence/20261026T031304Z-tap-plays/`. `mac.mov` is the unedited screen recording from that drive, HEVC, 1206 × 2622, 116.783 seconds, 11,026,800 bytes.

The maintained recipe is `.claude/skills/verify-sandlot-mobile/features/tap-plays.md`. Threshold alerts have real SQLite tests and browser evidence; this native recipe omits sixty foul taps. This connected Expo Go check does not prove standalone no-signal cold reopening, which belongs to #30.

See [the five web captures beside Figma frames](web/README.md).
