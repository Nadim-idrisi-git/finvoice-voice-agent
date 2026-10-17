# Voice architecture

Provider: OpenAI Realtime API over WebRTC (see [ADR 0002](adr/0002-openai.md)).

**Session setup.** The browser calls `POST /api/v1/voice/session`. The backend calls `POST https://api.openai.com/v1/realtime/client_secrets` with the long-lived key and a session config: `type: "realtime"`, `model` (`OPENAI_REALTIME_MODEL`, default `gpt-realtime-2.1`), `instructions`, the shared tool definitions, `audio.input.transcription.model` (`OPENAI_TRANSCRIBE_MODEL`), `audio.input.turn_detection: { type: "semantic_vad" }`, and `audio.output.voice` (`OPENAI_VOICE`, default `marin`). The secret expires after 10 minutes. Only the ephemeral `value` reaches the browser.

**Media.** The browser creates an `RTCPeerConnection`, adds the microphone track (echo cancellation, noise suppression, auto gain), creates the `oai-events` data channel, and posts its SDP offer to `https://api.openai.com/v1/realtime/calls` with `Authorization: Bearer <ephemeral key>`. Model audio arrives as a remote track played by an `<audio>` element. There is no client-side PCM encoding or playback queue.

**Events → UI state.** `input_audio_buffer.speech_started` → `USER_SPEAKING` (via `INTERRUPTED` if the assistant was speaking); `speech_stopped` → `PROCESSING`; `output_audio_buffer.started` → `ASSISTANT_SPEAKING`; `output_audio_buffer.stopped`/`cleared` → `LISTENING`. Transcripts come from `conversation.item.input_audio_transcription.completed` and `response.output_audio_transcript.done`. The state machine in `frontend/src/services/voiceState.js` rejects impossible jumps.

**Interruption.** Over WebRTC the server tracks how much audio has played and truncates unplayed audio when the user starts speaking; the client does not need to cancel playback.

**Tools.** On `response.done`, every `function_call` output item is forwarded to `POST /api/v1/tools/:name`. The result is sent back with `conversation.item.create` (`type: "function_call_output"`, matching `call_id`), followed by one `response.create`. Action tools only create proposals; the UI shows a notice to confirm them.

**Teardown.** Ending the session closes the data channel and peer connection and stops microphone tracks. Connection loss shows an error; starting voice again mints a fresh key. Automatic resumption is not implemented.

Model names, event names, and voices change over time; they are configurable and must be verified against current OpenAI docs before release. Naturalness and Hindi/Hinglish quality remain unevaluated until tested with real audio (see `VOICE_EVALUATION.md`).

References: [Realtime WebRTC](https://developers.openai.com/api/docs/guides/realtime-webrtc), [Realtime conversations](https://developers.openai.com/api/docs/guides/realtime-conversations), [Create client secret](https://developers.openai.com/api/reference/resources/realtime/subresources/client_secrets/methods/create).
