# Deployment

**Backend → Render.** `render.yaml` defines a Node web service with `rootDir: backend`, `npm ci`, `npm start`, and `/health` as the health check. Set `WEB_ORIGIN` (the Vercel URL), `MONGODB_URI`, and `OPENAI_API_KEY` as secret environment variables; model names have defaults in `render.yaml`.

**Frontend → Vercel.** Create a Vercel project with **Root Directory** set to `frontend`. `frontend/vercel.json` builds with Vite into `dist/` and rewrites routes to `index.html`. Set `VITE_API_URL` to the Render URL plus `/api/v1`.

Keep secrets in provider settings, never in the repository. CORS allows only `WEB_ORIGIN`. Configure MongoDB Atlas network access narrowly.

The backend deliberately returns HTTP 503 for `/api/v1/*` when `NODE_ENV=production`, because real authentication and durable user-scoped storage are not implemented. Remove that guard only after both exist and are reviewed. Roll back by redeploying the previous frontend and backend builds. No deployment has been performed or verified.
