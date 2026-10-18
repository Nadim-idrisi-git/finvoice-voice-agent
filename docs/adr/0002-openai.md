# ADR 0002: OpenAI for the text agent and live voice

Status: superseded by [ADR 0003](0003-gemini.md). Supersedes [ADR 0001](0001-voice-provider.md).

The project standardises on the OpenAI API, using one provider key for both features:

- **Text agent:** Responses API with function tools. The model chooses tools; the backend executes them for the authenticated user and returns results via `previous_response_id`. Default model `gpt-6-luna` (cost-efficient), configurable via `OPENAI_MODEL`.
- **Live voice:** Realtime API over WebRTC with a server-minted ephemeral client secret. Default model `gpt-realtime-2.1`, voice `marin`, configurable via environment variables.

Both use the same function-tool shape, so a single server-side registry serves text and voice. WebRTC removes custom audio encoding and playback code from the browser, and server-side truncation handles interruption.

A rule-based assistant remains as a no-cost fallback when no key is configured or the provider fails. Model availability and pricing are time-sensitive and must be rechecked before release. No quality benchmark is claimed without a real audio evaluation.
