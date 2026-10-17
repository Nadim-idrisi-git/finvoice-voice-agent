import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(4100),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  MONGODB_URI: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_LIVE_MODEL: z.string().min(1).default("gemini-3.8-live"),
  GEMINI_VOICE: z.string().min(1).max(60).default("Kore"),
});

/** Validates environment variables once at startup; throws on invalid values. */
export function loadConfig(env = process.env) {
  return configSchema.parse(env);
}
