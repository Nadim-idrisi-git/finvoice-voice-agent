import express from "express";
import cors from "cors";
import { DEMO_USER } from "./data/seed.js";
import { HttpError } from "./http.js";
import { securityHeaders } from "./middleware/security.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { createLogger, requestLog } from "./middleware/requestLog.js";
import { createMemoryStore } from "./store/memory.js";
import { createProfileStore, loadProfile } from "./store/profile.js";
import { createActionService } from "./services/actions.js";
import { createGeminiClient } from "./services/gemini.js";
import { financeRoutes } from "./routes/finance.js";
import { actionRoutes } from "./routes/actions.js";
import { assistantRoutes } from "./routes/assistant.js";

/** The parsed event dataset when present (npm run ingest), else the built-in synthetic fixture. */
function defaultStore(config) {
  const profile = config.NODE_ENV === "test" ? null : loadProfile();
  return profile ? createProfileStore(profile) : createMemoryStore();
}

/**
 * Builds the Express app from explicit dependencies so tests and alternative
 * stores (e.g. MongoDB) can be swapped in without touching route code.
 */
export function createApp({
  config,
  store = defaultStore(config),
  log = createLogger({ silent: config.NODE_ENV === "test" }),
  fetch = globalThis.fetch,
}) {
  const app = express();
  const actions = createActionService(store);
  const gemini = createGeminiClient({ apiKey: config.GEMINI_API_KEY, fetch, log });
  app.locals.databaseStatus = "synthetic-fixture";

  app.disable("x-powered-by");
  // Behind a hosting proxy (Render), use the client IP from X-Forwarded-For so rate limits are per visitor.
  if (config.NODE_ENV === "production") app.set("trust proxy", 1);
  app.use(securityHeaders);
  // Production allows only WEB_ORIGIN. In development any localhost port is allowed,
  // because Vite moves to the next free port when 5173 is taken.
  const localhost = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;
  const allowed = (config.WEB_ORIGINS ?? [config.WEB_ORIGIN]).map(
    (o) => new RegExp(`^${o.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[a-z0-9-]*")}$`, "i"),
  );
  app.use(
    cors({
      origin: (origin, done) =>
        done(
          null,
          !origin || allowed.some((re) => re.test(origin)) || (config.NODE_ENV !== "production" && localhost.test(origin)),
        ),
      methods: ["GET", "POST"],
    }),
  );
  app.use(express.json({ limit: "24kb" }));
  app.use(requestLog(log));
  app.use(rateLimit({ limit: 60 }));

  app.get("/health", (_req, res) =>
    res.json({
      status: "ok",
      database: app.locals.databaseStatus,
      store: store.kind,
      aiConfigured: gemini.configured,
    }),
  );

  // Demo identity. Fail closed in production until real authentication exists.
  app.use("/api/v1", (_req, res, next) => {
    if (config.NODE_ENV === "production" && !config.DEMO_MODE) {
      return res.status(503).json({
        error: "Production authentication is not implemented. This synthetic demo API is unavailable in production.",
      });
    }
    res.locals.user = store.user ?? DEMO_USER;
    next();
  });
  app.use("/api/v1/voice/session", rateLimit({ limit: 6 }));
  app.use("/api/v1/assistant/message", rateLimit({ limit: config.ASSISTANT_RATE_LIMIT }));
  app.use("/api/v1", financeRoutes({ store }));
  app.use("/api/v1", actionRoutes({ actions }));
  app.use("/api/v1", assistantRoutes({ store, actions, config, gemini, log }));

  app.use((err, req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, requestId: req.id });
    if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON body.", requestId: req.id });
    log.error({ requestId: req.id, error: err instanceof Error ? err.message : "unknown" }, "Request failed");
    res.status(500).json({ error: "The request could not be completed.", requestId: req.id });
  });

  return app;
}
