import "dotenv/config";
import mongoose from "mongoose";
import { loadConfig } from "./config.js";
import { createApp } from "./app.js";
import { createLogger } from "./middleware/requestLog.js";
import { createProfileStore, loadProfile } from "./store/profile.js";
import { mongoCollections } from "./store/mongoCollections.js";

const config = loadConfig();
const log = createLogger();

// With MONGODB_URI, actions/reminders/alerts/audit are stored in MongoDB (they survive restarts);
// the financial facts always come from the parsed dataset (data/profile.json). Without it, or if the
// database is unreachable, everything runs in memory.
let collections;
let databaseStatus = "not-configured";
if (config.MONGODB_URI) {
  try {
    await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 8e3 });
    collections = mongoCollections();
    databaseStatus = "connected";
    log.info({}, "MongoDB connected");
  } catch (error) {
    databaseStatus = "unavailable (using memory)";
    log.warn({ error: error instanceof Error ? error.message : "unknown" }, "MongoDB unavailable; using in-memory storage");
  }
}

const profile = loadProfile();
const app = createApp({ config, log, ...(profile ? { store: createProfileStore(profile, { collections }) } : {}) });
app.locals.databaseStatus = databaseStatus;
mongoose.connection.on("disconnected", () => (app.locals.databaseStatus = "disconnected"));
mongoose.connection.on("reconnected", () => (app.locals.databaseStatus = "connected"));

app.listen(config.PORT, (error) => {
  if (error) {
    log.error({ port: config.PORT, error: error.message }, "Could not start the API (is the port already in use?)");
    process.exit(1);
  }
  log.info({ port: config.PORT, origins: config.WEB_ORIGINS, demoMode: config.DEMO_MODE, ai: Boolean(config.GEMINI_API_KEY) }, "API listening");
});
