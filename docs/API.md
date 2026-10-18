# API

Base path: `/api/v1` on the backend (default `http://localhost:4100`). `GET /health` reports database, store, and whether Gemini is configured.

**Read models** (owner-scoped, synthetic): `GET /session`, `/dashboard`, `/analytics/summary`, `/analytics/categories`, `/analytics/month?month=YYYY-MM`, `/analytics/compare`, `/analytics/merchants`, `/analytics/unusual`, `/subscriptions`, `/bills`, `/emis`, `/audit`, `/reminders`, `/alerts`.

**Actions:** `GET /actions` lists actions. `POST /actions` with `{ type, title, details }` creates a proposal (`reminder`, `spending_alert`, `report`, `subscription_workflow`; title 3–100 and details 3–500 characters). `POST /actions/:id/confirm` with `{ "confirmation": true }` confirms that exact proposal; repeating it is idempotent.

**Assistant:** `POST /assistant/message` with `{ message }` (1–1200 characters) returns:

```json
{
  "answer": "Your next bill is Electricity for ₹2,350, due 21 October…",
  "source": "gemini",
  "actionProposal": null,
  "actionProposals": [],
  "toolsUsed": ["get_upcoming_bills"],
  "synthetic": true,
  "requestId": "…"
}
```

`source` is `gemini` when the agent answered and `rules` for the fallback (which also returns `intent` and `data`). Rate limited to 20/minute.

**Voice:** `POST /voice/session` returns `{ token, expiresAt, model, voice, liveUrl }` for a browser WebSocket session with the Gemini Live API (503 without `GEMINI_API_KEY`; 3/minute). `voice` in the body picks one of `Kore`, `Aoede`, `Leda`, `Zephyr`, `Puck`, `Charon`, `Orus`, `Fenrir`. `POST /tools/:name` with `{ args }` runs one registered tool and returns `{ result, proposesAction }`; unknown tools return 404 and invalid arguments 400. Results add a formatted INR string beside every amount (`totalPaise` → `totalRupees`). Action tools only create proposals.

Tools: `get_spending_summary`, `get_category_breakdown`, `compare_monthly_spending`, `find_recurring_subscriptions`, `get_upcoming_bills`, `get_emi_schedule`, `get_unusual_spending`, `create_reminder`, `configure_spending_alert`, `prepare_subscription_action`.

All requests have a 24 KB body limit, an `X-Request-Id`, security headers, a 60/minute global rate limit, and a central error handler (`HttpError` messages are returned; anything else is a generic 500). Demo identity is local-only and must be replaced before production. A Postman collection can be built directly from these routes.
