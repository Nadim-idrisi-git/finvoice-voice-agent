import { api } from "./api";
const transitions = {
  IDLE: ["CONNECTING", "DISCONNECTED"],
  CONNECTING: ["LISTENING", "ERROR", "DISCONNECTED", "RECONNECTING"],
  LISTENING: [
    "USER_SPEAKING",
    "PROCESSING",
    "ASSISTANT_SPEAKING",
    "INTERRUPTED",
    "ERROR",
    "DISCONNECTED",
    "RECONNECTING",
  ],
  USER_SPEAKING: [
    "PROCESSING",
    "INTERRUPTED",
    "LISTENING",
    "ASSISTANT_SPEAKING",
    "ERROR",
    "DISCONNECTED",
    "RECONNECTING",
  ],
  PROCESSING: [
    "USER_SPEAKING",
    "ASSISTANT_SPEAKING",
    "LISTENING",
    "INTERRUPTED",
    "ERROR",
    "DISCONNECTED",
    "RECONNECTING",
  ],
  ASSISTANT_SPEAKING: ["INTERRUPTED", "LISTENING", "PROCESSING", "ERROR", "DISCONNECTED", "RECONNECTING"],
  INTERRUPTED: ["LISTENING", "PROCESSING", "ERROR", "DISCONNECTED"],
  RECONNECTING: ["CONNECTING", "LISTENING", "ERROR", "DISCONNECTED"],
  ERROR: ["CONNECTING", "IDLE", "DISCONNECTED"],
  DISCONNECTED: ["CONNECTING", "IDLE", "ERROR"],
};
class VoiceSessionStateMachine {
  value = "IDLE";
  get state() {
    return this.value;
  }
  transition(next) {
    if (next === this.value) return true;
    if (!transitions[this.value].includes(next)) return false;
    this.value = next;
    return true;
  }
}
class LiveVoiceSession {
  constructor(callbacks) {
    this.callbacks = callbacks;
  }
  callbacks;
  session = null;
  stream = null;
  context = null;
  source = null;
  processor = null;
  playing = new Set();
  generation = 0;
  disposed = false;
  ignoreAssistantOutput = false;
  modelTurnComplete = false;
  nextPlaybackTime = 0;
  machine = new VoiceSessionStateMachine();
  transition(next) {
    if (this.machine.transition(next)) this.callbacks.state(next);
  }
  async start() {
    this.transition("CONNECTING");
    try {
      const config = await api.voiceSession();
      const { GoogleGenAI, Modality } = await import("@google/genai");
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      this.context = new AudioContext();
      await this.context.audioWorklet.addModule("/pcm-worklet.js");
      const ai = new GoogleGenAI({ apiKey: config.token, httpOptions: { apiVersion: config.apiVersion } });
      this.session = await ai.live.connect({
        model: config.model,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voice } } },
          systemInstruction: config.systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          sessionResumption: {},
          tools: [{ functionDeclarations: config.tools ?? [] }],
        },
        callbacks: {
          onmessage: (message) => {
            void this.onMessage(message);
          },
          onerror: (event) => {
            this.transition("ERROR");
            this.callbacks.error(event.message || "Voice connection error.");
            void this.release();
          },
          onclose: () => {
            if (!this.disposed) this.transition("DISCONNECTED");
          },
        },
      });
      this.source = this.context.createMediaStreamSource(this.stream);
      this.processor = new AudioWorkletNode(this.context, "pcm-capture");
      this.processor.port.onmessage = (event) => {
        if (!this.session || this.disposed) return;
        const pcm = new Int16Array(event.data.length);
        for (let i = 0; i < pcm.length; i++) pcm[i] = Math.max(-1, Math.min(1, event.data[i])) * 32767;
        const bytes = new Uint8Array(pcm.buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        this.session.sendRealtimeInput({ audio: { data: btoa(binary), mimeType: "audio/pcm;rate=16000" } });
      };
      this.source.connect(this.processor);
      this.processor.connect(this.context.destination);
      this.transition("LISTENING");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not start voice. Check microphone permission and provider setup.";
      this.transition("ERROR");
      this.callbacks.error(message);
      await this.release();
    }
  }
  async onMessage(message) {
    const current = this.generation;
    const event = message;
    const server = event.serverContent;
    if (server?.interrupted) {
      this.generation++;
      this.ignoreAssistantOutput = true;
      this.modelTurnComplete = false;
      this.clearPlayback();
      this.transition("INTERRUPTED");
      this.transition("LISTENING");
      return;
    }
    if (server?.interimInputTranscription?.text) this.transition("USER_SPEAKING");
    if (server?.inputTranscription?.text) {
      this.ignoreAssistantOutput = false;
      this.modelTurnComplete = false;
      this.callbacks.transcript("you", server.inputTranscription.text);
      this.transition("PROCESSING");
    }
    if (server?.outputTranscription?.text && !this.ignoreAssistantOutput)
      this.callbacks.transcript("assistant", server.outputTranscription.text);
    if (server?.turnComplete) this.modelTurnComplete = true;
    const calls =
      event.toolCall?.functionCalls ??
      server?.modelTurn?.parts?.flatMap((p) => (p.functionCall ? [p.functionCall] : [])) ??
      [];
    if (calls.length) {
      this.transition("PROCESSING");
      for (const call of calls) {
        if (!call.name) continue;
        try {
          // The API owns the tool registry: it validates the name and arguments and scopes data to the user.
          const { result, proposesAction } = await api.runTool(call.name, call.args ?? {});
          if (current !== this.generation || this.disposed) return;
          if (proposesAction) this.callbacks.actionProposed?.();
          this.session?.sendToolResponse({
            functionResponses: [{ id: call.id, name: call.name, response: { result } }],
          });
        } catch {
          this.session?.sendToolResponse({
            functionResponses: [
              { id: call.id, name: call.name, response: { error: "Tool unavailable. Please try again." } },
            ],
          });
        }
      }
    }
    const audio = this.ignoreAssistantOutput
      ? []
      : (server?.modelTurn?.parts?.flatMap((p) =>
          p.inlineData?.data ? [{ data: p.inlineData.data, mimeType: p.inlineData.mimeType }] : [],
        ) ?? []);
    if (audio.length) {
      this.transition("ASSISTANT_SPEAKING");
      for (const chunk of audio) {
        if (current !== this.generation) return;
        await this.play(chunk.data, chunk.mimeType);
      }
    }
    if (current === this.generation && !this.disposed && this.modelTurnComplete && this.playing.size === 0)
      this.transition("LISTENING");
  }
  async play(base64, _mime) {
    if (!this.context) return;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < bytes.length; i++) bytes[i] = binary.charCodeAt(i);
    const pcm = new Int16Array(bytes.buffer);
    const audio = this.context.createBuffer(1, pcm.length, 24e3);
    const channel = audio.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 32768;
    const source = this.context.createBufferSource();
    source.buffer = audio;
    source.connect(this.context.destination);
    this.playing.add(source);
    const startAt = Math.max(this.context.currentTime + 0.01, this.nextPlaybackTime);
    this.nextPlaybackTime = startAt + audio.duration;
    await new Promise((resolve) => {
      source.onended = () => {
        this.playing.delete(source);
        resolve();
      };
      source.start(startAt);
    });
  }
  clearPlayback() {
    for (const source of this.playing) {
      try {
        source.stop();
      } catch {}
    }
    this.playing.clear();
    this.nextPlaybackTime = this.context?.currentTime ?? 0;
  }
  async release() {
    this.disposed = true;
    this.generation++;
    this.clearPlayback();
    this.processor?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.session?.close();
    await this.context?.close().catch(() => {});
    this.session = null;
    this.processor = null;
    this.source = null;
    this.stream = null;
    this.context = null;
  }
  async stop() {
    await this.release();
    this.transition("DISCONNECTED");
  }
}
export { LiveVoiceSession, VoiceSessionStateMachine };
