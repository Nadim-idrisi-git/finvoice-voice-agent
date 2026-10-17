import { api } from "./api";
import { VoiceSessionStateMachine } from "./voiceState";

/**
 * Voice call with ElevenLabs for speech only; the answer comes from the backend agent.
 *
 *   mic → voice-activity detection → one utterance (MediaRecorder)
 *       → POST /voice/transcribe (ElevenLabs Scribe, Hindi/English)
 *       → POST /assistant/message { channel: "voice" } (OpenAI agent + validator, before speaking)
 *       → GET /voice/speech/:id (ElevenLabs TTS stream of that validated answer) → <audio>
 *
 * Interruption: speaking over the assistant stops playback at once and bumps `generation`, so any
 * in-flight transcript, answer, or audio from the old turn is discarded. Stopping audio never undoes
 * an action the backend already recorded. If ElevenLabs cannot speak, the browser's Web Speech API
 * reads the same validated answer.
 */

const POLL_MS = 40;
const START_LEVEL = 0.03; // RMS that counts as speech
const BARGE_IN_FACTOR = 1.8; // louder bar while the assistant is speaking (echo)
const START_MS = 120; // sustained speech before an utterance starts
const BARGE_IN_MS = 250; // sustained speech before interrupting the assistant
const SILENCE_MS = 900; // quiet time that ends an utterance
const MIN_UTTERANCE_MS = 350;

export class LiveVoiceSession {
  machine = new VoiceSessionStateMachine();
  stream = null;
  context = null;
  analyser = null;
  samples = null;
  recorder = null;
  audio = null;
  timer = 0;
  generation = 0;
  busy = false;
  fallbackSpeaking = false;
  loudSince = 0;
  lastVoiceAt = 0;
  utteranceStartedAt = 0;
  disposed = false;
  recognition = null; // Web Speech API fallback when ElevenLabs speech-to-text is unavailable

  constructor(callbacks) {
    this.callbacks = callbacks;
  }

  transition(next) {
    if (this.machine.transition(next)) this.callbacks.state(next);
  }

  async start() {
    this.transition("CONNECTING");
    try {
      const status = await api.voiceStatus();
      if (!status.configured) throw new Error("Voice is not configured. Add ELEVENLABS_API_KEY and OPENAI_API_KEY on the backend.");
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (this.disposed) return this.release();
      this.context = new AudioContext();
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 1024;
      this.samples = new Float32Array(this.analyser.fftSize);
      this.context.createMediaStreamSource(this.stream).connect(this.analyser);
      this.audio = new Audio();
      this.transition("LISTENING");
      this.timer = setInterval(() => this.tick(), POLL_MS);
      // The agent opens the call with the weekly briefing.
      void this.respond("The call has started.", this.generation);
    } catch (error) {
      const denied = error instanceof Error && error.name === "NotAllowedError";
      this.fail(denied ? "Microphone permission was denied. Allow it to use voice." : error instanceof Error ? error.message : "Could not start voice.");
    }
  }

  speaking() {
    return this.fallbackSpeaking || (this.audio && !this.audio.paused && !this.audio.ended);
  }

  level() {
    this.analyser.getFloatTimeDomainData(this.samples);
    let sum = 0;
    for (const v of this.samples) sum += v * v;
    return Math.sqrt(sum / this.samples.length);
  }

  /** Voice-activity detection: starts and ends utterances, and interrupts the assistant. */
  tick() {
    if (this.disposed || !this.analyser) return;
    const now = performance.now();
    const assistantActive = this.speaking() || this.busy;
    const loud = this.level() > (this.speaking() ? START_LEVEL * BARGE_IN_FACTOR : START_LEVEL);
    if (loud) {
      this.lastVoiceAt = now;
      this.loudSince ||= now;
    } else this.loudSince = 0;

    if (this.recognition) {
      // Browser recognition handles utterances; we only stop the assistant when the user talks over it.
      if (this.speaking() && loud && now - this.loudSince > BARGE_IN_MS) this.interrupt();
      return;
    }
    if (!this.recorder && loud && now - this.loudSince > (assistantActive ? BARGE_IN_MS : START_MS)) {
      if (assistantActive) this.interrupt();
      this.beginUtterance(now);
    } else if (this.recorder && now - this.lastVoiceAt > SILENCE_MS) {
      this.endUtterance();
    }
  }

  interrupt() {
    this.generation++; // discard anything still in flight from the previous turn
    this.busy = false;
    this.stopAudio();
    this.transition("INTERRUPTED");
  }

