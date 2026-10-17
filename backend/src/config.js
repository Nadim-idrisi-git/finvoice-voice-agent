const ENVIRONMENTS = ["development", "test", "production"];

function fail(name, reason) {
  throw new Error(`Invalid environment variable ${name}: ${reason}`);
}

const text = (env, name, fallback) => {
  const value = env[name]?.trim();
  return value ? value : fallback;
};

/** Validates environment variables once at startup; throws on invalid values. */
export function loadConfig(env = process.env) {
  const NODE_ENV = text(env, "NODE_ENV", "development");
  if (!ENVIRONMENTS.includes(NODE_ENV)) fail("NODE_ENV", `expected one of ${ENVIRONMENTS.join(", ")}`);

  const PORT = Number(text(env, "PORT", "4100"));
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) fail("PORT", "expected an integer from 1 to 65535");

  const WEB_ORIGIN = text(env, "WEB_ORIGIN", "http://localhost:5173");
  try {
    new URL(WEB_ORIGIN);
  } catch {
    fail("WEB_ORIGIN", "expected a URL");
  }

  return {
    NODE_ENV,
    PORT,
    WEB_ORIGIN,
    MONGODB_URI: text(env, "MONGODB_URI", undefined),
    OPENAI_API_KEY: text(env, "OPENAI_API_KEY", undefined),
    OPENAI_MODEL: text(env, "OPENAI_MODEL", "gpt-6-luna"),
    OPENAI_REALTIME_MODEL: text(env, "OPENAI_REALTIME_MODEL", "gpt-realtime-2.1"),
    OPENAI_VOICE: text(env, "OPENAI_VOICE", "marin"),
    OPENAI_TRANSCRIBE_MODEL: text(env, "OPENAI_TRANSCRIBE_MODEL", "gpt-4o-mini-transcribe"),
  };
}
