# Diagnostic capture passed; acceptance still failed

`lineups-figma-capture.yaml` passed at evidence commit `d984eb951f0cdcd5548075f0355a4315bca75041`. Application source is unchanged from `b0e74e12942efb66d4332186742cd67e237a45a8`. This is a separate diagnostic recipe. It does not exercise drag reordering and cannot replace the original acceptance flow, which failed that assertion. Ticket 28's Mac acceptance result remains FAIL.

The recipe uses the actual app, SQLite and engine through public controls. It saves the two lineups, selects a non-default home pitcher, captures the touched screens, saves Ball and Single, undoes the Single, and checks the same visible identities and saved count after connected Expo Go reopening. It contains no state injection, data reset or application correction. It started with no persisted book because the failed acceptance flow stopped before Start.

The simulator was the same owned `sandlot-verify-28-f1`, iPhone 15 Pro, iOS 26.5, UDID `66993FE0-D2EA-4DB6-BE56-613CAB31DFED`. Launch, doctor, video, one composite drive and cleanup ran in one shell. Doctor passed and reported the committed source. This launch needed no CUA action. The visual status bar override used 9:41; it did not change event timestamps or create an offline condition. No VM was used.

All files here come from `.verify/evidence/20261026T043620Z-lineups-figma-capture/`. The unedited HEVC video is 1178 × 2556, 165.047 seconds, 15,926,762 bytes. Maestro captures are 1178 × 2556, while the simulator final screenshot is 1179 × 2556. The encoder uses an even video width.
