import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  categoryTotals,
  compareMonths,
  expenseTotal,
  recurringSubscriptions,
  unusualSpending,
} from "../src/modules/analytics.js";
import { tx } from "./helpers.js";

const rows = [
  tx({ id: "a", occurredAt: "2026-10-01T00:00:00Z", amountPaise: 110 }),
  tx({ id: "b", occurredAt: "2026-10-02T00:00:00Z", amountPaise: 90 }),
  tx({ id: "c", occurredAt: "2026-10-03T00:00:00Z", merchant: "Refund", amountPaise: 30, kind: "refund" }),
  tx({ id: "d", occurredAt: "2026-10-04T00:00:00Z", merchant: "Pay", category: "Income", amountPaise: 900, kind: "income" }),
];

describe("deterministic money calculations", () => {
  it("sums paise without floating point and excludes income and refunds", () => {
    assert.equal(expenseTotal(rows, "2026-10"), 200);
  });
  it("returns category totals and comparison", () => {
    assert.deepEqual(categoryTotals(rows, "2026-10"), [{ category: "Food", amountPaise: 200 }]);
    assert.equal(compareMonths(rows, "2026-10", "2026-09").currentPaise, 200);
  });
  it("counts subscription recurrence by distinct months", () => {
    const stream = (id, occurredAt, amountPaise) =>
      tx({ id, occurredAt, amountPaise, merchant: "Stream", category: "Subscriptions" });
    const all = [
      ...rows,
      stream("s1", "2026-09-01T00:00:00Z", 100),
      stream("s2", "2026-09-02T00:00:00Z", 100),
      stream("s3", "2026-10-02T00:00:00Z", 300),
    ];
    assert.deepEqual(recurringSubscriptions(all), [{ merchant: "Stream", monthlyAmountPaise: 250, occurrences: 2 }]);
  });
  it("flags any transaction far above its category median, regardless of id", () => {
    const found = unusualSpending([...rows, tx({ id: "any-id", occurredAt: "2026-10-06T00:00:00Z", amountPaise: 5000 })]);
    assert.deepEqual(
      found.map((x) => x.id),
      ["any-id"],
    );
    assert.equal(found[0].comparisonPaise, 100);
  });
  it("needs enough category history before flagging", () => {
    assert.deepEqual(unusualSpending([{ ...rows[0], amountPaise: 1e6 }, rows[1]]), []);
  });
});
