# API

Base path: `/api/v1`. `GET /health` is a process health probe; `GET /api/v1/session` identifies the local demo principal. `GET /api/v1/dashboard`, `/analytics/summary`, `/analytics/categories`, `/analytics/compare`, `/subscriptions`, `/bills`, `/emis`, and `/actions` expose synthetic user-scoped read models. `POST /assistant/message` accepts a validated text message and returns a grounded result. `POST /actions` creates a proposal; `POST /actions/:id/confirm` confirms that exact proposal. `GET /analytics/month?month=YYYY-MM`, `/analytics/merchants`, `/analytics/unusual`, `/audit`, `/reminders`, and `/alerts` are also available. `POST /voice/session` initializes the optional live provider session and returns the system instruction and tool declarations the client must use, so the voice contract is defined once on the server.

Amounts are integer paise (`*Paise`). Endpoints called by voice tools (`/analytics/summary`, `/analytics/categories`, `/analytics/compare`, `/analytics/merchants`, `/analytics/unusual`, `/subscriptions`, `/bills`, `/emis`) also return a formatted INR string beside each amount (`totalPaise` → `totalRupees`), so the model never has to convert paise when speaking.

Requests use Zod validation, bounded payloads, request IDs, and centralized errors. Demo session authorization is local-only and must be replaced before production.
