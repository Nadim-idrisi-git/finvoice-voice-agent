import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createTransactions, syntheticBills, syntheticEmis } from "../src/data/seed.js";
import { answerFinancialQuestion, detectActionRequest } from "../src/modules/rules.js";

const records = {
  transactions: createTransactions(new Date("2026-10-17T00:00:00Z")),
  bills: syntheticBills,
  emis: syntheticEmis,
};
const ask = (q) => answerFinancialQuestion(q, records);

describe("rule-based fallback assistant", () => {
  it("answers English and Hinglish totals from deterministic analytics", () => {
    const hinglish = ask("Mere expenses kitne hain is month?");
    assert.deepEqual(ask("How much did I spend this month?").data, hinglish.data);
    assert.match(hinglish.answer, /Is mahine/);
  });
  it("answers Hindi script and food category queries", () => {
    const answer = ask("खाने पर कितना खर्च हुआ?");
    assert.equal(answer.intent, "category");
    assert.ok("amountPaise" in answer.data);
  });
  it("answers bill and EMI details from synthetic schedules", () => {
    assert.equal(ask("When is my next bill due?").intent, "bills");
    assert.equal(ask("Meri next EMI kab due hai?").intent, "emis");
  });
  it("labels unusual spending as a candidate, never confirmed fraud", () => {
    const answer = ask("Identify unusual spending");
    assert.equal(answer.intent, "unusual_spending");
    assert.match(answer.answer, /not a fraud finding/);
    assert.deepEqual(
      answer.data.map((x) => x.id),
      ["tx-synthetic-outlier"],
    );
  });
  it("names the requested month instead of saying this month", () => {
    const answer = ask("How much did I spend in 2026-08?");
    assert.equal(answer.data.month, "2026-08");
    assert.match(answer.answer, /in August 2026/);
    assert.doesNotMatch(answer.answer, /this month/);
    assert.match(ask("Compare 2026-08 with previous month").answer, /July 2026/);
  });
  it("breaks spending down by category and sums to the monthly total", () => {
    const answer = ask("Break down my spending by category");
    assert.equal(answer.intent, "category_breakdown");
    assert.ok(answer.data.categories.length > 1);
    assert.equal(answer.data.totalPaise, ask("How much did I spend this month?").data.amountPaise);
  });
  it("answers income questions", () => {
    const answer = ask("Show me my income");
    assert.equal(answer.intent, "income");
    assert.match(answer.answer, /₹/);
  });
  it("lists every upcoming bill in due-date order", () => {
    const answer = ask("What bills are coming up?");
    assert.deepEqual(
      answer.data.map((b) => b.id),
      ["bill-power", "bill-internet", "bill-phone"],
    );
    for (const bill of answer.data) assert.match(answer.answer, new RegExp(bill.name));
  });
  it("rejects impossible months", () => {
    assert.equal(ask("How much did I spend in 2026-13?").intent, "unknown");
  });
  it("detects reminder and alert requests", () => {
    assert.equal(detectActionRequest("Remind me before rent")?.type, "reminder");
    assert.equal(detectActionRequest("Set a spending alert for food")?.type, "spending_alert");
    assert.equal(detectActionRequest("How much did I spend?"), null);
  });
});
