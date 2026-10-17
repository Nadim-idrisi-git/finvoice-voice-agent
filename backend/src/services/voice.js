import { HttpError } from "../http.js";
import { toolDefinitions } from "./tools.js";
import { voiceInstructions } from "./prompts.js";

const SESSION_SECONDS = 600;

/**
 * Mints a short-lived Realtime client secret locked to this session's model, voice,
 * instructions, and tools. The browser uses it to open a WebRTC call directly with OpenAI;
 * the long-lived API key never leaves the server.
 */
export async function createVoiceSession({ config, user, openai }) {
  if (!openai.configured) {
    throw new HttpError(503, "Live voice is not configured. Add OPENAI_API_KEY on the backend. Text chat remains available.");
  }
  const secret = await openai.createRealtimeClientSecret({
    expires_after: { anchor: "created_at", seconds: SESSION_SECONDS },
    session: {
      type: "realtime",
      model: config.OPENAI_REALTIME_MODEL,
      instructions: voiceInstructions(user),
      tools: toolDefinitions,
      tool_choice: "auto",
      audio: {
        input: {
          transcription: { model: config.OPENAI_TRANSCRIBE_MODEL },
          turn_detection: { type: "semantic_vad" },
        },
        output: { voice: config.OPENAI_VOICE },
      },
    },
  });
  if (!secret?.value) throw new HttpError(502, "The voice provider returned an invalid session key.");
  return {
    clientSecret: secret.value,
    expiresAt: secret.expires_at,
    model: config.OPENAI_REALTIME_MODEL,
    voice: config.OPENAI_VOICE,
    callsUrl: "https://api.openai.com/v1/realtime/calls",
  };
}
