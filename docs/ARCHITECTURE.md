# Architecture

## Objective and stack

Standalone MVP with deterministic financial answers, an OpenAI agent that grounds every amount in tool results, user-scoped confirm-before-execute actions, and real-time voice. Two independent apps, each with its own `package.json`:

- **frontend/**: React, Tailwind CSS, JavaScript; built with Vite; deployed to Vercel.
- **backend/**: Node.js, Express, MongoDB (Mongoose seed target); OpenAI Responses API and ElevenLabs speech APIs over `fetch`; deployed to Render.

Runtime dependencies are deliberately few: `express`, `cors`, `dotenv`, `mongoose` on the backend; `react`, `react-dom` on the frontend (plus `vite` and `tailwindcss` at build time). Validation, logging, security headers, rate limiting, icons, and tests are written with the platform (Node's `node:test`, inline SVG) rather than extra libraries.

## Layout

```text
backend/src
  index.js             Server entry: load config, build the app, optional Mongo health connection, listen
  app.js               createApp({ config, store, log, fetch }): middleware, demo identity, routers, error handler
  config.js            Environment validation, once at startup
  http.js              HttpError: errors whose message is safe to return to clients
  lib/format.js        Money and month helpers (integer paise → INR)
  lib/validate.js      Request validators
  middleware/          Security headers, in-memory rate limiter, request id + logging
  store/memory.js      In-memory, owner-scoped store (transactions, bills, EMIs, actions, reminders, alerts, audit)
  store/finance.js     loadFinance(store, ownerId): the read model analytics, tools and rules consume
  services/openai.js   Minimal OpenAI REST client (Responses API)
  services/elevenlabs.js ElevenLabs speech-to-text (Scribe) and streaming text-to-speech
  services/tools.js    Tool registry shared by the text agent and voice: definitions, validation, execution
  services/agent.js    Text agent: Responses API tool-calling loop
  services/validator.js Deterministic answer validation (amounts, success claims, unchecked 'not found')
  services/prompts.js  System instructions for text and voice
  services/actions.js  Proposal → explicit confirmation → in-app execution, with audit events
  modules/analytics.js Pure, deterministic money calculations
  modules/rules.js     Rule-based English/Hindi/Hinglish fallback assistant
  routes/              finance (read models), actions, assistant (text, tools, voice session)
  data/                Synthetic seed fixture and Mongoose models
backend/test           node:test suites; OpenAI is replaced by a fake fetch

frontend/src
  App.jsx              Shell: dashboard loading, navigation, notices, action handlers
  hooks/useAssistant   Conversation and live-voice state
  components/          Sidebar, AssistantPanel, ReminderModal, PageHeading, Icon (inline SVG)
  pages/               Overview, Analytics, Subscriptions, Upcoming, Actions, Settings
  services/api.js      REST client for /api/v1
  services/voice.js    Voice call: activity detection, ElevenLabs STT/TTS via the backend, interruption, Web Speech fallbacks
  services/voiceState  Voice lifecycle state machine
  lib/                 format, chart helpers, shared Tailwind class strings
  index.css            Tailwind import and theme tokens (colours, fonts, breakpoints)
```

## Request paths

**Text:** browser → `POST /api/v1/assistant/message` → demo identity sets `res.locals.user` → if `OPENAI_API_KEY` is set, `runAgent` sends the message and tool definitions to the Responses API; for each function call the backend runs the tool for that user and returns the result with `previous_response_id`, up to four rounds, then returns the model's answer. Without a key, or if OpenAI fails, `modules/rules.js` answers deterministically. Reminder or alert requests become proposals through the action service in both paths.

**Voice:** each utterance → `POST /api/v1/voice/transcribe` (ElevenLabs Scribe) → `POST /api/v1/assistant/message` with `channel: "voice"` (same agent and validator as text) → `GET /api/v1/voice/speech/:id` (ElevenLabs TTS stream of that validated answer). Interruption stops playback and discards stale turns in the browser. See `VOICE_ARCHITECTURE.md`.

In both paths the model never sees an owner ID or chooses an endpoint; tools are executed server-side for the authenticated user, and results add `*Rupees` strings beside `*Paise` amounts.

## Decisions

- Modular monolith backend: action authorization and calculations stay close together.
- Dependencies are injected into `createApp`, so tests build isolated apps with a fake OpenAI and a persistent store can be swapped in without touching routes.
- The store interface is async and owner-scoped; a MongoDB implementation of the same interface is the path to durable multi-user data.
- Money is integer paise in INR. Amount facts always come from tools; prompts forbid guessing.
- One tool registry, one tool format (OpenAI function tools), used by both the text agent and voice.
- Unusual-spend candidates: an expense above 4× the median of the other expenses in its category (at least 2 others). Candidates, never fraud findings.
- Demo identity is local-only; `/api/v1` fails closed with 503 in production until real authentication exists.
- No bank integration, money movement, external cancellation, or paid resource provisioning.

## Boundaries and limits

The rule-based fallback is deterministic; the agent's wording comes from the model but its numbers come from tools. Live voice requires an OpenAI key and has not yet been exercised end-to-end with real audio; model names are configurable because availability changes.
