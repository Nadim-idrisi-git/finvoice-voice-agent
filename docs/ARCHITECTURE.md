# Architecture

## Objective and dependencies

Standalone MVP with deterministic financial answers, user-scoped application actions, and a real-time voice adapter. It has no dependency on a company's backend. The API and web client are separate workspaces; shared Zod contracts live in `packages/shared`.

## Request path

Browser → versioned Express API → demo/session identity middleware → validated agent tool registry → deterministic domain services → synthetic in-memory fixture or Mongo-backed records. Gemini Live credentials remain server-side; live session initialization is authenticated and returns only a short-lived provider token where available. No model-supplied user ID is accepted.

The browser handles the real-time media session and provider-native VAD; server-authorized domain tools are invoked through the application API. User speech can interrupt the live model. The client also invalidates the current playback generation on interruption/disconnect to discard stale output.

## Decisions

- Modular monolith: one API process keeps action authorization and calculations close together.
- Monetary values use integer paise; currency is explicitly INR.
- Synthetic fixture is canonical for the local demo; Mongo is an optional future persistence path and seed target.
- Provider-independent `VoiceProvider` interface keeps voice transport swappable.
- Demo session mode is local-only. Production authentication, persistent multi-tenant identity, and user isolation must be completed before deployment with real users.
- No live bank integration, money movement, external subscription cancellation, or paid resource provisioning.
- The visual layer uses scoped CSS instead of Tailwind. The initial Tailwind dependency tree produced unresolved audit findings; the implemented UI does not need utility-class generation, so removing it reduced dependencies and cleared the audit.

## Boundaries and limits

Text answers are deterministically routed and calculated; there is no claim that an LLM is connected when it is not. Live Gemini audio is optional and requires provider credentials. A real browser-to-provider session and language/speech quality must be tested on supported devices before asserting production voice readiness.
