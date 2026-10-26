# Native acceptance failed

The original `lineups-play-log.yaml` acceptance flow failed on app commit `b0e74e12942efb66d4332186742cd67e237a45a8`. The batting-order label did not change after the native swipe from the first player's drag handle. No application correction or removed assertion follows this failure. The Hit by pitch design stop already blocks further UI building.

The owned simulator was `sandlot-verify-28-f1`, iPhone 15 Pro, iOS 26.5, UDID `66993FE0-D2EA-4DB6-BE56-613CAB31DFED`. Its 393-point width matches the reference width. The raw screenshots are 1179 × 2556. The unedited HEVC recording is 1178 × 2556, 110.227 seconds, 4,584,945 bytes; the video encoder uses an even width. Launch, doctor, recording, drive and cleanup ran in one shell command. Doctor passed every check and reported committed source. No VM was used.

The first launch timed out at the fresh-device Open in Expo Go confirmation. Opening that device's Simulator window then booted it outside the helper; the next helper launch safely refused. Only this owned empty simulator was shut down before a third launch. CUA brought its Expo Go window forward and accepted the authorized local-project Open confirmation during launch. No game controls or data were changed through CUA. The helper then reached readiness and the original acceptance flow ran. The first-launch image is retained here.

The status bar was visually fixed to 9:41 for comparison. It did not change event time or simulate an offline connection. The run used connected Expo Go and makes no no-signal claim.

`RESULT.txt`, `maestro.log`, `final.png`, `hierarchy.json`, `metro.log`, seven named screenshots and `mac.mov` belong to the same failed flow at `.verify/evidence/20261026T042834Z-lineups-play-log/`. Cleanup completed.

The separate `lineups-figma-capture.yaml` recipe collects later screen comparisons through normal controls. It is diagnostic coverage and cannot replace this failed acceptance flow or make gate 6 pass.
