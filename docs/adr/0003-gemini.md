# ADR 0003: Google Gemini for the text agent and live voice

Status: accepted (2026-10-18). Supersedes [ADR 0002](0002-openai.md).

The project moves from OpenAI to the Gemini API, still with one provider key (`GEMINI_API_KEY`) for both features. Behaviour, prompts, tools, validation, and the rule-based fallback are unchanged.

- **Text agent:** `generateContent` with function calling. Default model `gemini-3.8-flash` with thinking level `low` (`GEMINI_MODEL`, `GEMINI_THINKING_LEVEL`). Gemini is stateless, so the backend keeps each user's recent conversation (model turns verbatim, since Gemini 3 requires their thought signatures) instead of chaining `previous_response_id`.
- **Live voice:** Live API over a WebSocket with `gemini-3.8-live` (native audio, GA) and voice `Kore` (`GEMINI_LIVE_MODEL`, `GEMINI_VOICE`). The backend mints a single-use ephemeral token with the whole setup locked in. Because there is no WebRTC, the browser now encodes 16 kHz PCM and plays 24 kHz PCM itself.

**Why these models.** On the 35-case eval suite (23 English, 10 Hinglish, 2 Hindi), measured 2026-10-18:

| Text model | Passed | Hinglish | Hindi | p50 latency |
|---|---|---|---|---|
| gpt-6-luna (previous baseline, 2026-10-17) | 35/35 | 10/10 | 2/2 | 5.5 s |
| gemini-3.8-flash, thinking low (3 runs) | 35, 32, 35 | 10/10 every run | 2/2 every run | 4.2–5.1 s |
| gemini-3.8-flash, thinking medium | 34 | 10/10 | 2/2 | 6.4 s |
| gemini-3.8-flash, default (high), 2 runs | 34, 32 | 10/10, 8/10 | 2/2, 1/2 | 6.9–8.6 s, 30 s timeouts |
| gemini-pro-latest | 31 | 8/10 | 1/2 | 13.9 s, 30 s timeouts |

Most non-low failures are timeouts falling back to rules, or correct refusals phrased in a way the eval's refusal regex does not match. For voice, `gemini-3.8-live` is Google's default low-latency Live model and lists Hindi among supported languages; native-audio models switch language on their own, which suits code-mixed Hinglish. In the typed smoke call it stayed in Hinglish, spoke amounts in Hindi number words, and passed the validator. Google publishes no Hinglish benchmark, and real-microphone quality still needs a listening test.

Model availability changes; names are configurable and must be rechecked before release.
