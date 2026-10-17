import { describe, expect, it } from "vitest";
import { categoryTotals, compareMonths, expenseTotal, previousMonth, recurringSubscriptions, unusualSpending } from "./analytics.js";
const rows = [
  { id: "a", ownerId: "u", occurredAt: "2026-10-01T00:00:00Z", merchant: "Cafe", category: "Food", amountPaise: 110, currency: "INR", kind: "expense" },
  { id: "b", ownerId: "u", occurredAt: "2026-10-02T00:00:00Z", merchant: "Cafe", category: "Food", amountPaise: 90, currency: "INR", kind: "expense" },
  { id: "c", ownerId: "u", occurredAt: "2026-10-03T00:00:00Z", merchant: "Refund", category: "Food", amountPaise: 30, currency: "INR", kind: "refund" },
  { id: "d", ownerId: "u", occurredAt: "2026-10-04T00:00:00Z", merchant: "Pay", category: "Income", amountPaise: 900, currency: "INR", kind: "income" }
];
describe("deterministic money calculations", () => {
  it("sums paise without floating point and excludes income and refunds", () => {
    expect(expenseTotal(rows, "2026-10")).toBe(200);
  });
  it("returns category totals and comparison", () => {
    expect(categoryTotals(rows, "2026-10")).toEqual([{ category: "Food", amountPaise: 200 }]);
    expect(compareMonths(rows, "2026-10", "2026-09").currentPaise).toBe(200);
  });
  it("handles year boundaries", () => {
    expect(previousMonth("2026-01")).toBe("2025-12");
  });
  it("counts subscription recurrence by distinct months", () => {
    const subscriptions = [...rows, { id: "s1", ownerId: "u", occurredAt: "2026-09-01T00:00:00Z", merchant: "Stream", category: "Subscriptions", amountPaise: 100, currency: "INR", kind: "expense" }, { id: "s2", ownerId: "u", occurredAt: "2026-09-02T00:00:00Z", merchant: "Stream", category: "Subscriptions", amountPaise: 100, currency: "INR", kind: "expense" }, { id: "s3", ownerId: "u", occurredAt: "2026-10-02T00:00:00Z", merchant: "Stream", category: "Subscriptions", amountPaise: 300, currency: "INR", kind: "expense" }];
    expect(recurringSubscriptions(subscriptions)).toEqual([{ merchant: "Stream", monthlyAmountPaise: 250, occurrences: 2 }]);
  });
  it("flags any transaction far above its category median, regardless of id", () => {
    const outlier = { id: "any-id", ownerId: "u", occurredAt: "2026-10-06T00:00:00Z", merchant: "Fancy Diner", category: "Food", amountPaise: 5e3, currency: "INR", kind: "expense" };
    const found = unusualSpending([...rows, outlier]);
    expect(found.map((x) => x.id)).toEqual(["any-id"]);
    expect(found[0].comparisonPaise).toBe(100);
  });
  it("needs enough category history before flagging", () => {
    expect(unusualSpending([{ ...rows[0], amountPaise: 1e6 }, rows[1]])).toEqual([]);
  });
  it("flags only a synthetic unusually large transaction as a candidate", () => {
    expect(unusualSpending([...rows, { id: "tx-synthetic-outlier", ownerId: "u", occurredAt: "2026-10-05T00:00:00Z", merchant: "TechStore", category: "Food", amountPaise: 1e5, currency: "INR", kind: "expense" }])).toHaveLength(1);
  });
});
