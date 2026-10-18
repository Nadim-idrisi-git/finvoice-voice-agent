import { api } from "./api";
import { VoiceSessionStateMachine } from "./voiceState";

// Gemini Live prebuilt voices offered in the UI (the backend accepts the same list).
export const VOICES = [
  { id: "Kore", label: "Kore · female" },
  { id: "Aoede", label: "Aoede · female" },
  { id: "Leda", label: "Leda · female" },
  { id: "Zephyr", label: "Zephyr · female" },
  { id: "Puck", label: "Puck · male" },
  { id: "Charon", label: "Charon · male" },
  { id: "Orus", label: "Orus · male" },
  { id: "Fenrir", label: "Fenrir · male" },
];
export const DEFAULT_VOICE = VOICES[0].id;

const INPUT_RATE = 16000; // Live API input: 16-bit PCM, 16 kHz, mono
const OUTPUT_RATE = 24000; // Live API output: 16-bit PCM, 24 kHz, mono

// Captures the microphone at the context's rate, downsamples to 16 kHz, and posts 40 ms Int16 chunks.
const CAPTURE_WORKLET = `
class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / ${INPUT_RATE};
    this.acc = 0; this.sum = 0; this.count = 0;
    this.out = new Int16Array(640); this.n = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.sum += ch[i]; this.count++; this.acc += 1;
      if (this.acc < this.ratio) continue;
      this.acc -= this.ratio;
      const v = Math.max(-1, Math.min(1, this.sum / this.count));
      this.out[this.n++] = v < 0 ? v * 0x8000 : v * 0x7fff;
      this.sum = 0; this.count = 0;
      if (this.n === this.out.length) {
        this.port.postMessage(this.out.buffer, [this.out.buffer]);
        this.out = new Int16Array(640); this.n = 0;
      }
    }
    return true;
  }
}
registerProcessor("pcm-capture", PcmCapture);
`;

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function fromBase64(data) {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Live voice with the Gemini Live API over a WebSocket.
 *
 * 1. The backend mints a single-use ephemeral token with the model, voice, instructions, and tools
 *    locked in (the API key never reaches the browser, and the browser cannot change the setup).
 * 2. The browser streams 16 kHz PCM microphone audio up and plays the 24 kHz PCM audio that comes back.
 * 3. When the model calls a tool, the call is forwarded to the backend tool registry and the result is
 *    sent back. Interruption is detected by the server: it reports `interrupted` and the client drops
 *    any audio not yet played.
 */
export class LiveVoiceSession {
  machine = new VoiceSessionStateMachine();
  ws = null;
  stream = null;
  ctx = null;
  capture = null;
  disposed = false;
  lastUserTranscript = "";
  // The user's latest words for confirm_action. Cleared once an action is proposed or confirmed, so one
  // "yes" confirms at most one action, and only an action drafted before the user said it.
  confirmTranscript = "";
  userText = ""; // transcript of the user's current utterance
  assistantText = ""; // transcript of the assistant's current turn
  sources = new Set(); // scheduled audio chunks not yet finished
  playhead = 0;
  turnDone = true;
  cancelledCalls = new Set();

  constructor(callbacks, { voice } = {}) {
    this.callbacks = callbacks;
    this.voice = voice;
  }

  transition(next) {
    if (this.machine.transition(next)) this.callbacks.state(next);
  }

  async start() {
    this.transition("CONNECTING");
    try {
      // Created before any await so the click that started the call still counts as a user gesture.
      this.ctx = new AudioContext();
      void this.ctx.resume();
      const session = await api.voiceSession(this.voice);
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (this.disposed) return this.release();

      const workletUrl = URL.createObjectURL(new Blob([CAPTURE_WORKLET], { type: "application/javascript" }));
      try {
        await this.ctx.audioWorklet.addModule(workletUrl);
      } finally {
        URL.revokeObjectURL(workletUrl);
      }
      if (this.disposed) return this.release();

      this.ws = new WebSocket(`${session.liveUrl}?access_token=${encodeURIComponent(session.token)}`);
      this.ws.binaryType = "arraybuffer";
      // The setup (model, voice, instructions, tools) is locked in the token, so the client sends it empty.
      this.ws.onopen = () => this.send({ setup: {} });
      this.ws.onmessage = (event) =>
        void this.onMessage(JSON.parse(typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data)));
      this.ws.onclose = (event) => {
        if (this.disposed) return;
        if (event.code === 1000) {
          this.release();
          this.transition("DISCONNECTED");
        } else {
          this.fail(event.reason ? `The voice connection closed: ${event.reason}` : "The voice connection dropped. Start voice again to reconnect.");
        }
      };
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      this.fail(
        name === "NotAllowedError"
          ? "Microphone permission was denied. Allow it in your browser to use voice."
          : error instanceof Error
            ? error.message
            : "Could not start voice.",
      );
    }
  }

  /** Starts streaming the microphone once the Live session is ready. */
  startMicrophone() {
    const source = this.ctx.createMediaStreamSource(this.stream);
    this.capture = new AudioWorkletNode(this.ctx, "pcm-capture");
    this.capture.port.onmessage = ({ data }) =>
      this.send({ realtimeInput: { audio: { data: toBase64(data), mimeType: `audio/pcm;rate=${INPUT_RATE}` } } });
    // A silent sink keeps the worklet pulled by the audio graph in every browser.
    const sink = this.ctx.createGain();
    sink.gain.value = 0;
    source.connect(this.capture).connect(sink).connect(this.ctx.destination);
  }

  /** Mutes or unmutes the microphone without ending the call; the assistant can keep speaking. */
  setMuted(muted) {
    this.stream?.getAudioTracks().forEach((track) => (track.enabled = !muted));
  }

  send(message) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message));
  }

  /** Sends a text turn and asks the model to respond to it. */
  say(text) {
    this.send({ clientContent: { turns: [{ role: "user", parts: [{ text }] }], turnComplete: true } });
  }

  async onMessage(message) {
    if (message.setupComplete) {
      this.startMicrophone();
      this.transition("LISTENING");
      // The agent opens the call ("Sunday money call") instead of waiting for the user.
      this.say("(The call has just connected. Open the weekly money call now.)");
      return;
    }
    if (message.toolCall) return this.runToolCalls(message.toolCall.functionCalls ?? []);
    if (message.toolCallCancellation) {
      for (const id of message.toolCallCancellation.ids ?? []) this.cancelledCalls.add(id);
      return;
    }
    const content = message.serverContent;
    if (!content) return;

    if (content.inputTranscription?.text) {
      this.userText += content.inputTranscription.text;
      if (["LISTENING", "INTERRUPTED"].includes(this.machine.state)) this.transition("USER_SPEAKING");
    }
    if (content.interrupted) {
      this.stopPlayback();
      this.flushAssistant();
      this.transition("INTERRUPTED");
      this.transition("USER_SPEAKING");
    }
    for (const part of content.modelTurn?.parts ?? []) {
      if (part.inlineData?.data && part.inlineData.mimeType?.startsWith("audio/pcm")) {
        this.flushUser();
        this.play(part.inlineData.data);
      }
    }
    if (content.outputTranscription?.text) {
      this.flushUser();
      this.assistantText += content.outputTranscription.text;
    }
    if (content.turnComplete) {
      this.flushUser();
      this.flushAssistant();
      this.turnDone = true;
      if (!this.sources.size) this.transition("LISTENING");
    }
  }

  /** Publishes the user's finished utterance once the model starts answering it. */
  flushUser() {
    const text = this.userText.trim();
    this.userText = "";
    if (!text) return;
    this.lastUserTranscript = text;
    this.confirmTranscript = text;
    this.callbacks.transcript("you", text);
  }

  flushAssistant() {
    const text = this.assistantText.trim();
    this.assistantText = "";
    if (!text) return;
    this.callbacks.transcript("assistant", text);
    void this.validateSpoken(text);
  }

  /** Schedules one 24 kHz PCM chunk right after the previous one, so playback is gapless. */
  play(data) {
    if (!this.ctx) return;
    const bytes = fromBase64(data);
    const pcm = new Int16Array(bytes.buffer, 0, bytes.length >> 1);
    if (!pcm.length) return;
    const buffer = this.ctx.createBuffer(1, pcm.length, OUTPUT_RATE);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 0x8000;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.ctx.destination);
    const at = Math.max(this.playhead, this.ctx.currentTime + 0.05);
    source.start(at);
    this.playhead = at + buffer.duration;
    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
      if (!this.sources.size && this.turnDone && this.machine.state === "ASSISTANT_SPEAKING") this.transition("LISTENING");
    };
    this.turnDone = false;
    this.transition("ASSISTANT_SPEAKING");
  }

  /** Drops audio that has not been played yet (the user interrupted). */
  stopPlayback() {
    for (const source of this.sources) {
      source.onended = null;
      try {
        source.stop();
      } catch {}
    }
    this.sources.clear();
    this.playhead = 0;
  }

  /** Runs every function call the model asked for and returns the results in one tool response. */
  async runToolCalls(calls) {
    if (!calls.length) return;
    this.flushUser();
    this.transition("PROCESSING");
    const functionResponses = [];
    for (const call of calls) {
      let response;
      try {
        // The server checks confirmations against the user's latest words.
        const { result, proposesAction } = await api.runTool(call.name, call.args ?? {}, call.id, this.confirmTranscript);
        if (proposesAction) {
          this.confirmTranscript = "";
          this.callbacks.actionProposed?.();
        }
        response = { result };
      } catch (error) {
        response = { error: error instanceof Error ? error.message : "Tool unavailable. Please try again." };
      }
      if (this.disposed) return;
      if (!this.cancelledCalls.has(call.id)) functionResponses.push({ id: call.id, name: call.name, response });
    }
    if (functionResponses.length) this.send({ toolResponse: { functionResponses } });
  }

  /** Checks a spoken answer against server-side tool results; asks the model to correct unsupported amounts. */
  async validateSpoken(transcript) {
    try {
      const check = await api.validateVoice(transcript, this.lastUserTranscript);
      if (check.ok || this.disposed) return;
      const problems = [
        check.unsupportedAmounts.length && `you said ${check.unsupportedAmounts.join(", ")}, which is not in any tool result`,
        check.unsupportedSuccess && "you said something was done, but no action is confirmed",
      ].filter(Boolean);
      this.callbacks.transcript("assistant", "⚠️ Checking that again: I may have misstated something.");
      this.say(
        `[System check, not from the user] Validation failed: ${problems.join("; ")}. Briefly correct yourself using only tool values, or say you can't verify it.`,
      );
    } catch {
      // Validation is best-effort for voice; the text path validates before answering.
    }
  }

  fail(message) {
    this.transition("ERROR");
    this.callbacks.error(message);
    this.release();
  }

  release() {
    this.disposed = true;
    this.stopPlayback();
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) this.ws.close(1000);
    if (this.capture) this.capture.port.onmessage = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.ctx?.close().catch(() => {});
    this.ws = this.capture = this.stream = this.ctx = null;
  }

  async stop() {
    this.release();
    this.transition("DISCONNECTED");
  }
}
