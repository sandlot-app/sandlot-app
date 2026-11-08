# Voice capture in noisy stands: what the vendors say

Question: under crowd noise many presses return an empty transcript ("Didn't catch that"), and short releases may lose words. What do the primary sources say, and what could Sandlot change?

Sourcing note. OpenAI and Expo pages were fetched and read. Apple and Android reference pages are JavaScript-rendered and did not load in the research tool, so claims about them are marked **unverified** and need a read of the linked page before anyone relies on them. Deepgram and AssemblyAI claims are limited to what the fetched pages said. Nothing here was measured on a real phone; no benchmark was run.

## 1. What the repo does today

| Setting | Today | Where |
|---|---|---|
| Model | `gpt-live-transcribe` (env `VOICE_TRANSCRIBE_MODEL`) | `supabase/functions/voice-session/index.ts:6` |
| Session type | `transcription`, PCM 24 kHz | `supabase/functions/voice-session/handler.ts:28-32` |
| Language + hints | `languages: ['en']`, `keywords` = scoring words + lineup last names | `handler.ts:33`, word list `handler.ts:8-13` |
| Turn detection | `null` (manual commit) | `handler.ts:34` |
| `noise_reduction` | not set | absent from `handler.ts:28-37` |
| `delay`, `prompt` | not set | absent |
| Commit on release | sends `input_audio_buffer.commit`, waits for final | `apps/mobile/src/voice/realtime.ts:107-115` |
| Phone mic | `useAudioStream({ sampleRate: 24000, channels: 1, encoding: 'int16' })`, no audio-mode or voice-processing call | `apps/mobile/src/voice/voice-service.ts:23-28` |
| Fallback | if the socket gives nothing, the whole clip goes to `voice-parse` and `gpt-transcribe` file transcription | `apps/mobile/src/voice/press.ts:103-110`, `supabase/functions/voice-parse/handler.ts:65-73` |
| Empty result | `if (!clip.bytes) return nothing()`; empty transcript is passed on as heard | `press.ts:97`, `press.ts:85` |
| Pre-socket audio | buffered and replayed once the socket opens | `press.ts:56-58` |

So Sandlot already uses push-to-talk with a manual commit, and does not use `noise_reduction`.

## 2. How OpenAI streaming transcription handles noise

- **`gpt-live-transcribe` has no VAD.** The docs say to omit `turn_detection` or set it to `null`, that the model "doesn't support `server_vad` or `semantic_vad`", and to use client-side VAD to find end of speech. You send `input_audio_buffer.commit` to get the final transcript. https://developers.openai.com/api/docs/guides/realtime-transcription and https://developers.openai.com/api/docs/guides/realtime-vad
- **Server VAD settings exist for other models.** `threshold` (0 to 1, default 0.5, higher needs louder audio and is called out as useful in noise), `prefix_padding_ms` (default 300), `silence_duration_ms` (default 500). https://developers.openai.com/api/reference/resources/realtime/client-events
- **Semantic VAD** scores the words so far to guess whether the speaker is finished; `eagerness` low/medium/high gives max waits of 8 s, 4 s, 2 s. It also is not available for `gpt-live-transcribe`. The only noise advice on the VAD guide is the `threshold` note. https://developers.openai.com/api/docs/guides/realtime-vad
- **`noise_reduction`**: `near_field` (close mics such as headphones) or `far_field` (laptop or conference mics). It filters audio before it reaches VAD and the model, "can reduce false VAD positives and improve model performance"; `null` turns it off. https://developers.openai.com/api/reference/resources/realtime/client-events . The transcription guide I fetched does not mention it, so **whether `gpt-live-transcribe` honors it is not confirmed by the docs read**. Test it before trusting it.
- **Other levers on `gpt-live-transcribe`**: `delay` (`minimal` to `xhigh`; "higher values add audio context and can improve accuracy at the cost of latency"), a `prompt` describing the setting, `keywords` (hints, not guaranteed), `languages`. https://developers.openai.com/api/docs/guides/realtime-transcription
- **What causes an empty transcript.** The docs do not list causes. What they do say: committing an empty buffer is an error (client-events page above), and the production checklist says to track empty, truncated and delayed transcripts separately from word error rate (transcription guide). Likely causes, **inferred, not documented**: speech lost under noise so the model returns nothing; commit sent before the last chunks were appended or before the socket opened; mic start lag clipping the first word. The repo already guards the last two partly (`press.ts:56-58`, `press.ts:99`).
- The fetched docs do not state a minimum buffer length (the reference mentions only the empty-buffer error). A 100 ms minimum that other sources cite was not confirmed here.

## 3. Push-to-talk vs auto-VAD vs tap-to-toggle

| Mode | Maps to the API as | Good in noise | Bad in noise |
|---|---|---|---|
| Hold-to-talk (today) | `turn_detection: null`, append while held, commit on release | The parent defines the turn; crowd noise can't end it early or trigger it | Short taps clip words; hand/thumb is busy; mic start lag eats the first word |
| Auto VAD (server or semantic) | `turn_detection` with `server_vad` or `semantic_vad` | Hands free | **Not supported by `gpt-live-transcribe`.** Would need another model, and a noisy stand can false-trigger or never trigger. Higher `threshold` helps noise (source above) |
| Tap-to-toggle | Same as hold: `null`, append, commit on second tap | No need to keep a thumb down; can add a short tail | Needs an end cue; a forgotten open mic records crowd and costs session time |
| Client-side VAD | Your code decides when to commit | Matches what the docs suggest for this model | You own the tuning |

