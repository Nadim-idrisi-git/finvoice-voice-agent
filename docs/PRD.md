# Product requirements

## MVP goal

Give one local demo user a responsive, voice-first way to ask about synthetic INR financial records, inspect deterministic results, and explicitly confirm a small set of in-app actions.

## Users and workflows

- Ask questions in English, Hindi, or Hinglish by text; an OpenAI agent answers using tools over the records, with a rule-based fallback; live voice through ElevenLabs (speech-to-text and voice) with every answer validated before it is spoken.
- Review monthly totals, categories, recurring-payment candidates, upcoming bills, EMI dates, and unusual-spend candidates.
- Propose and confirm reminders or spending alerts; inspect the resulting action history.
- Switch to text when voice is unavailable.

## Data and safety

All current records are clearly identified as synthetic. No actual bank connection, transfer, external notification, or subscription cancellation exists. Monetary amounts use integer paise and are displayed as INR. Unusual transaction results are candidates, never fraud conclusions. Production access is fail-closed because production authentication and durable tenant isolation are not implemented.

## MVP acceptance state

Verified locally: frontend build, backend and frontend tests (including the agent tool-calling loop against a fake OpenAI), and rendered UI at desktop, tablet, and phone widths. Pending: authenticated multi-user data access, runtime Mongo persistence, live OpenAI key/device integration, Hindi/Hinglish audio quality checks, voice interruption measurements, and deployment verification. See `VOICE_EVALUATION.md` and `DEPLOYMENT.md`.
