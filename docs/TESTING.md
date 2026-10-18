# Testing

Run `npm test` from the root (or inside `backend/` or `frontend/`). Both apps use Node's built-in test runner (`node:test` with `node:assert`); there are no extra test libraries.

- **Backend (`backend/test`)**: analytics, the rule-based assistant, action ownership and confirmation, config and validation, every API route over real HTTP on a random port, the tool registry, rate limiting, the production guard, the Gemini text agent loop (tool calls, thought signatures, conversation memory, action proposals, tool errors, fallback on provider failure), and Live token minting. Gemini is replaced by an injected fake `fetch`, so tests never use the network or a key.
- **Frontend (`frontend/src/**/*.test.js`)**: the voice state machine and the chart and money helpers.

`npm run build` syntax-checks every backend file and builds the frontend. CI runs install, audit, tests, and build for each app.

Not automated: browser end-to-end flows (render the app and click through the Overview, Analytics, and Actions pages manually or with Postman for the API), live Gemini answers, and real voice (`npm run voice-smoke` covers the Live model with typed turns, not audio). Those need a key, a microphone, and a supported browser; voice naturalness, interruption latency, and reconnect behaviour remain unverified until then.
