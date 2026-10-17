import { describe, expect, it } from "vitest";
import { VoiceSessionStateMachine } from "./voice";
describe("voice lifecycle state machine", () => {
  it("accepts the listen, process, speak, and barge-in loop", () => {
    const machine = new VoiceSessionStateMachine();
    expect(machine.transition("CONNECTING")).toBe(true);
    expect(machine.transition("LISTENING")).toBe(true);
    expect(machine.transition("USER_SPEAKING")).toBe(true);
    expect(machine.transition("PROCESSING")).toBe(true);
    expect(machine.transition("ASSISTANT_SPEAKING")).toBe(true);
    expect(machine.transition("INTERRUPTED")).toBe(true);
    expect(machine.transition("LISTENING")).toBe(true);
  });
  it("rejects invalid lifecycle jumps and allows recovery after provider errors", () => {
    const machine = new VoiceSessionStateMachine();
    expect(machine.transition("ASSISTANT_SPEAKING")).toBe(false);
    expect(machine.state).toBe("IDLE");
    expect(machine.transition("CONNECTING")).toBe(true);
    expect(machine.transition("ERROR")).toBe(true);
    expect(machine.transition("CONNECTING")).toBe(true);
  });
});
