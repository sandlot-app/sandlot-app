# Ticket 26 Mac acceptance

The passing app commit is `4b8f76a750f7df80d6cf7765a2525cba9e621ca3`. It adds the composite flow; app code is unchanged from `615ee56ee1d28fd050a8aec077f8800f9bd5dfa6`.

The dedicated simulator is sandlot-verify, iPhone 17 Pro, iOS 26.5, UDID FA09EA82-EAA7-4F77-89DC-CC6048730BE7. Java 17, pnpm 10.28.0 and Expo Go were used locally on Christian's Mac.

Launch, doctor, video recording, drive and cleanup ran in one shell command. The `offline-acceptance.yaml` flow nests `scoring-layout.yaml`, `pitch-controls.yaml` and `scorer-gallery.yaml` in one Maestro driver session. All steps passed. Video finished writing and cleanup shut down only the dedicated simulator and its Metro server.

Two earlier attempts passed the layout flow but a separate second Maestro process did not record its first Called strike tap. The game and waiting count stayed unchanged. Adding an animation wait and tap retry alone did not resolve it. The composite run used the same app source and exact acceptance assertions and passed every pitch control. This supports a driver-session boundary issue; no scoring-code fix is claimed from that experiment.

The proof covers real SQLite save, whole-play undo, return to Games and reopen, Expo Go stop and relaunch, normal-text dock layout, every pitch button and gallery navigation. It does not establish standalone bundled airplane-mode cold launch, physical-phone use, small-screen font scaling or VoiceOver/TalkBack speech. No app data was cleared or reset.

The 29 named flow screenshots and final.png accompany RESULT.txt, maestro.log, hierarchy.json and the raw mac.mov recording.
