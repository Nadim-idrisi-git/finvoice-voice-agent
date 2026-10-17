# ADR 0001: Gemini Live as primary voice provider

Status: accepted for MVP adapter; live experience pending credential/device validation.

The official Live API documentation describes real-time bidirectional native audio, multilingual support, tool use, and VAD that cancels ongoing generation on interruption. These align with required Hindi/Hinglish and barge-in behavior. OpenAI Realtime is also a credible alternative with WebRTC and native cancellation, but the current MVP picks one provider rather than duplicating every request. Provider pricing and exact model availability are time-sensitive and must be rechecked before live use. No benchmark or quality superiority is claimed without a configured comparative evaluation.
