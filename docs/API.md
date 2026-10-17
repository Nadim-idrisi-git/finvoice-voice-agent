# API

Base path: `/api/v1`. `GET /health` is a process health probe reporting database, store, and voice configuration status.

**Read models** (owner-scoped, synthetic): `GET /session`, `/dashboard`, `/analytics/summary`, `/analytics/categories`, `/analytics/month?month=YYYY-MM`, `/analytics/compare`, `/analytics/merchants`, `/analytics/unusual`, `/subscriptions`, `/bills`, `/emis`, `/audit`, `/reminders`, `/alerts`.

**Actions:** `GET /actions` lists actions. `POST /actions` creates a proposal (`reminder`, `spending_alert`, `report`, `subscription_workflow`). `POST /actions/:id/confirm` with `{ "confirmation": true }` confirms that exact proposal; repeating it is idempotent.

**Assistant:** `POST /assistant/message` accepts `{ message }` (1–1200 characters) and returns a deterministic, grounded answer; reminder or alert requests also return an `actionProposal`.

**Voice:** `POST /voice/session` returns a short-lived provider token plus the `systemInstruction`, `tools`, `model`, `voice`, and `apiVersion` the client must use (503 when no key is configured; rate limited to 3/minute). `POST /tools/:name` with `{ args }` runs one registered voice tool and returns `{ result, proposesAction }`. Unknown tools return 404 and invalid arguments 400. Tool results add a formatted INR string beside every amount (`totalPaise` → `totalRupees`) so the model never converts paise when speaking; action tools only create proposals.

Amounts are integer paise. Requests use Zod validation, a 24 KB body limit, request IDs, a 60/minute rate limit, and a central error handler (`HttpError` messages are returned; other errors return a generic 500). Demo session authorization is local-only and must be replaced before production.
