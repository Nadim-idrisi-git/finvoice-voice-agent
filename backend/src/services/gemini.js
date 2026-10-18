import { HttpError } from "../http.js";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 2;

/**
 * Minimal Gemini API REST client built on fetch. The API key stays on the server.
 * `fetch` is injected so tests never call the network.
 */
export function createGeminiClient({ apiKey, fetch, log }) {
  async function post(path, body, attempt = 1) {
    let response;
    try {
      response = await fetch(`${BASE_URL}${path}`, {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      log.warn({ path, attempt, error: error instanceof Error ? error.message : "unknown" }, "Gemini request failed");
      // A dropped connection (stale keep-alive socket, DNS blip) usually succeeds on a fresh attempt; a timeout won't.
      if (!timedOut && attempt < MAX_ATTEMPTS) return post(path, body, attempt + 1);
      throw new HttpError(502, "The AI provider could not be reached.");
    }
    if (!response.ok) {
      log.warn({ path, status: response.status }, "Gemini rejected request");
      throw new HttpError(502, "The AI provider rejected the request. Check the model name and API key.");
    }
    return response.json();
  }

  return {
    configured: Boolean(apiKey),
    /** generateContent with function calling: https://ai.google.dev/gemini-api/docs/function-calling */
    generateContent: (model, body) => post(`/models/${encodeURIComponent(model)}:generateContent`, body),
    /** Ephemeral token for a browser Live API session: https://ai.google.dev/gemini-api/docs/ephemeral-tokens */
    createLiveToken: (body) => post("/auth_tokens", body),
  };
}

/** The model's content from a generateContent result (kept verbatim: it carries thought signatures). */
export function modelContent(response) {
  return response.candidates?.[0]?.content ?? { role: "model", parts: [] };
}

/** Concatenates the visible answer text (thought summaries excluded). */
export function outputText(content) {
  return (content.parts ?? [])
    .filter((part) => typeof part.text === "string" && !part.thought)
    .map((part) => part.text)
    .join("")
    .trim();
}
