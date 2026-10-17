# Architecture

## Objective and dependencies

Standalone MVP with deterministic financial answers, user-scoped application actions, and a real-time voice adapter. It has no dependency on a company's backend. The API and web client are separate npm workspaces; shared contracts and helpers live in `packages/shared`.

## Layout

```text
packages/shared/src
  index.js            Zod request schemas (message, action, confirmation); re-exports format.js
  format.js           Dependency-free money and month helpers (formatRupees, currentMonth, previousMonth, monthName)

apps/api/src
  index.js            Server entry: load config, build the app, optional Mongo health connection, listen
  app.js              createApp({ config, store, log, fetch }): middleware, demo identity, routers, error handler
  config.js           Environment validation (Zod), done once at startup
  http.js             HttpError: errors whose message is safe to return to clients
  store/memory.js     In-memory, owner-scoped store (transactions, bills, EMIs, actions, reminders, alerts, audit)
  store/finance.js    loadFinance(store, ownerId): the read model analytics and the assistant consume
  services/actions.js Proposal → explicit confirmation → in-app execution, with audit events
  services/tools.js   Voice tool registry: declarations, Zod argument validation, execution, rupee formatting
  services/voice.js   System instruction and ephemeral Gemini Live token minting
  modules/analytics.js Pure, deterministic money calculations on integer paise
  modules/agent.js    Rule-based English/Hindi/Hinglish intent routing over analytics results
  routes/             finance (read models), actions, assistant (text, tools, voice session)
  data/               Synthetic seed fixture and Mongoose models (seed target)

apps/web/src
  App.jsx             Shell: dashboard loading, navigation, notices, action handlers
  hooks/useAssistant  Conversation and live-voice state
  components/         Sidebar, AssistantPanel, ReminderModal, PageHeading
  pages/              Overview, Analytics, Subscriptions, Upcoming, Actions, Settings
  services/api.js     Fetch client for /api/v1
  services/voice.js   Gemini Live session, audio I/O, voice state machine
  lib/chart.js        Sparkline and donut helpers
```

## Request paths

**Text:** browser → `POST /api/v1/assistant/message` → demo identity middleware sets `res.locals.user` → `loadFinance(store, user.id)` → `answerFinancialQuestion` (deterministic analytics) → JSON answer. Reminder/alert requests become proposals through the action service.

**Voice:** browser → `POST /api/v1/voice/session` → server mints a single-use, short-lived token locked to the model, system instruction and tool declarations, and returns them to the client. The browser streams audio directly to Gemini Live. When the model calls a tool, the browser forwards the call to `POST /api/v1/tools/:name`; the server validates the name and arguments, scopes data to the authenticated user, and returns results with `*Rupees` strings beside `*Paise` amounts. The client never chooses endpoints or owner IDs, and no model-supplied user ID is accepted.

User speech can interrupt the live model. The client invalidates the current playback generation on interruption or disconnect to discard stale output.

## Decisions

- Modular monolith: one API process keeps action authorization and calculations close together.
- Dependencies are injected into `createApp`, so tests build isolated apps and a persistent store can be swapped in without touching routes.
- The store interface is async and every method takes an owner ID. The in-memory implementation is canonical for the demo; a MongoDB implementation of the same interface is the path to durable, multi-user data.
- Monetary values use integer paise; currency is explicitly INR. Formatting lives in `@finance-agent/shared/format` and is used by both API and web.
- Unusual-spend candidates: an expense is flagged when it exceeds 4× the median of the other expenses in its category (at least 2 others required). Results are review candidates, never fraud determinations.
- The voice contract (instruction, tools, API version) is defined once, on the server.
- Demo session mode is local-only; `/api/v1` fails closed with HTTP 503 in production. Production authentication, persistent multi-tenant identity, and user isolation must be completed before deployment with real users.
- No live bank integration, money movement, external subscription cancellation, or paid resource provisioning.
- The visual layer uses scoped CSS instead of Tailwind. The initial Tailwind dependency tree produced unresolved audit findings; removing it reduced dependencies and cleared the audit.
- Source is formatted with Prettier (`npm run format`).

## Boundaries and limits

Text answers are deterministically routed and calculated; no LLM is involved in text mode. Live Gemini audio is optional and requires provider credentials. A real browser-to-provider session and language/speech quality must be tested on supported devices before asserting production voice readiness.
