import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pino from "pino";
import { pinoHttp } from "pino-http";
import { DEMO_USER } from "./data/seed.js";
import { HttpError } from "./http.js";
import { createMemoryStore } from "./store/memory.js";
import { createActionService } from "./services/actions.js";
import { financeRoutes } from "./routes/finance.js";
import { actionRoutes } from "./routes/actions.js";
import { assistantRoutes } from "./routes/assistant.js";

const limiter = (limit) => rateLimit({ windowMs: 60e3, limit, standardHeaders: "draft-7", legacyHeaders: false });

/**
 * Builds the Express app from explicit dependencies so tests and alternative
 * stores (e.g. MongoDB) can be swapped in without touching route code.
 */
export function createApp({
  config,
  store = createMemoryStore(),
  log = pino({
    level: config.NODE_ENV === "test" ? "silent" : "info",
    redact: ["req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie"],
  }),
  fetch = globalThis.fetch,
}) {
  const app = express();
  const actions = createActionService(store);
  app.locals.databaseStatus = "synthetic-fixture";

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: config.WEB_ORIGIN, credentials: true, methods: ["GET", "POST"] }));
  app.use(express.json({ limit: "24kb" }));
  app.use(
    pinoHttp({
      logger: log,
      genReqId: (req) => req.headers["x-request-id"]?.toString() ?? crypto.randomUUID(),
      serializers: { req: (req) => ({ id: req.id, method: req.method, url: req.url }) },
    }),
  );
  app.use(limiter(60));

  app.get("/health", (_req, res) =>
    res.json({
      status: "ok",
      database: app.locals.databaseStatus,
      store: store.kind,
      voiceConfigured: Boolean(config.GEMINI_API_KEY),
    }),
  );

  // Demo identity. Fail closed in production until real authentication exists.
  app.use("/api/v1", (_req, res, next) => {
    if (config.NODE_ENV === "production") {
      return res.status(503).json({
        error: "Production authentication is not implemented. This synthetic demo API is unavailable in production.",
      });
    }
    res.locals.user = DEMO_USER;
    next();
  });
  app.use("/api/v1/voice/session", limiter(3));
  app.use("/api/v1", financeRoutes({ store }));
  app.use("/api/v1", actionRoutes({ actions }));
  app.use("/api/v1", assistantRoutes({ store, actions, config, fetch, log }));

  app.use((err, req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, requestId: req.id });
    log.error({ requestId: req.id, error: err instanceof Error ? err.message : "unknown" }, "Request failed");
    res.status(500).json({ error: "The request could not be completed.", requestId: req.id });
  });

  return app;
}