  beginUtterance(now) {
    const chunks = [];
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find((t) => MediaRecorder.isTypeSupported(t));
    const recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      const duration = this.lastVoiceAt - this.utteranceStartedAt;
      if (this.disposed) return;
      if (duration < MIN_UTTERANCE_MS) return this.transition("LISTENING");
      void this.handleUtterance(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }), this.generation);
    };
    this.recorder = recorder;
    this.utteranceStartedAt = now - this.loudSince > 0 ? this.loudSince : now;
    recorder.start();
    this.transition("USER_SPEAKING");
  }

  endUtterance() {
    const recorder = this.recorder;
    this.recorder = null;
    if (recorder?.state === "recording") recorder.stop();
  }

  async handleUtterance(blob, generation) {
    this.busy = true;
    this.transition("PROCESSING");
    try {
      const { text } = await api.transcribe(blob);
      if (generation !== this.generation || this.disposed) return;
      if (!text) {
        this.busy = false;
        return this.transition("LISTENING");
      }
      this.callbacks.transcript("you", text);
      await this.respond(text, generation);
    } catch (error) {
      if (generation !== this.generation) return;
      this.busy = false;
      const message = error instanceof Error ? error.message : "I couldn't hear that. Please try again.";
      if (/ElevenLabs|voice provider/i.test(message) && this.startBrowserRecognition()) {
        this.callbacks.notice?.(`${message} Using the browser's speech recognition instead; please repeat that.`);
      } else this.callbacks.error(message);
      this.transition("LISTENING");
    }
  }

  /** Fallback speech-to-text with the Web Speech API (Chrome: English or Hindi). Returns false if unsupported. */
  startBrowserRecognition() {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) return false;
    const recognition = new Recognition();
    recognition.lang = "en-IN";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const text = result?.[0]?.transcript?.trim();
      if (!text || this.disposed) return;
      if (this.speaking() || this.busy) this.interrupt();
      this.callbacks.transcript("you", text);
      void this.respond(text, this.generation);
    };
    // Recognition stops by itself after silence; keep it running for the whole call.
    recognition.onend = () => !this.disposed && this.recognition === recognition && recognition.start();
    this.recognition = recognition;
    recognition.start();
    return true;
  }

  /** Gets a validated answer from the backend agent and speaks it. */
  async respond(text, generation) {
    this.busy = true;
    this.transition("PROCESSING");
    try {
      const reply = await api.message(text, "voice");
      if (generation !== this.generation || this.disposed) return;
      this.callbacks.transcript("assistant", reply.answer);
      if (reply.actionProposal) this.callbacks.actionProposed?.();
      await this.speak(reply, generation);
    } catch (error) {
      if (generation !== this.generation) return;
      this.callbacks.error(error instanceof Error ? error.message : "The assistant is unavailable right now.");
      this.busy = false;
      this.transition("LISTENING");
    }
  }

  async speak(reply, generation) {
    this.busy = false;
    this.transition("ASSISTANT_SPEAKING");
    const done = () => generation === this.generation && !this.disposed && this.transition("LISTENING");
    if (reply.speechId) {
      try {
        this.audio.src = api.speechUrl(reply.speechId);
        this.audio.onended = done;
        await this.audio.play();
        await new Promise((resolve, reject) => {
          this.audio.onended = () => (done(), resolve());
          this.audio.onerror = () => reject(new Error("ElevenLabs audio failed"));
        });
        return;
      } catch {
        if (generation !== this.generation || this.disposed) return;
        this.callbacks.notice?.("ElevenLabs couldn't speak this reply (check plan or quota). Using the browser voice instead.");
      }
    }
    this.speakWithBrowser(reply.answer, generation, done);
  }

  /** Fallback: Web Speech API reads the same validated answer. */
  speakWithBrowser(text, generation, done) {
    if (!("speechSynthesis" in window)) return done();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = /[ऀ-ॿ]/.test(text) ? "hi-IN" : "en-IN";
    utterance.onend = utterance.onerror = () => {
      this.fallbackSpeaking = false;
      done();
    };
    this.fallbackSpeaking = true;
    window.speechSynthesis.speak(utterance);
  }

  stopAudio() {
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.audio.load();
    }
    if (this.fallbackSpeaking) window.speechSynthesis.cancel();
    this.fallbackSpeaking = false;
  }

  fail(message) {
    this.transition("ERROR");
    this.callbacks.error(message);
    this.release();
  }

  release() {
    this.disposed = true;
    this.generation++;
    clearInterval(this.timer);
    const recognition = this.recognition;
    this.recognition = null;
    recognition?.stop();
    this.endUtterance();
    this.stopAudio();
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.context?.close().catch(() => {});
    this.stream = this.context = this.analyser = this.audio = null;
  }

  async stop() {
    this.release();
    this.transition("DISCONNECTED");
  }
}
