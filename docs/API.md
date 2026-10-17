# API

Base path: `/api/v1`. `GET /health` is a process health probe; `GET /api/v1/session` identifies the local demo principal. `GET /api/v1/dashboard`, `/analytics/summary`, `/analytics/categories`, `/analytics/compare`, `/subscriptions`, `/bills`, `/emis`, and `/actions` expose synthetic user-scoped read models. `POST /assistant/message` accepts a validated text message and returns a grounded result. `POST /actions` creates a proposal; `POST /actions/:id/confirm` confirms that exact proposal. `POST /voice/session` initializes the optional live provider session.

Requests use Zod validation, bounded payloads, request IDs, and centralized errors. Demo session authorization is local-only and must be replaced before production.
