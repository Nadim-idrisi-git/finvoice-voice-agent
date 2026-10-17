# Capacity: assumptions for 5 million users

**Status: not load-tested. No capacity claim is made.** This document sets the workload assumptions and lists what must change before any claim.

## Workload assumptions (to validate with real usage)

| Assumption | Value | Basis |
| --- | --- | --- |
| Registered users | 5,000,000 | Target |
| Daily active users | 5% → 250,000 | Typical for a weekly money-call product |
| Voice sessions per DAU per day | 0.3 (weekly call + occasional checks) | → 75,000 sessions/day |
| Peak concurrency factor | 10% of the day's sessions in the busiest hour, 4-minute sessions | → ~500 concurrent voice sessions at peak |
| Turns per session | 8 | → ~2 tool calls per turn |
| Text messages | 0.5 per DAU per day | → 125,000/day, ~15/s at peak |
| Backend requests at peak | ~500 sessions × 2 tool calls / 15 s turn ≈ 70 req/s, plus text ≈ 100 req/s | |

Audio passes through the backend in both directions (utterance upload to ElevenLabs speech-to-text, streamed MP3 back), about 30–60 KB per utterance and ~16 KB/s of playback per active call. At ~500 concurrent calls that is roughly 8 MB/s of streamed audio, so speech endpoints need their own instances or a streaming-friendly proxy. Provider limits: ElevenLabs concurrency and character quota, and OpenAI rate limits.

## What blocks horizontal scaling today

- **In-process state:** actions, reminders, audit, text-chat memory (`lastResponse`, `lastEvidence`), tool-call idempotency, voice validation results, and rate-limit counters live in memory. Multiple instances would disagree. Move these to MongoDB (actions/audit, with unique indexes on action id and `{ownerId, callId}`) and a shared store for rate limits and short-lived session state.
- **Per-user data:** the store holds one demo profile in memory. Production needs per-user facts in MongoDB with indexes on `{ownerId, at}` and `{ownerId, type, at}`, ingestion as a background job, and real authentication.
- **Provider quotas:** OpenAI rate limits must be raised and monitored; add a circuit breaker so outages fall back to the rule-based assistant (already the behaviour on errors) without retry storms.

## Load test plan

Ramp to 2× the peak assumption (200 req/s mixed tool calls and text) with k6 or autocannon against staging; include slow-OpenAI and OpenAI-error scenarios, long voice sessions, and bursts. Record p50/p95/p99 latency, error rate, memory, event-loop lag, and MongoDB pool usage. Only after this passes can a capacity figure be stated.
