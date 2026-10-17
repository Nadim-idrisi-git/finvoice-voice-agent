class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() { super(); this.pending = []; this.ratio = sampleRate / 16000; this.phase = 0; this.packet = []; }
  process(inputs) {
    const channel = inputs[0]?.[0]; if (!channel) return true;
    this.pending.push(...channel);
    const output = [];
    while (this.phase < this.pending.length) { output.push(this.pending[Math.floor(this.phase)]); this.phase += this.ratio; }
    this.phase -= this.pending.length; this.pending = [];
    this.packet.push(...output);
    while (this.packet.length >= 320) this.port.postMessage(Float32Array.from(this.packet.splice(0, 320)));
    return true;
  }
}
registerProcessor('pcm-capture', PcmCaptureProcessor);
