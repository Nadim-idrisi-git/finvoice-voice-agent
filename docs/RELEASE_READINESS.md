# Release readiness

## Local verification

- Unit and API tests: passed (37 tests across shared, API, and web workspaces).
- JavaScript syntax checks: passed for the API and shared package.
- Production build: passed for shared, API, and web workspaces.
- Browser tests: passed (2 flows: Hinglish spending question with confirmed reminder, and previous-month analytics).
- Dependency audit: passed with 0 reported vulnerabilities at moderate severity or higher.
- Mongo seed and connection smoke check: passed with 169 synthetic INR transactions.

## Included

- Responsive finance dashboard, transaction and analytics views, deterministic text assistant, and confirmation-gated demo actions.
- Optional Gemini Live voice path with short-lived server-issued session token and explicit UI state handling.
- Synthetic INR data, API schemas, local docs, starter Render/Vercel configuration, and CI workflow.

## Required before real users

- Implement and review real authentication, session/CSRF protections, authorization, and durable owner-scoped repositories. Production API routes currently fail closed with HTTP 503; demo data and actions are in process memory.
- Configure a Gemini API key and test real browser audio sessions, Hindi/Hinglish quality, interruptions, latency, and supported devices. Live voice was not exercised without credentials.
- Complete privacy, retention/deletion, threat, abuse, operational, and financial-domain reviews. Do not connect real bank data in this demo.
- Deploy and verify environments, CORS, secrets, monitoring, backups, and rollback. No deployment has been performed.

This is a locally verified synthetic-data MVP, not a production-ready financial service.
