# Testing

Run `npm test`, `npm run build`, and `npm run test:e2e`. Source is JavaScript and JSX, so there is no TypeScript typecheck step. Unit tests use synthetic fixtures and do not require external providers. Playwright covers the actual browser dashboard, text fallback, and action confirmation flow. Live-provider tests are opt-in and require a configured key, network, microphone, and supported browser; absent those dependencies, voice naturalness, interruption latency, provider streaming, and reconnect behavior remain unverified.

Verified on this workspace: `npm audit --audit-level=moderate` reports zero vulnerabilities. The Playwright run used the installed Chrome binary via `PLAYWRIGHT_CHROMIUM_EXECUTABLE`; on another machine, install a Playwright Chromium browser or set that variable to a supported Chromium executable.
