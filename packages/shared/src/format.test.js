import { describe, expect, it } from "vitest";
import { formatRupees, isValidMonth, monthName, previousMonth } from "./format.js";

describe("shared formatting", () => {
  it("formats paise as Indian rupees", () => {
    expect(formatRupees(235000)).toBe("₹2,350");
    expect(formatRupees(6924787)).toBe("₹69,247.87");
  });
  it("handles month arithmetic and validation", () => {
    expect(previousMonth("2026-01")).toBe("2025-12");
    expect(monthName("2026-08")).toBe("August 2026");
    expect(isValidMonth("2026-12")).toBe(true);
    expect(isValidMonth("2026-13")).toBe(false);
  });
});
