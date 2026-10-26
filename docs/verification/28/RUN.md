# Ticket 28 verification handoff

Needs Christian: Hit by pitch has no Figma design

App source b0e74e12942efb66d4332186742cd67e237a45a8 remains unchanged by later evidence commits. The draft is not mergeable.

- Full pnpm verify failed twice at the new browser case's final fresh navigation, showing the actual storage-blocked screen. Engine 722, web 27, tokens 5 and 54 of 55 mobile cases passed. The standalone browser path passed twice but does not clear the suite failure. See browser-failure/.
- Pinned pnpm 10.28.0 frozen install, mobile lint, typecheck and iOS/Android bundles passed. Real SQLite has 35 passing cases.
- native-acceptance/ preserves the first failed original flow. Its drag target lay under the fixed navigation header.
- native-acceptance-retry/ preserves the centered retry. Actual drag/order assertion passed. The run failed at change-starting-pitcher. No acceptance PASS is claimed. Raw HEVC video is 1178 by 2556, 116.698333 seconds, 7501516 bytes.
- diagnostic-capture/ passed a narrower path and supplies real Mac screenshots. It does not substitute for the failed acceptance flow.
- figma/ contains ten same-size viewport pairs against live Figma context. Full long-frame renders are retained; first-viewport pairs do not prove full-height parity. Visible differences remain, including Field layout, assets, wording, geometry and count marks. Gate 5 fails.

Mac proof used owned iPhone 15 Pro simulators on iOS 26.5, local Metro port 8091 and connected Expo Go. Each attempt kept launch, doctor, drive/video and cleanup in one shell. No VM, data reset or standalone offline claim. The abandoned readiness helper experiment was reverted. The final helper and _ready flow match current main.

The new missing-design stop applies because the touched Field navigation and identity rendering retains the existing Hit by pitch control. Its placement is absent from Figma. No new placement or further UI correction was built after that stop. Independent exact-head review is posted on the PR.
