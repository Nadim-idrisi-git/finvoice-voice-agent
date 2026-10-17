import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { moneyAmounts, supportedAmounts, validateAnswer } from "../src/services/validator.js";

const tools = [{ chargeAmountPaise: 59000, extraPaise: 236000, balanceTrailPaise: [2741000, 2682000], note: "Penalty ₹119.67" }];

describe("answer validator", () => {
  it("extracts rupee amounts in ₹, Rs, INR, and spoken forms", () => {
    assert.deepEqual(
      moneyAmounts("₹2,360 and Rs. 590, INR 1,000.50 or 200 rupees").map((a) => a.paise),
      [236000, 59000, 100050, 20000],
    );
  });
  it("collects supported amounts from paise fields, arrays, and formatted strings", () => {
    const allowed = supportedAmounts(tools);
    for (const p of [59000, 236000, 2741000, 2682000, 11967]) assert.ok(allowed.has(p), String(p));
  });
  it("passes answers whose amounts all come from tools or the user", () => {
    const r = validateAnswer({ answer: "IDFC charged ₹590 five times; ₹2,360 is duplicate. You said ₹50,000.", toolResults: tools, userMessage: "I earn ₹50,000" });
    assert.equal(r.ok, true);
  });
  it("flags invented amounts and unsupported rounding", () => {
    const r = validateAnswer({ answer: "Your balance is ₹1,00,000 and the penalty was ₹120.", toolResults: tools, userMessage: "" });
    assert.equal(r.ok, false);
    assert.deepEqual(r.unsupportedAmounts.map((a) => a.text), ["₹1,00,000", "₹120"]);
  });
  it("does not treat negated statements as success claims", () => {
    for (const answer of ["I've drafted it; it has not been sent to the bank yet.", "Draft ready, abhi bheja nahi gaya hai.", "It hasn't been submitted."])
      assert.equal(validateAnswer({ answer, toolResults: [], hasSucceededAction: false }).unsupportedSuccess, false, answer);
  });
  it("rejects 'not found' answers when no tool was called, but allows them after a lookup", () => {
    const answer = "I couldn't find a matching IDFC transaction in your records.";
    assert.equal(validateAnswer({ answer, toolResults: [], toolsCalled: 0 }).uncheckedNotFound, true);
    assert.equal(validateAnswer({ answer, toolResults: [], toolsCalled: 1 }).ok, true);
  });
  it("flags success claims when nothing was confirmed", () => {
    assert.equal(validateAnswer({ answer: "Done, the request is submitted.", toolResults: [], hasSucceededAction: false }).unsupportedSuccess, true);
    assert.equal(validateAnswer({ answer: "Done, it is in Actions.", toolResults: [], hasSucceededAction: true }).ok, true);
  });
});
