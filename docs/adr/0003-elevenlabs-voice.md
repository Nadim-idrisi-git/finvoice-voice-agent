# ADR 0003: ElevenLabs for voice, OpenAI for reasoning

Status: accepted. Supersedes the voice part of [ADR 0002](0002-openai.md).

Voice moves from OpenAI Realtime (speech-to-speech) to a pipeline: ElevenLabs Scribe speech-to-text → backend OpenAI agent → ElevenLabs streaming text-to-speech.

**Why.** With speech-to-speech, the model's words are heard before anything can check them. In the pipeline, every spoken answer is produced by the same agent as text chat and passes the deterministic validator (amounts must match tool results, no unconfirmed success claims, no unchecked "not found") **before** it is spoken. ElevenLabs offers strong Hindi/Hinglish voices and is the event's recommended voice stack.

**Trade-offs.** Higher turn latency than speech-to-speech (transcription + agent + synthesis), interruption handled in the browser by voice-activity detection instead of server-side VAD, and audio now passes through the backend (bandwidth). Web Speech API fallbacks keep the call working if ElevenLabs is unavailable.
