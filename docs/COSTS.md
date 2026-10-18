# Costs and external services

No paid resources are provisioned by this project. Without a Gemini key, the text assistant is rule-based and costs nothing.

With `GEMINI_API_KEY` set, usage is billed to that Google AI Studio / Gemini API project:

- **Text agent:** each message is one or more `generateContent` calls (one per tool round, at most five), billed per input and output token for `GEMINI_MODEL`.
- **Live voice:** Live API sessions on `GEMINI_LIVE_MODEL` are billed per audio input/output token; sessions expire after 10 minutes and session creation is rate limited to 3 per minute.

Check current [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) and set usage limits in Google AI Studio before enabling. MongoDB Atlas, Render, and Vercel costs depend on plans and usage; this repository creates no accounts.
