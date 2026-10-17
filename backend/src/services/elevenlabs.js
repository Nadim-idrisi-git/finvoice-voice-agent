import { HttpError } from "../http.js";

const BASE_URL = "https://api.elevenlabs.io/v1";
const TIMEOUT_MS = 20_000;

/**
 * ElevenLabs speech-to-text (Scribe) and streaming text-to-speech over fetch.
 * The API key stays on the server; the browser only uploads audio and plays back a stream.
 * `fetch` is injected so tests never call the network.
 */
export function createElevenLabsClient({ apiKey, voiceId, ttsModel, sttModel, fetch, log }) {
  let resolvedVoiceId = voiceId;
  const headers = { "xi-api-key": apiKey };

  async function call(path, init, what) {
    let response;
    try {
      response = await fetch(`${BASE_URL}${path}`, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (error) {
      log.warn({ path, error: error instanceof Error ? error.message : "unknown" }, `ElevenLabs ${what} failed`);
      throw new HttpError(502, "The voice provider could not be reached.");
    }
    if (!response.ok) {
      // ElevenLabs' own reason (e.g. missing key permission, paid plan required, quota) is safe to show.
      const detail = await response
        .json()
        .then((body) => body?.detail?.message ?? body?.detail?.status ?? null)
        .catch(() => null);
      log.warn({ path, status: response.status, detail }, `ElevenLabs rejected ${what}`);
      throw new HttpError(502, `ElevenLabs rejected the ${what} request${detail ? `: ${detail}` : ". Check ELEVENLABS_API_KEY and the voice settings."}`);
    }
    return response;
  }

  /** Uses ELEVENLABS_VOICE_ID, or the account's first premade (generic) voice. */
  async function voice() {
    if (resolvedVoiceId) return resolvedVoiceId;
    const { voices = [] } = await (await call("/voices", { headers }, "voice list")).json();
    const premade = voices.find((v) => v.category === "premade") ?? voices[0];
    if (!premade) throw new HttpError(502, "No ElevenLabs voice is available on this account.");
    resolvedVoiceId = premade.voice_id;
    log.info({ voice: premade.name }, "Using ElevenLabs voice");
    return resolvedVoiceId;
  }

  return {
    configured: Boolean(apiKey),

    /** Audio bytes → { text, languageCode, languageProbability }. Language is auto-detected (Hindi/English). */
    async transcribe(audio, mimeType) {
      const form = new FormData();
      form.append("file", new Blob([audio], { type: mimeType }), "speech.webm");
      form.append("model_id", sttModel);
      const data = await (await call("/speech-to-text", { method: "POST", headers, body: form }, "transcription")).json();
      return {
        text: String(data.text ?? "").trim(),
        languageCode: data.language_code ?? null,
        languageProbability: data.language_probability ?? null,
      };
    },

    /** Text → streaming MP3 response (a fetch Response whose body is the audio stream). */
    async speak(text) {
      return call(
        `/text-to-speech/${encodeURIComponent(await voice())}/stream?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json", Accept: "audio/mpeg" },
          body: JSON.stringify({ text, model_id: ttsModel }),
        },
        "speech",
      );
    },
  };
}
