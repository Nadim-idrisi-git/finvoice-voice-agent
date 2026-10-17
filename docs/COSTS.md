# Costs and external services

No paid resources are provisioned by this project. Without an OpenAI key, the text assistant is rule-based and costs nothing.

With `OPENAI_API_KEY` set, usage is billed to that OpenAI account:

- **Text agent:** each message is one or more Responses API calls (one per tool round, at most five), billed per input and output token for `OPENAI_MODEL`.
- **Voice (ElevenLabs):** speech-to-text is billed per audio duration and text-to-speech per character of each spoken answer (about 150–300 characters per turn). The free tier has a small character quota and cannot use Voice Library voices through the API; use a paid plan for demos.

Check current [OpenAI pricing](https://openai.com/api/pricing/) and [ElevenLabs pricing](https://elevenlabs.io/pricing) and set usage limits in the OpenAI dashboard before enabling. MongoDB Atlas, Render, and Vercel costs depend on plans and usage; this repository creates no accounts.
