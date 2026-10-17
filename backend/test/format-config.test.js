import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatRupees, isValidMonth, monthName, previousMonth } from "../src/lib/format.js";
import { loadConfig } from "../src/config.js";
import { validateAction, validateMessage } from "../src/lib/validate.js";

describe("formatting", () => {
  it("formats paise as Indian rupees", () => {
    assert.equal(formatRupees(235000), "₹2,350");
    assert.equal(formatRupees(6924787), "₹69,247.87");
    assert.equal(formatRupees(-3011), "-₹30.11");
  });
  it("handles month arithmetic and validation", () => {
    assert.equal(previousMonth("2026-01"), "2025-12");
    assert.equal(monthName("2026-08"), "August 2026");
    assert.equal(isValidMonth("2026-12"), true);
    assert.equal(isValidMonth("2026-13"), false);
  });
});

describe("config and validation", () => {
  it("applies defaults and rejects bad values", () => {
    const config = loadConfig({});
    assert.equal(config.PORT, 4100);
    assert.equal(config.OPENAI_REALTIME_MODEL, "gpt-realtime-2.1");
    assert.equal(config.OPENAI_API_KEY, undefined);
    assert.throws(() => loadConfig({ PORT: "abc" }), /PORT/);
    assert.throws(() => loadConfig({ NODE_ENV: "staging" }), /NODE_ENV/);
  });
  it("bounds message size and action types", () => {
    assert.ok(validateMessage({ message: "x".repeat(1201) }).error);
    assert.ok(validateMessage({ message: "   " }).error);
    assert.equal(validateMessage({ message: " hi " }).value.message, "hi");
    assert.ok(validateAction({ type: "transfer", title: "Send", details: "money" }).error);
    assert.ok(validateAction({ type: "reminder", title: "ok", details: "too short title" }).error);
  });
});
