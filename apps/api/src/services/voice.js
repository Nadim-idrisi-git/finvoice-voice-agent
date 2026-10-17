import { HttpError } from "../http.js";
import { toolDeclarations } from "./tools.js";

const PROVIDER = "https://generativelanguage.googleapis.com";
// The @google/genai SDK supports ephemeral tokens on v1alpha only.
const API_VERSION = "v1alpha";

export function systemInstruction(user) {
  return [
    `You are a concise, warm financial assistant for ${user.name}.`,
    "Speak naturally in English, Hindi, or Hinglish matching the user. All money is INR. These are synthetic demo records.",
    "Use tools for financial facts; never guess amounts. Tool results include fields ending in Rupees that are already formatted in INR; speak those values and never read fields ending in Paise aloud as rupees.",
    "Explain there is no real bank connection. You may propose reminders or alerts, but never say an action is created until the app confirms it.",
    "Do not initiate money movement or claim subscription cancellation.",
  ].join(" ");
}

/**
 * Mints a single-use, short-lived provider token locked to this session's model,
 * instruction and tools. The long-lived API key never leaves the server.
 */
export async function createVoiceSession({ config, user, fetch, log }) {
  if (!config.GEMINI_API_KEY) {
    throw new HttpError(
      503,
      "Live voice is not configured. Add GEMINI_API_KEY on the API server. Text assistant remains available.",
    );
  }
  const model = config.GEMINI_LIVE_MODEL;
  const voice = config.GEMINI_VOICE;
  const instruction = systemInstruction(user);
  const liveConnectConstraints = {
    model: `models/${model}`,
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      systemInstruction: { parts: [{ text: instruction }] },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      sessionResumption: {},
      tools: [{ functionDeclarations: toolDeclarations }],
    },
  };
  let response;
  try {
    response = await fetch(`${PROVIDER}/${API_VERSION}/auth_tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": config.GEMINI_API_KEY },
      body: JSON.stringify({
        uses: 1,
        expireTime: new Date(Date.now() + 30 * 60e3).toISOString(),
        newSessionExpireTime: new Date(Date.now() + 60e3).toISOString(),
        liveConnectConstraints,
      }),
    });
  } catch (error) {
    log.warn({ error: error instanceof Error ? error.message : "unknown" }, "Voice session initialization failed");
    throw new HttpError(502, "Could not initialize voice session.");
  }
  if (!response.ok) {
    log.warn({ status: response.status }, "Voice token provider rejected request");
    throw new HttpError(
      502,
      "The voice provider could not initialize a session. Check model access and API configuration.",
    );
  }
  const token = await response.json();
  if (!token.name) throw new HttpError(502, "Voice provider returned an invalid session token.");
  return {
    token: token.name,
    apiVersion: API_VERSION,
    model,
    voice,
    systemInstruction: instruction,
    tools: toolDeclarations,
    expiresAt: token.expireTime,
    modalities: ["AUDIO"],
    transport: "WebSocket",
  };
}
