# Product requirements

## MVP goal

Give one local demo user a responsive, voice-first way to ask about synthetic INR financial records, inspect deterministic results, and explicitly confirm a small set of in-app actions.

## Users and workflows

- Ask questions in English, Hindi, or Hinglish by text; optional Gemini Live voice when credentials are configured.
- Review monthly totals, categories, recurring-payment candidates, upcoming bills, EMI dates, and unusual-spend candidates.
- Propose and confirm reminders or spending alerts; inspect the resulting action history.
- Switch to text when voice is unavailable.

## Data and safety

All current records are clearly identified as synthetic. No actual bank connection, transfer, external notification, or subscription cancellation exists. Monetary amounts use integer paise and are displayed as INR. Unusual transaction results are candidates, never fraud conclusions. Production access is fail-closed because production authentication and durable tenant isolation are not implemented.

## MVP acceptance state

Verified locally: frontend/API build, deterministic calculation and API tests, browser text interaction, prior-month analytics, and in-app reminder proposal/confirmation. Pending: authenticated multi-user data access, runtime Mongo persistence, live Gemini key/device integration, Hindi/Hinglish audio quality checks, voice interruption measurements, and deployment verification. See `VOICE_EVALUATION.md` and `DEPLOYMENT.md`.
