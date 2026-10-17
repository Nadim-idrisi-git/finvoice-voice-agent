import { api } from "./api";
import { VoiceSessionStateMachine } from "./voiceState";

/**
 * Live voice with the OpenAI Realtime API over WebRTC.
 *
 * 1. The backend mints a short-lived client secret (the API key never reaches the browser).
 * 2. The browser opens a peer connection: microphone audio goes up, model audio comes back
 *    on a remote track, and JSON events flow over the "oai-events" data channel.
 * 3. When the model calls a tool, the call is forwarded to the backend tool registry and the
 *    result is sent back on the data channel. Interruption is handled by the server: it
 *    truncates unplayed audio when the user starts speaking.
 */
export class LiveVoiceSession {
  machine = new VoiceSessionStateMachine();
  pc = null;
  channel = null;
  stream = null;
  audio = null;
  disposed = false;

  constructor(callbacks) {
    this.callbacks = callbacks;
  }

  transition(next) {
    if (this.machine.transition(next)) this.callbacks.state(next);
  }

  async start() {
    this.transition("CONNECTING");
    try {
      const session = await api.voiceSession();
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (this.disposed) return this.release();

      this.pc = new RTCPeerConnection();
      this.audio = document.createElement("audio");
      this.audio.autoplay = true;
      this.pc.ontrack = (event) => (this.audio.srcObject = event.streams[0]);
      this.pc.onconnectionstatechange = () => {
        if (["failed", "disconnected"].includes(this.pc?.connectionState) && !this.disposed) {
          this.fail("The voice connection dropped. Start voice again to reconnect.");
        }
      };
      this.pc.addTrack(this.stream.getAudioTracks()[0], this.stream);

      this.channel = this.pc.createDataChannel("oai-events");
      this.channel.onopen = () => {
        this.transition("LISTENING");
        // The agent opens the call ("Sunday money call") instead of waiting for the user.
        this.send({ type: "response.create" });
      };
      this.channel.onmessage = (event) => void this.onEvent(JSON.parse(event.data));
      this.channel.onclose = () => !this.disposed && this.transition("DISCONNECTED");

      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      const response = await fetch(session.callsUrl, {
        method: "POST",
        body: offer.sdp,
        headers: { Authorization: `Bearer ${session.clientSecret}`, "Content-Type": "application/sdp" },
      });
      if (!response.ok) throw new Error("OpenAI could not start the voice call. Check the realtime model and key.");
      await this.pc.setRemoteDescription({ type: "answer", sdp: await response.text() });
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

  send(event) {
    if (this.channel?.readyState === "open") this.channel.send(JSON.stringify(event));
  }

  async onEvent(event) {
    switch (event.type) {
      case "input_audio_buffer.speech_started":
        if (this.machine.state === "ASSISTANT_SPEAKING") this.transition("INTERRUPTED");
        this.transition("USER_SPEAKING");
        break;
      case "input_audio_buffer.speech_stopped":
        this.transition("PROCESSING");
        break;
      case "conversation.item.input_audio_transcription.completed":
        if (event.transcript?.trim()) this.callbacks.transcript("you", event.transcript.trim());
        break;
      case "output_audio_buffer.started":
        this.transition("ASSISTANT_SPEAKING");
        break;
      case "output_audio_buffer.stopped":
      case "output_audio_buffer.cleared":
        this.transition("LISTENING");
        break;
      case "response.output_audio_transcript.done":
        if (event.transcript?.trim()) this.callbacks.transcript("assistant", event.transcript.trim());
        break;
      case "response.done":
        await this.runToolCalls(event.response?.output ?? []);
        break;
      case "error":
        this.callbacks.error(event.error?.message ?? "The voice provider reported an error.");
        break;
    }
  }

  /** Runs every function call in a finished response, returns results, then asks the model to continue. */
  async runToolCalls(output) {
    const calls = output.filter((item) => item.type === "function_call");
    if (!calls.length) return;
    this.transition("PROCESSING");
    for (const call of calls) {
      let result;
      try {
        const { result: data, proposesAction } = await api.runTool(call.name, JSON.parse(call.arguments || "{}"));
        if (proposesAction) this.callbacks.actionProposed?.();
        result = data;
      } catch (error) {
        result = { error: error instanceof Error ? error.message : "Tool unavailable. Please try again." };
      }
      if (this.disposed) return;
      this.send({
        type: "conversation.item.create",
        item: { type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) },
      });
    }
    this.send({ type: "response.create" });
  }

  fail(message) {
    this.transition("ERROR");
    this.callbacks.error(message);
    this.release();
  }

  release() {
    this.disposed = true;
    this.channel?.close();
    this.pc?.close();
    this.stream?.getTracks().forEach((track) => track.stop());
    if (this.audio) this.audio.srcObject = null;
    this.channel = this.pc = this.stream = this.audio = null;
  }

  async stop() {
    this.release();
    this.transition("DISCONNECTED");
  }
}
