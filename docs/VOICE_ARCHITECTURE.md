# Voice architecture

Provider: **ElevenLabs for voice only** (speech-to-text and text-to-speech). The answer itself comes from the backend OpenAI agent, so every spoken reply passes the same grounding tools and answer validator as text chat **before** it is spoken. See [ADR 0003](adr/0003-elevenlabs-voice.md).

## Turn pipeline

1. **Listen.** The browser keeps the microphone open (echo cancellation, noise suppression) and runs voice-activity detection on an `AnalyserNode`: speech starts after ~120 ms above the level threshold and ends after ~900 ms of quiet. Each utterance is recorded with `MediaRecorder` (webm/opus).
2. **Transcribe.** `POST /api/v1/voice/transcribe` (raw audio, ≤5 MB). The backend calls ElevenLabs `POST /v1/speech-to-text` with `model_id = ELEVENLABS_STT_MODEL` (default `scribe_v2`); the language (Hindi or English) is detected automatically.
3. **Answer.** `POST /api/v1/assistant/message` with `channel: "voice"`: the OpenAI agent calls tools, the validator checks every amount and success claim, and the answer is shortened for speech. The response carries a `speechId`.
4. **Speak.** The browser plays `GET /api/v1/voice/speech/:speechId`. The backend streams ElevenLabs `POST /v1/text-to-speech/{voice}/stream` (`ELEVENLABS_TTS_MODEL`, default `eleven_flash_v2_5`, MP3) straight through. Only answers this server produced can be spoken, and only to their owner.
5. **Open the call.** On start the browser sends "The call has started." and the agent greets the user with the top findings.

## Interruption

While the assistant is speaking or thinking, sustained speech (~250 ms, higher threshold to ignore echo) stops playback immediately, increments a generation counter so any in-flight transcript/answer/audio from the old turn is discarded, and starts recording the new utterance. Stopping audio never undoes an action the backend already recorded. Headphones give the cleanest barge-in.

## Fallbacks (Web Speech API)

- If ElevenLabs text-to-speech fails (plan, quota, network), the browser reads the **same validated answer** with `speechSynthesis`.
- If ElevenLabs speech-to-text is rejected, the call switches to the browser's `SpeechRecognition` (Chrome) for the rest of the session.

Fallbacks never change what is said, only who says it.

## Configuration

`ELEVENLABS_API_KEY` (needs **Text to Speech** and **Speech to Text** permissions, plus **Voices: read** if `ELEVENLABS_VOICE_ID` is empty), `ELEVENLABS_VOICE_ID` (empty = the account's first premade voice; Voice Library voices require a paid plan), `ELEVENLABS_TTS_MODEL`, `ELEVENLABS_STT_MODEL`. The key never reaches the browser.

## Not yet measured

End-to-end turn latency (STT + agent ≈ 4 s p50 in text evaluation + TTS first byte), interruption latency, transcription accuracy for Hindi/Hinglish, and voice naturalness. These need live calls.

References: [Speech to text API](https://elevenlabs.io/docs/api-reference/speech-to-text/convert), [Models](https://elevenlabs.io/docs/overview/models).
