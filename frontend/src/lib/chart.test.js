import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chartSeries, donutGradient } from "./chart.js";
import { formatRupees, previousMonth } from "./format.js";

describe("chart and format helpers", () => {
  it("builds a cumulative sparkline that ends at the top of the chart", () => {
    const { line, labels } = chartSeries([{ day: 1, amountPaise: 100 }, { day: 15, amountPaise: 100 }], "2026-10");
    assert.match(line, /^M0\.0,82\.0 L0\.0,49\.5 L289\.3,17\.0$/);
    assert.equal(labels.length, 5);
  });
  it("splits the donut by category share", () => {
    const gradient = donutGradient([{ amountPaise: 75 }, { amountPaise: 25 }]);
    assert.match(gradient, /0% 75%/);
    assert.match(gradient, /75% 100%/);
  });
  it("formats rupees and months like the backend", () => {
    assert.equal(formatRupees(235000), "₹2,350");
    assert.equal(previousMonth("2026-01"), "2025-12");
  });
});
