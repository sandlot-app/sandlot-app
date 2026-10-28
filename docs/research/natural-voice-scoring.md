# Making voice scoring feel natural

Question: hold-to-talk feels unnatural. The founder wants free-flowing speech ("Soto hits Ruiz, Ruiz takes first"), several plays per breath, said any way the parent likes. What do primary sources say, and what could Sandlot build before Nov 2?

Sourcing note. Pages below were fetched on 2026-10-28 with a summarizing fetch tool, so numbers are the tool's reading of the page, not a raw copy. Apple HIG (speech page, 404), Material, Google Android and Porcupine runtime details did not load or were thin, so those are marked **unverified**. Nothing was measured on a phone. Read `voice-noise-and-capture.md` first; it covers noise, `noise_reduction`, `delay`, and the empty-transcript fallback, and this file does not repeat it.

## 1. What Sandlot does today (short)

- Hold-to-talk, one phrase per press, manual commit, `gpt-live-transcribe` (see `docs/research/voice-noise-and-capture.md` section 1).
- Plan: a small local grammar handles easy phrases; anything else goes to an AI parser that returns candidate commands; the engine checks them; simple legal plays save with a banner and undo (`docs/plan.md`, "Voice scoring").
- One press = one `group` of events, so one undo reverses everything a press recorded (`docs/plan.md`, data model). This already fits "several plays per breath".
- The parser lives in `packages/voice/src/model.ts` (`parserSchema`, `parserInstructions`) and is called from `supabase/functions/voice-parse/handler.ts`.

## 2. Interaction models

| Model | What the docs say | Source |
|---|---|---|
| Hold-to-talk (today) | `gpt-live-transcribe` has no VAD; docs say to omit `turn_detection` and use client-side VAD or an explicit commit | https://developers.openai.com/api/docs/guides/realtime-vad |
| Tap-to-toggle | Same API calls as hold: append audio, then `input_audio_buffer.commit` on the second tap. No vendor guidance on which feels better (reasoning, not a claim) | https://developers.openai.com/api/docs/guides/realtime-transcription |
| Hands-free (server turn detection) | Realtime sessions have turn detection on by default, so the API decides when the user starts and stops; `semantic_vad` can be set under `audio.input` in `session.update` | https://developers.openai.com/api/docs/guides/realtime-conversations |
| Hands-free, semantic | Semantic VAD scores the words so far to guess if the speaker is done; `eagerness` low/medium/high waits up to 8 s, 4 s, 2 s. Not available on `gpt-live-transcribe` | https://developers.openai.com/api/docs/guides/realtime-vad (as read in the earlier note) |
| Wake word | Picovoice Porcupine is described as a lightweight wake-word engine for always-listening apps; custom phrases are trained in a web Console; models are platform-specific; every user needs an AccessKey. The page gives no CPU or battery numbers and does not clearly document React Native | https://picovoice.ai/docs/porcupine/ |

Not verified: Apple and Android guidance on battery cost, background mic indicators and privacy prompts for always-on listening. The Apple HIG speech page returned 404. Before shipping any always-on mode, read Apple's microphone-access and background audio docs and Android's foreground-service microphone rules. Reasoned risks, not vendor claims: a crowd will false-trigger or drown a hands-free mic; an open mic for a 2-hour game drains battery and records other people's children.

## 3. Design guidance on turns, confirmations, errors

- **Confirm sparingly.** Google's conversation design page recommends explicit (yes/no) confirmation rarely, for hard-to-undo actions or costly misunderstandings; implicit confirmation (repeat what was understood and move on, user can still correct) for most things; none for simple high-confidence input. https://developers.google.com/assistant/conversation-design/confirmations
- **One-step correction.** Same page: support "no" followed by the fix, do not treat the "no" as rejecting everything, and let users change any one parameter rather than restart. This matches Sandlot's "fix in one step".
- **Alexa agrees:** use confirmation sparingly because users find frequent requests annoying; confirm a whole intent only when necessary, a single slot only when the value needs checking. https://developer.amazon.com/en-US/docs/alexa/custom-skills/define-the-dialog-to-collect-and-confirm-required-information.html
- Apple HIG and Material voice guidance on push-to-talk and turn-taking: **unverified** (not loaded).

