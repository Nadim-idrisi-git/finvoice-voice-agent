# Voice Financial Agent

A standalone, voice-first financial assistant using synthetic INR records. It provides deterministic analytics, a conversational text fallback, action proposals with confirmation, audit history, and an optional Gemini Live voice adapter. No bank, payment, or subscription provider is connected.

## Run locally

Requirements: Node.js 20+, npm, and MongoDB (optional for the seed command; the app reads its in-memory synthetic fixture).

1. Copy `.env.example` to `.env` and set a unique `SESSION_SECRET`.
2. Run `npm install` and `npm run dev`.
3. Open http://localhost:5173. The API runs on http://localhost:4100.
4. Optional: set `GEMINI_API_KEY` to enable Gemini Live. No provider key is needed for text-based synthetic demo interaction.

The demo identity is explicitly labeled and contains synthetic records. The API returns an error for all `/api/v1` routes in production because real authentication is not implemented. Live voice requires a Gemini API key and is billed by the provider; no paid resources are provisioned by this project. `GEMINI_VOICE` selects a prebuilt voice on the API server.

## Workspace

- `apps/web`: React, JavaScript, Vite, responsive dashboard and assistant.
- `apps/api`: versioned Express API, analytics, tools, actions, Mongo connection, and provider adapter.
- `packages/shared`: shared Zod schemas and domain types.
- `docs`: architecture, security, evaluation, deployment, API, costs, and decision records.

See [ARCHITECTURE.md](docs/ARCHITECTURE.md), [VOICE_ARCHITECTURE.md](docs/VOICE_ARCHITECTURE.md), and [DEPLOYMENT.md](docs/DEPLOYMENT.md). All financial records in this MVP are synthetic. See [SECURITY.md](docs/SECURITY.md) for trust boundaries and [TESTING.md](docs/TESTING.md) for checks.
