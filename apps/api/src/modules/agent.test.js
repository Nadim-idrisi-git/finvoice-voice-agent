import { describe, expect, it } from "vitest";
import { createTransactions } from "../data/seed.js";
import { answerFinancialQuestion } from "./agent.js";
const records = createTransactions(/* @__PURE__ */ new Date("2026-10-17T00:00:00Z"));
describe("grounded assistant intent routing", () => {
  it("answers English and Hinglish totals from deterministic analytics", () => {
    const expected = answerFinancialQuestion("How much did I spend this month?", records);
    const hinglish = answerFinancialQuestion("Mere expenses kitne hain is month?", records);
    expect(expected.data).toEqual(hinglish.data);
    expect(hinglish.answer).toContain("Is mahine");
  });
  it("answers Hindi script and food category queries", () => {
    const answer = answerFinancialQuestion("\u0916\u093E\u0928\u0947 \u092A\u0930 \u0915\u093F\u0924\u0928\u093E \u0916\u0930\u094D\u091A \u0939\u0941\u0906?", records);
    expect(answer.intent).toBe("category");
    expect(answer.data).toHaveProperty("amountPaise");
  });
  it("answers bill and EMI details from synthetic schedules", () => {
    expect(answerFinancialQuestion("When is my next bill due?", records).intent).toBe("bills");
    expect(answerFinancialQuestion("Meri next EMI kab due hai?", records).intent).toBe("emis");
  });
  it("labels unusual spending as a candidate, never confirmed fraud", () => {
    const answer = answerFinancialQuestion("Identify unusual spending", records);
    expect(answer.intent).toBe("unusual_spending");
    expect(answer.answer).toContain("not a fraud finding");
  });
});
