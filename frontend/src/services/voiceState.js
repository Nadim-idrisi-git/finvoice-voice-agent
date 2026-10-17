// Voice session lifecycle with an explicit transition table.
// Invalid jumps are ignored so late provider events cannot put the UI in an impossible state.

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
  INTERRUPTED: ["LISTENING", "USER_SPEAKING", "PROCESSING", "ERROR", "DISCONNECTED"],
  RECONNECTING: ["CONNECTING", "LISTENING", "ERROR", "DISCONNECTED"],
  ERROR: ["CONNECTING", "IDLE", "DISCONNECTED"],
  DISCONNECTED: ["CONNECTING", "IDLE", "ERROR"],
};
export class VoiceSessionStateMachine {
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
