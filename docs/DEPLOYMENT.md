# Deployment

**Backend → Render.** `render.yaml` defines a Node web service with `rootDir: backend`, `npm ci`, `npm start`, and `/health` as the health check. Set `WEB_ORIGIN` (the Vercel URL), `MONGODB_URI`, and `GEMINI_API_KEY` as secret environment variables; model names have defaults in `render.yaml`.

**Frontend → Vercel.** Create a Vercel project with **Root Directory** set to `frontend`. `frontend/vercel.json` builds with Vite into `dist/` and rewrites routes to `index.html`. Set `VITE_API_URL` to the Render URL plus `/api/v1`.

Keep secrets in provider settings, never in the repository. CORS allows only `WEB_ORIGIN`. Configure MongoDB Atlas network access narrowly.

In production, `/api/v1/*` returns HTTP 503 unless `DEMO_MODE=true`. `render.yaml` sets `DEMO_MODE=true` so the deployed app serves the synthetic demo user (no real users or bank data). Real authentication and user-scoped storage are not implemented; never turn on demo mode with real data. With `MONGODB_URI` set, actions, reminders, alerts, and audit entries persist in MongoDB; if the database is unreachable the backend falls back to in-memory storage, which `/health` reports.

Roll back by redeploying the previous frontend and backend builds.
