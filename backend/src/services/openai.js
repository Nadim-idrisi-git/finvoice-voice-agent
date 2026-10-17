import { HttpError } from "../http.js";

const BASE_URL = "https://api.openai.com/v1";
const TIMEOUT_MS = 20_000;

/**
 * Minimal OpenAI REST client built on fetch. The API key stays on the server.
 * `fetch` is injected so tests never call the network.
 */
export function createOpenAIClient({ apiKey, fetch, log }) {
  async function post(path, body) {
    let response;
    try {
      response = await fetch(`${BASE_URL}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      log.warn({ path, error: error instanceof Error ? error.message : "unknown" }, "OpenAI request failed");
      throw new HttpError(502, "The AI provider could not be reached.");
    }
    if (!response.ok) {
      log.warn({ path, status: response.status }, "OpenAI rejected request");
      throw new HttpError(502, "The AI provider rejected the request. Check the model name and API key.");
    }
    return response.json();
  }

  return {
    configured: Boolean(apiKey),
    /** Responses API: https://developers.openai.com/api/docs/guides/function-calling */
    createResponse: (body) => post("/responses", body),
  };
}

/** Concatenates the assistant text from a Responses API result. */
export function outputText(response) {
  return (response.output ?? [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text")
    .map((part) => part.text)
    .join("")
    .trim();
}