The OpenAI docs state the mapping but do not compare the modes for outdoor use; the "good/bad" column is reasoning, not a vendor claim.

## 4. On-device noise suppression and voice processing

- **expo-audio** exposes `useAudioStream` with `sampleRate` (default 48000, "actual rate may differ"), `channels`, `encoding`, `onBuffer`. Its audio mode has `allowsRecording` (iOS) and no AVAudioSession mode or voice-processing option; iOS recording options have no voice-processing setting. On Android, file `RecordingOptions` have an `audioSource` (`mic`, `voice_communication`, `voice_recognition`, `unprocessed`, `camcorder`, ...), but the stream hook shows no such option. https://docs.expo.dev/versions/latest/sdk/audio/
- So today Sandlot cannot choose iOS voice processing or an Android audio source through expo-audio's documented stream API. Getting there likely means a small native module or another library (**not researched**).
- **iOS** (unverified, page did not load): `AVAudioSession` modes include `voiceChat` and `measurement`, and Apple's voice-processing I/O unit provides echo cancellation. https://developer.apple.com/documentation/avfaudio/avaudiosession/mode-swift.struct/voicechat . I could not confirm from Apple what processing each mode applies, or whether it helps recognition.
- **Android** (unverified, page did not load): `NoiseSuppressor`, `AcousticEchoCanceler`, `AutomaticGainControl` effects attach to an `AudioRecord` session and may be absent on a device, so check `isAvailable()`. https://developer.android.com/reference/android/media/audiofx/NoiseSuppressor . Source descriptions: https://developer.android.com/reference/android/media/MediaRecorder.AudioSource
- **Helps or hurts ASR?** No vendor source I could read answers this for OpenAI transcription. OpenAI's own `noise_reduction` runs server-side, so doing both is a test, not a given. Treat device DSP as something to A/B on recordings from a real field, not an assumed win.

## 5. Alternatives (only what their docs say)

- **OpenAI `gpt-transcribe`** (already used for the fallback clip): emits deltas, requires WebSocket for streaming, can transcribe after a committed turn; returns `languages`. https://developers.openai.com/api/docs/guides/realtime-transcription . The guide says `gpt-live-transcribe` is recommended and returns no word timestamps, speaker labels, confidence scores or detected language. That means **no confidence value to detect a bad transcript**.
- **Deepgram** Keyterm prompting: up to 100 terms, 500 tokens per request, Nova-3 and Flux only, terms updatable mid-stream. The page makes no noise-robustness claim. https://developers.deepgram.com/docs/keyterm
- **AssemblyAI** streaming: turn messages carry `end_of_turn` and `end_of_turn_confidence`; model shown is `universal-3-6-pro`; `Terminate` finalizes the open turn. The page fetched documents no turn-silence thresholds, keyterms, or noise claims. https://www.assemblyai.com/docs/speech-to-text/streaming
- **Apple SpeechAnalyzer**: page did not load; I can't state requirements, vocabulary support or noise handling. https://developer.apple.com/documentation/speech/speechanalyzer

None of the vendor pages read gives a noisy-environment accuracy number, so there is no primary-source basis for picking a winner on noise alone.

## What this means for Sandlot

1. **Try `noise_reduction: far_field` (then `near_field`) in `voice-session/handler.ts` and compare.** One line. Phone held at chest height in the stands is neither a headset nor a laptop, so test both. First confirm the session accepts it for `gpt-live-transcribe` (the transcription guide is silent).
2. **Raise `delay` and add a `prompt`.** `delay` trades latency for accuracy by design; `prompt` can say "noisy baseball field, short scoring commands". Cheap to try next to option 1.
3. **Stop clipping words on release.** Add a short tail (for example keep the mic and append for a few hundred ms after release) and a short pre-roll before the press. Pure app change in `press.ts`/`voice-service.ts`. Also consider a "min press length" that pads instead of sending a tiny clip.
4. **Fall back on empty, not only on failure.** When the live transcript is empty, resend the buffered clip to `voice-parse` (`gpt-transcribe`) once before saying "Didn't catch that" (`press.ts:103-110` currently only falls back when streaming returned `null`). This is the one change aimed squarely at empty results.
5. **Measure before buying more.** Record real stand audio (the clip is already in memory), replay it against `gpt-live-transcribe` with and without options 1-2, `gpt-transcribe`, and a Deepgram/AssemblyAI trial. Track empty, truncated and slow results separately, as OpenAI's checklist advises. Separately, read the Apple and Android pages above and decide whether a native voice-processing or `voice_recognition` mic source is worth a native module.

## Measuring it (issue #86)

The harness is in `apps/mobile/scripts/voice-loop/` (its README has the commands). `voice-batch` runs every test clip, clean and with crowd noise, with 0, 300 and 600 ms cut off the start, under today's settings, `noise_reduction` far field and near field, a higher `delay` and a short `prompt`. It counts right, name-dropped, wrong, blank and failed results apart, with the time to the final transcript, and prints the tables.

Not run yet: it needs an OpenAI key. The results go here when it has run. Note the API reference lists `delay` for `gpt-realtime-whisper` only, while the transcription guide lists it for `gpt-live-transcribe`, so OpenAI may turn that setting down; the batch reports it if so.
