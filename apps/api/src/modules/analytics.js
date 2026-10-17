const rupees = (paise) => `\u20B9${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const monthKey = (date) => date.slice(0, 7);
function expenseTotal(rows, month) {
  return rows
    .filter((t) => monthKey(t.occurredAt) === month && t.kind === "expense")
    .reduce((sum, t) => sum + t.amountPaise, 0);
}
function incomeTotal(rows, month) {
  return rows
    .filter((t) => monthKey(t.occurredAt) === month && t.kind === "income")
    .reduce((sum, t) => sum + t.amountPaise, 0);
}
function categoryTotals(rows, month) {
  const sums = /* @__PURE__ */ new Map();
  for (const t of rows)
    if (monthKey(t.occurredAt) === month && t.kind === "expense")
      sums.set(t.category, (sums.get(t.category) ?? 0) + t.amountPaise);
  return [...sums]
    .map(([category, amountPaise]) => ({ category, amountPaise }))
    .sort((a, b) => b.amountPaise - a.amountPaise);
}
function merchantTotals(rows, month) {
  const sums = /* @__PURE__ */ new Map();
  for (const t of rows)
    if (monthKey(t.occurredAt) === month && t.kind === "expense")
      sums.set(t.merchant, (sums.get(t.merchant) ?? 0) + t.amountPaise);
  return [...sums]
    .map(([merchant, amountPaise]) => ({ merchant, amountPaise }))
    .sort((a, b) => b.amountPaise - a.amountPaise);
}
function compareMonths(rows, current, previous) {
  const currentPaise = expenseTotal(rows, current);
  const previousPaise = expenseTotal(rows, previous);
  return {
    current,
    previous,
    currentPaise,
    previousPaise,
    changePaise: currentPaise - previousPaise,
    changePercent: previousPaise ? Math.round(((currentPaise - previousPaise) / previousPaise) * 1e3) / 10 : null,
  };
}
function recurringSubscriptions(rows) {
  const groups = /* @__PURE__ */ new Map();
  for (const t of rows)
    if (t.category === "Subscriptions" && t.kind === "expense") {
      const monthly = groups.get(t.merchant) ?? /* @__PURE__ */ new Map();
      monthly.set(monthKey(t.occurredAt), (monthly.get(monthKey(t.occurredAt)) ?? 0) + t.amountPaise);
      groups.set(t.merchant, monthly);
    }
  return [...groups]
    .filter(([, months]) => months.size >= 2)
    .map(([merchant, months]) => ({
      merchant,
      monthlyAmountPaise: Math.round([...months.values()].reduce((a, b) => a + b, 0) / months.size),
      occurrences: months.size,
    }));
}
const UNUSUAL_MULTIPLIER = 4;
const MIN_HISTORY = 2;
function median(sorted) {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}
function unusualSpending(rows) {
  const groups = /* @__PURE__ */ new Map();
  for (const t of rows)
    if (t.kind === "expense") groups.set(t.category, [...(groups.get(t.category) ?? []), t.amountPaise]);
  for (const values of groups.values()) values.sort((a, b) => a - b);
  return rows
    .flatMap((t) => {
      if (t.kind !== "expense") return [];
      const values = groups.get(t.category);
      if (values.length - 1 < MIN_HISTORY) return [];
      const others = [...values];
      others.splice(others.indexOf(t.amountPaise), 1);
      const comparisonPaise = median(others);
      if (comparisonPaise <= 0 || t.amountPaise <= comparisonPaise * UNUSUAL_MULTIPLIER) return [];
      return [
        {
          id: t.id,
          merchant: t.merchant,
          category: t.category,
          amountPaise: t.amountPaise,
          occurredAt: t.occurredAt,
          comparisonPaise,
          note: "Unusual amount candidate compared with the median of other transactions in this category; not a fraud determination.",
        },
      ];
    })
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}
function currentMonth(date = /* @__PURE__ */ new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
function previousMonth(month) {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 2, 1));
  return currentMonth(date);
}
export {
  categoryTotals,
  compareMonths,
  currentMonth,
  expenseTotal,
  incomeTotal,
  merchantTotals,
  previousMonth,
  recurringSubscriptions,
  rupees,
  unusualSpending,
};
