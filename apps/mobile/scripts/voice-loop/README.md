# Voice loop

Streams recorded clips through the phone's own live transcription client (`src/voice/realtime.ts`), paced like a real press, and says whether the transcript came back right, name-dropped, wrong or blank, and how long the final transcript took. It measures what helps transcription in noisy stands (issue #86). The results go in `docs/research/voice-noise-and-capture.md`.

## Rules

- Nothing printed holds a transcript, a player name, audio or a key (`AGENTS.md` rule 5). A run leaves a verdict and a time.
- Audio stays out of git unless Christian OKs it. `.gitignore` in this folder blocks `*.pcm`, `*.aiff`, `*.wav` and `audio/`.
- The key comes from `OPENAI_API_KEY` in the environment, for one command. Never put it in a file.

## The clips

Four phrases (`ball`, `nguyen-walks`, `darcy-singles`, `soto-hits-ruiz`), each as `<name>.clean.pcm` and `<name>.noisy.pcm` (crowd babble plus pink noise). The words each clip says are in `CLIPS` in `clips.ts`.

The loop looks for them in `--clips <folder>`, then `$SANDLOT_VOICE_CLIPS`, then `~/Downloads/sandlot-voice-clips/`, which is outside the repo. To make them again (a Mac with ffmpeg):

```sh
apps/mobile/scripts/voice-loop/make-clips.sh            # into ~/Downloads/sandlot-voice-clips/
apps/mobile/scripts/voice-loop/make-clips.sh <folder>   # or anywhere else
```

The clean clips come out byte for byte the same each time. The noisy ones use the same babble but a fresh draw of the pink noise, so keep the saved copy if you want to compare against an earlier run.

## Measure the settings

`batch.ts` runs every clip, clean and noisy, with 0, 300 and 600 ms cut off the start, under each setting, straight against OpenAI. It asks for the same session as `voice-session` (it calls `startSession` from `supabase/functions/voice-session/handler.ts`) and adds only the setting's flags. Settings are in `settings.ts`:

| Setting | What it adds to the session |
|---|---|
| `today` | nothing: what `voice-session` sends now |
| `far_field` | `audio.input.noise_reduction = { type: 'far_field' }` |
| `near_field` | `audio.input.noise_reduction = { type: 'near_field' }` |
| `delay_high` | `audio.input.transcription.delay = 'high'` |
| `prompt` | `audio.input.transcription.prompt`, a line about a noisy youth baseball field |

```sh
OPENAI_API_KEY=<your key> pnpm --filter @sandlot/mobile voice-batch > ~/Downloads/voice-noise-results.md
```

Run it from the repo root. It prints progress to the terminal (no clip names, no words) and the markdown tables to the file. All 5 settings, 4 phrases, 2 noises and 3 cuts is 120 runs of about 5 seconds each, so allow about 10 minutes. Options: `--repeats <n>` (transcripts vary, so 3 is better), `--settings today,far_field`, `--cuts 0,300,600`, `--clips <folder>`, `--chunk-ms <n>`, `--model <name>`.

Without a key it says so and stops before reading any clip.

Reading the tables: `right` has every word, in order (crowd chatter around it is fine); `name-dropped` has the other words but not a player's name (a misheard name counts too); `wrong` is some other words; `blank` is nothing, or only filler according to the phone's local reader; `failed` means a session opened but its stream produced no final transcript; `no-session` means a session could not be started. Times are milliseconds from the release to the final transcript.

The stream uses the phone's five-second final-transcript wait. A correct transcript arriving later counts as `failed`, including for `delay_high`. The Node harness authenticates its WebSocket with a client-secret subprotocol; the phone's native WebSocket uses an Authorization header.

Only a 400 `unknown_parameter` or `invalid_value` reply naming an experimental field that the setting actually supplied removes that setting from the comparison. The batch prints the status, code and field and skips its remaining runs. A 401 or 403 stops the batch with exit 2 and an authentication diagnostic. Other session-start failures, including 408, 409, 429 and server failures, count as `no-session`; the remaining cases still run.

## One clip

```sh
OPENAI_API_KEY=<your key> pnpm --filter @sandlot/mobile voice-loop ~/Downloads/sandlot-voice-clips/nguyen-walks.noisy.pcm --direct --noise-reduction far_field --cut-start-ms 600
```

Prints one JSON line. `--direct` asks OpenAI itself; `--noise-reduction`, `--delay` and `--prompt` need it. Without `--direct` the loop uses the deployed `voice-session`, like the phone, and needs `ENV_FILE=apps/mobile/.env.local` (it signs in as a new anonymous user and keeps the token in `.token.json`, which git ignores). Exit 0 for right, 1 for anything else, 2 for misuse, 3 when no session started.

Hosted mode uses its own anonymous identity, not the phone's scorer identity. Once #77's scorer authorization is deployed, hosted mode requires that identity to be provisioned as a current scorer. A 403 is expected otherwise. Use direct mode for noise-setting comparisons; do not relax the endpoint's scorer check to make this tool work.

A batch exit code alone does not prove a successful measurement. Check the `failed` and `no-session` counts and missing timings in its tables before comparing settings.

`phrases.ts` prints how the phone's parser reads what the transcriber might return for these phrases.
