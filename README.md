# Finvoice: Voice Financial Agent

A voice-first personal finance assistant using synthetic INR records. Ask about spending, subscriptions, bills, and EMIs by text or live voice; propose reminders and alerts that you confirm before anything is recorded. No bank, payment, or subscription provider is connected.

**Stack:** JavaScript (ES6+), React, Tailwind CSS, Node.js, Express, MongoDB, OpenAI API (Responses API agent with tool calling, Realtime API for live voice), deployed on Vercel (frontend) and Render (backend).

## Project structure

```text
frontend/   React + Tailwind CSS app (Vite build), deployed to Vercel
backend/    Node.js + Express REST API, OpenAI integration, MongoDB seed, deployed to Render
docs/       Architecture, API, voice, security, testing, and deployment notes
```

## Run locally

Requirements: Node.js 20+ and npm. MongoDB is optional (only for `npm run seed`).

1. `npm run setup` installs both apps.
2. `cp backend/.env.example backend/.env` and, optionally, `cp frontend/.env.example frontend/.env`.
3. Optional: set `OPENAI_API_KEY` in `backend/.env` to enable the AI agent and live voice.
4. `npm run dev` starts the backend on <http://localhost:4100> and the frontend on <http://localhost:5173>.

Without an OpenAI key, text chat uses the built-in rule-based assistant and voice is disabled; everything else works. OpenAI usage is billed to your own account; this project provisions no paid resources.

| Command         | What it does                                            |
| --------------- | ------------------------------------------------------- |
| `npm run setup` | Install backend and frontend dependencies               |
| `npm run dev`   | Run both dev servers                                    |
| `npm test`      | Run backend and frontend tests (Node's built-in runner) |
| `npm run build` | Syntax-check the backend and build the frontend         |
| `npm run seed`  | Write synthetic transactions to MongoDB                 |

In `backend/`: `npm run ingest` parses the buildathon dataset into `data/profile.json`; `npm run eval` runs the evaluation suite against the real model (needs `OPENAI_API_KEY`).

## How it works

- **Text chat:** the backend runs an OpenAI agent (Responses API) that calls server-side tools over your records, so every amount comes from deterministic calculations, not the model. If OpenAI is not configured or fails, a rule-based English/Hindi/Hinglish assistant answers.
- **Live voice:** the backend mints a short-lived OpenAI Realtime key; the browser connects over WebRTC, streams microphone audio, and forwards the model's tool calls to the same backend tools. You can interrupt at any time.
- **Actions:** the assistant can only _propose_ reminders, alerts, or subscription workflows. Nothing is recorded until you confirm it under Actions.

The demo identity and records are synthetic. All `/api/v1` routes return 503 in production because real authentication is not implemented yet. Accuracy controls and measured results: [docs/EVALUATION.md](docs/EVALUATION.md), [docs/SOURCES.md](docs/SOURCES.md), [docs/INTENTS.md](docs/INTENTS.md). Capacity assumptions (not load-tested): [docs/CAPACITY.md](docs/CAPACITY.md). See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/API.md](docs/API.md), [docs/VOICE_ARCHITECTURE.md](docs/VOICE_ARCHITECTURE.md), and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
