# Costs and external services

No paid resources are provisioned by this project. Without an OpenAI key, the text assistant is rule-based and costs nothing.

With `OPENAI_API_KEY` set, usage is billed to that OpenAI account:

- **Text agent:** each message is one or more Responses API calls (one per tool round, at most five), billed per input and output token for `OPENAI_MODEL`.
- **Live voice:** Realtime sessions are billed per audio input/output and transcription; sessions expire after 10 minutes and session creation is rate limited to 3 per minute.

Check current [OpenAI pricing](https://openai.com/api/pricing/) and set usage limits in the OpenAI dashboard before enabling. MongoDB Atlas, Render, and Vercel costs depend on plans and usage; this repository creates no accounts.
