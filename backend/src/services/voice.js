import { HttpError } from "../http.js";
import { toolDefinitions } from "./tools.js";
import { voiceInstructions } from "./prompts.js";

const SESSION_SECONDS = 600;
const CONNECT_SECONDS = 60;
// Native-audio Live models transcribe on their own (no vocabulary prompt), so the hint goes in the instructions.
const TRANSCRIPTION_HINT =
  "VOCABULARY you will hear on this Hinglish call (Hindi and English mixed): account endings are four digits: 4091, 7350, 9380, 3175, 2750, 2145. Names and words: IDFC First Bank, PNB, HDFC, Bajaj Finance, Trusave Fintech, Bachatt, Kreditbee, Torrent Gas, LIC, EMI, autopay, mandate, NACH, bounce, charge, refund, reversal, balance, minimum balance, kitna, kitni baar, kata, kaata, paisa, rupaye, haan, nahi, theek hai, draft karo, confirm karo.";
const LIVE_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";

// Voices the user may pick in the UI (Gemini Live prebuilt voices).
export const VOICES = ["Kore", "Aoede", "Leda", "Zephyr", "Puck", "Charon", "Orus", "Fenrir"];

/**
 * Mints a single-use Live API ephemeral token locked to this session's model, voice, instructions,
 * and tools. The browser uses it to open a WebSocket directly with Gemini; the long-lived API key
 * never leaves the server, and the browser cannot change the locked setup.
 */
export async function createVoiceSession({ config, user, gemini, voice: requested }) {
  const voice = VOICES.find((v) => v.toLowerCase() === String(requested ?? "").toLowerCase()) ?? config.GEMINI_VOICE;
  if (!gemini.configured) {
    throw new HttpError(503, "Live voice is not configured. Add GEMINI_API_KEY on the backend. Text chat remains available.");
  }
  const now = Date.now();
  const expiresAt = new Date(now + SESSION_SECONDS * 1000).toISOString();
  const token = await gemini.createLiveToken({
    uses: 1,
    expireTime: expiresAt,
    newSessionExpireTime: new Date(now + CONNECT_SECONDS * 1000).toISOString(),
    bidiGenerateContentSetup: {
      model: `models/${config.GEMINI_LIVE_MODEL}`,
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
      systemInstruction: { parts: [{ text: `${voiceInstructions(user, voice)} ${TRANSCRIPTION_HINT}` }] },
      // BLOCKING: the model waits for tool results before speaking, so spoken amounts come from the tools.
      tools: [{ functionDeclarations: toolDefinitions.map((tool) => ({ ...tool, behavior: "BLOCKING" })) }],
      // Transcripts of both sides drive the chat log and post-hoc validation.
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    },
  });
  if (!token?.name) throw new HttpError(502, "The voice provider returned an invalid session key.");
  return {
    token: token.name,
    expiresAt,
    model: config.GEMINI_LIVE_MODEL,
    voice,
    liveUrl: LIVE_URL,
  };
}
