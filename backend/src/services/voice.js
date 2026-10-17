import { HttpError } from "../http.js";
import { toolDefinitions } from "./tools.js";
import { voiceInstructions } from "./prompts.js";

const SESSION_SECONDS = 600;
const TRANSCRIPTION_HINT =
  "Hinglish phone call about personal finance. Hindi and English are mixed. Account endings are four digits: 4091, 7350, 9380, 3175, 2750, 2145. Words: IDFC First Bank, PNB, HDFC, Bajaj Finance, Trusave Fintech, Bachatt, Kreditbee, Torrent Gas, LIC, EMI, autopay, mandate, NACH, bounce, charge, refund, reversal, balance, minimum balance, kitna, kitni baar, kata, kaata, paisa, rupaye, haan, nahi, theek hai, draft karo, confirm karo.";

/**
 * Mints a short-lived Realtime client secret locked to this session's model, voice,
 * instructions, and tools. The browser uses it to open a WebRTC call directly with OpenAI;
 * the long-lived API key never leaves the server.
 */
// Voices the user may pick in the UI (OpenAI Realtime built-in voices).
export const VOICES = ["marin", "cedar", "coral", "sage", "shimmer", "ash", "verse", "ballad", "alloy", "echo"];

export async function createVoiceSession({ config, user, openai, voice: requested }) {
  const voice = VOICES.includes(requested) ? requested : config.OPENAI_VOICE;
  if (!openai.configured) {
    throw new HttpError(503, "Live voice is not configured. Add OPENAI_API_KEY on the backend. Text chat remains available.");
  }
  const secret = await openai.createRealtimeClientSecret({
    expires_after: { anchor: "created_at", seconds: SESSION_SECONDS },
    session: {
      type: "realtime",
      model: config.OPENAI_REALTIME_MODEL,
      instructions: voiceInstructions(user, voice),
      tools: toolDefinitions,
      tool_choice: "auto",
      audio: {
        input: {
          // A vocabulary prompt helps recognise Hinglish and the names in this user's data.
          transcription: { model: config.OPENAI_TRANSCRIBE_MODEL, prompt: TRANSCRIPTION_HINT },
          turn_detection: { type: "semantic_vad" },
        },
        // Natural speed (1.0): slowing playback time-stretches the audio and makes it crackle.
        output: { voice },
      },
    },
  });
  if (!secret?.value) throw new HttpError(502, "The voice provider returned an invalid session key.");
  return {
    clientSecret: secret.value,
    expiresAt: secret.expires_at,
    model: config.OPENAI_REALTIME_MODEL,
    voice,
    callsUrl: "https://api.openai.com/v1/realtime/calls",
  };
}