Fit with Sandlot: the read-back banner plus undo is the implicit-confirmation pattern. A confirm card is the explicit one, so reserve it for what the engine classifies as unclear, as the plan already says.

## 4. OpenAI Realtime for free-form, multi-play speech

- **Session length:** max 60 minutes per Realtime session; settings change mid-session with `session.update`. A game would need reconnects. https://developers.openai.com/api/docs/guides/realtime-conversations
- **Text-only output:** set `output_modalities` to `["text"]` (audio or text, one only). So a model can listen and answer in text without speaking. Same page.
- **Tool calls:** declare `session.tools`; the model emits a `function_call` item (name, arguments, call_id) in `response.done`; your code runs it and replies with `function_call_output`, then `response.create`. Same page.
- **Parallel calls:** the model can call several functions in one turn (`parallel_tool_calls: false` limits to one). Strict mode needs `additionalProperties: false` and every property `required` (optional = nullable); OpenAI recommends strict. Soft guideline: under 20 tools. https://developers.openai.com/api/docs/guides/function-calling
- **Prices** (per 1M tokens, https://developers.openai.com/api/docs/pricing): `gpt-realtime-2.1-mini` audio in $10 / out $20, text in $0.60 / out $2.40; `gpt-realtime-2.1` audio in $32 / out $64. Transcription per minute: `gpt-live-transcribe` and `gpt-realtime-whisper` $0.017, `gpt-transcribe` $0.0045.
- **Cost math (mine, not the page's):** `gpt-live-transcribe` open for a 2-hour game is 120 min x $0.017 = about $2.04 if the stream is billed while open. Whether idle silence is billed the same was not confirmed; do not assume it is free. Hold-to-talk bills only held seconds, which is why the plan says about 4 cents a game.
- **Not confirmed:** whether speech-to-text-with-tools on a `gpt-realtime-*` model beats transcription plus a separate parser for baseball names. The separate-parser design keeps rule 6 simpler (the parser is a pure proposal step) and is what the repo already has.

## 5. Parsing one long utterance into many commands

- Strict structured outputs (`text.format` = `json_schema`, `strict: true`) make the model follow the schema, with no retries for malformed JSON, and refusals are detectable. Check for refusal and incomplete responses. First request with a new schema has extra latency. https://developers.openai.com/api/docs/guides/structured-outputs
- **Unverified:** whether the supported-schema section allows arrays of `anyOf` command variants (the fetch read only the first 100,000 of 136,310 characters). Check that section before designing the schema as a list of a union. Fallback: one function per command kind with parallel tool calls (documented above).
- The repo already has `parserSchema` returning candidate commands; extending it from one play to an ordered list is a schema change, not a new system. I did not read `model.ts` line by line; confirm what it returns today.

Design notes (reasoning, not vendor claims):
- Give the parser the context: batting order and who is up, pitcher in the game, bases and runners, count, outs, home/away roster IDs. Only IDs come back (rule 5), and the phone maps names to IDs locally.
- "Soto hits Ruiz": if the first name is the opposing pitcher and the second is the batter, emit hit-by-pitch. This is a data lookup on the game context, so the engine, not the model, should verify the roles.
- Order matters: commands must replay in spoken order; the engine's `applyGroup` already accepts or rejects a whole press all or nothing. For a long utterance, prefer a partial-accept plan: apply the legal prefix, stop at the first illegal command, and ask about the rest. (Design choice; the plan does not say this yet.)
- Corrections like "no, a double": either undo the previous group and apply the new one, or emit the existing `correct` command with a target group. Both exist in the Command type (`docs/plan.md`).
- Ask only when ambiguous: the engine's `candidates` already lists legal readings. Ask only if more than one legal reading exists; otherwise save with the banner.

## 6. Prior art (only what their pages say)

- **GameChanger:** search found voice scorekeeping for basketball only; no baseball or softball voice article found. The basketball post URL returned 404, so even that is a search-snippet claim. https://gc.com/post/voice-scorekeeping-for-basketball (404 when fetched); baseball help hub: https://help.gc.com/hc/en-us/articles/360039839812-Scorekeeping-and-Stats
- **iScore Baseball/Softball:** its App Store and review pages describe tap scoring; no voice found. https://apps.apple.com/us/app/iscore-baseball-and-softball/id364364675
- **StatsLine (iOS):** listing says voice input is Beta, "say 'single to left' to record a play", and the developer says recognition runs entirely on device; offline scoring. Developer claims, not independently verified. https://apps.apple.com/us/app/statsline/id6792172829
- **Johns Hopkins student poster:** browser-based hands-free voice scorekeeping for baseball; school project, not read in detail. https://engineering.jhu.edu/designcenter/design-gallery/entry/45504
- Dragon and Apple Dictation: **not researched**; they are general dictation, not command-and-state tools.

Takeaway: no found competitor documents multi-play free speech for baseball. Pretty open ground, but also nothing to copy.

## Options for Sandlot

Rule 6 holds in all four: the model proposes an ordered list of commands, the engine checks each one, and plays that are clear and legal save with a banner and undo.

| | A. Longer hold, many plays | B. Tap to start, tap to stop (talk as long as you like) | C. Play-window mode: mic open during live ball only | D. Hands-free with a wake word |
|---|---|---|---|---|
| How it feels | Same button, but one press can carry "Soto hits Ruiz, Ruiz takes first, next batter ball one". Still holding | One tap opens the mic, speak freely, tap again (or a pause ends it). Thumb is free | Tap once at the start of a half-inning; the app listens until three outs, ends on silence after each phrase, shows each play as it lands | Say "Sandlot" then speak; no hands |
| What it needs | Parser schema returns a list; engine partial-apply; no change to capture | A, plus an end cue (a "listening" bar, a max length) and a tail so the last word is not clipped | Client VAD to cut phrases (the model has none), a reconnect every 60 minutes, minute billing while open | Porcupine or similar native module, AccessKey, a custom phrase, background-mic permissions, all native work |
| Risks | Still not "natural"; long holds are tiring | Forgotten open mic records crowd and children; cost while open | Crowd noise triggers false plays; battery; whole-game privacy concern. Needs a "sandbox" confirm for anything unclear | Highest false-trigger and battery risk; unverified Apple/Android rules; Porcupine React Native support not confirmed on the page |
| Effort before Nov 2 | Small: schema to list, partial-apply, tests (days) | Small to medium: A plus toggle UI and tail (about a week) | Medium to large: client VAD, reconnect, noise tuning (more than a week, and noise unproven) | Large; not recommended before the demo |
| Cost per game | about 4 cents (plan) | slightly more (open time) | up to about $2 per 2-hour game if billed while open (my arithmetic) | same as C plus wake-word license (unverified) |

Suggested order, mine: build the multi-command parse first (it is the same work for A, B, C, and it is what delivers "several plays per breath" and "say it however you want"). Ship B as the visible change, since it fixes the unnatural hold. Treat C as a later experiment once noise tests exist (see `voice-noise-and-capture.md` item 5). Skip D until Apple and Android background-mic rules are read.

## Open items to verify before building

1. Whether `parserSchema` can express an array of command variants under strict mode (read the supported-schemas section of the structured outputs guide, from character 100,000).
2. Whether `gpt-live-transcribe` bills open-but-silent time.
3. Apple HIG and Material guidance on push-to-talk, and mic/background rules, which did not load.
4. Whether GameChanger has any baseball voice feature today (help center search did not show one).
