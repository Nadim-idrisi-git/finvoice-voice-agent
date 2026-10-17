import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { VoiceSessionStateMachine } from "./voiceState.js";

describe("voice lifecycle state machine", () => {
  it("accepts the listen, process, speak, and barge-in loop", () => {
    const machine = new VoiceSessionStateMachine();
    for (const state of ["CONNECTING", "LISTENING", "USER_SPEAKING", "PROCESSING", "ASSISTANT_SPEAKING", "INTERRUPTED", "USER_SPEAKING", "PROCESSING"]) {
      assert.equal(machine.transition(state), true, `transition to ${state}`);
    }
  });
  it("rejects invalid lifecycle jumps and allows recovery after provider errors", () => {
    const machine = new VoiceSessionStateMachine();
    assert.equal(machine.transition("ASSISTANT_SPEAKING"), false);
    assert.equal(machine.state, "IDLE");
    assert.equal(machine.transition("CONNECTING"), true);
    assert.equal(machine.transition("ERROR"), true);
    assert.equal(machine.transition("CONNECTING"), true);
  });
});
