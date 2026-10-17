import "dotenv/config";
import mongoose from "mongoose";
import { loadConfig } from "./config.js";
import { createApp } from "./app.js";
import { createLogger } from "./middleware/requestLog.js";

const config = loadConfig();
const log = createLogger();
const app = createApp({ config, log });

// MongoDB is currently a seed target and health signal; requests are served from the in-memory store.
if (config.MONGODB_URI) {
  mongoose
    .connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 5e3 })
    .then(() => {
      app.locals.databaseStatus = "connected";
      log.info({}, "MongoDB connected");
    })
    .catch((error) => {
      app.locals.databaseStatus = "disconnected";
      log.warn({ error: error instanceof Error ? error.message : "unknown" }, "MongoDB unavailable");
    });
}

app.listen(config.PORT, (error) => {
  if (error) {
    log.error({ port: config.PORT, error: error.message }, "Could not start the API (is the port already in use?)");
    process.exit(1);
  }
  log.info({ port: config.PORT, webOrigin: config.WEB_ORIGIN, ai: Boolean(config.OPENAI_API_KEY) }, "API listening");
});
