const ENVIRONMENTS = ["development", "test", "production"];

function fail(name, reason) {
  throw new Error(`Invalid environment variable ${name}: ${reason}`);
}

const text = (env, name, fallback) => {
  const value = env[name]?.trim();
  return value ? value : fallback;
};

function positiveInt(env, name, fallback) {
  const value = Number(text(env, name, String(fallback)));
  if (!Number.isInteger(value) || value < 1) fail(name, "expected a positive integer");
  return value;
}

/** Validates environment variables once at startup; throws on invalid values. */
export function loadConfig(env = process.env) {
  const NODE_ENV = text(env, "NODE_ENV", "development");
  if (!ENVIRONMENTS.includes(NODE_ENV)) fail("NODE_ENV", `expected one of ${ENVIRONMENTS.join(", ")}`);

  const PORT = Number(text(env, "PORT", "4100"));
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) fail("PORT", "expected an integer from 1 to 65535");

  // One or more allowed browser origins, comma-separated; "*" may stand for a subdomain part
  // (e.g. https://finvoice*.vercel.app covers Vercel production and preview URLs).
  const WEB_ORIGIN = text(env, "WEB_ORIGIN", "http://localhost:5173");
  const WEB_ORIGINS = WEB_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);
  for (const origin of WEB_ORIGINS) {
    try {
      new URL(origin.replace(/\*/g, "x"));
    } catch {
      fail("WEB_ORIGIN", `expected URLs, got "${origin}"`);
    }
  }
  const DEMO_MODE = ["1", "true", "yes"].includes(String(text(env, "DEMO_MODE", "false")).toLowerCase());

  return {
    NODE_ENV,
    PORT,
    WEB_ORIGIN,
    WEB_ORIGINS,
    // Opt-in: serve the synthetic demo API in production (no real users or bank data).
    DEMO_MODE,
    MONGODB_URI: text(env, "MONGODB_URI", undefined),
    OPENAI_API_KEY: text(env, "OPENAI_API_KEY", undefined),
    OPENAI_MODEL: text(env, "OPENAI_MODEL", "gpt-6-luna"),
    // Empty = the model's default. Lower effort is faster; change only after npm run eval.
    OPENAI_REASONING_EFFORT: text(env, "OPENAI_REASONING_EFFORT", undefined),
    OPENAI_REALTIME_MODEL: text(env, "OPENAI_REALTIME_MODEL", "gpt-realtime-2.1"),
    OPENAI_VOICE: text(env, "OPENAI_VOICE", "marin"),
    OPENAI_TRANSCRIBE_MODEL: text(env, "OPENAI_TRANSCRIBE_MODEL", "gpt-4o-transcribe"),
    ASSISTANT_RATE_LIMIT: positiveInt(env, "ASSISTANT_RATE_LIMIT", 20),
  };
}
