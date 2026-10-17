# Release readiness

## Local verification

- Tests: passed (37 backend, 5 frontend) with Node's built-in test runner. OpenAI is replaced by a fake fetch, so the agent tool loop, fallback, and Realtime session minting are tested without network access.
- Backend syntax check and frontend production build: passed.
- Rendered UI checked at 1440px, 900px, and 390px widths.
- Dependency audit: 0 vulnerabilities in both apps.
- Not run in this layout: browser end-to-end tests (removed with Playwright), live OpenAI calls, and the Mongo seed.

## Accuracy controls (added 2026-10-17)

- Text answers validated before display (amounts exact-match tool results; success claims need a confirmed action; "not found" needs a lookup), one corrective retry, then abstention.
- Voice answers validated right after speaking, with spoken self-correction.
- Evaluation suite: 22 cases, latest run 22/22 and 12/12 critical; see `EVALUATION.md` for the full run history, including failures.

## Included

- Responsive finance dashboard, transaction and analytics views, deterministic text assistant, and confirmation-gated demo actions.
- OpenAI text agent with server-side tool calling and a rule-based fallback.
- Optional OpenAI Realtime voice over WebRTC with a short-lived server-issued key and explicit UI state handling.
- Synthetic INR data, request validation, local docs, starter Render/Vercel configuration, and CI workflow.

## Required before real users

- Implement and review real authentication, session/CSRF protections, authorization, and durable owner-scoped repositories. Production API routes currently fail closed with HTTP 503; demo data and actions are in process memory.
- Configure an OpenAI API key and test the agent's answers and real browser audio sessions, Hindi/Hinglish quality, interruptions, latency, and supported devices. Live voice was not exercised without credentials.
- Complete privacy, retention/deletion, threat, abuse, operational, and financial-domain reviews. Do not connect real bank data in this demo.
- Deploy and verify environments, CORS, secrets, monitoring, backups, and rollback. No deployment has been performed.

This is a locally verified synthetic-data MVP, not a production-ready financial service.
