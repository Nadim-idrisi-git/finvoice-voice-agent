import "dotenv/config";
import mongoose from "mongoose";
import pino from "pino";
import { loadConfig } from "./config.js";
import { createApp } from "./app.js";

const config = loadConfig();
const log = pino({
  level: "info",
  redact: ["req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie"],
});
const app = createApp({ config, log });

// MongoDB is currently a seed target and health signal; requests are served from the in-memory store.
if (config.MONGODB_URI) {
  mongoose
    .connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 5e3 })
    .then(() => {
      app.locals.databaseStatus = "connected";
      log.info("MongoDB connected");
    })
    .catch((error) => {
      app.locals.databaseStatus = "disconnected";
      log.warn({ error: error instanceof Error ? error.message : "unknown" }, "MongoDB unavailable");
    });
}

app.listen(config.PORT, () => log.info({ port: config.PORT, webOrigin: config.WEB_ORIGIN }, "API listening"));
