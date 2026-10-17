import { describe, expect, it } from "vitest";
import { actionSchema, messageSchema } from "./index.js";
describe("shared validation", () => {
  it("bounds message size", () => {
    expect(messageSchema.safeParse({ message: "x".repeat(1201) }).success).toBe(false);
  });
  it("rejects unsupported action types", () => {
    expect(actionSchema.safeParse({ type: "transfer", title: "Send", details: "money" }).success).toBe(false);
  });
});
