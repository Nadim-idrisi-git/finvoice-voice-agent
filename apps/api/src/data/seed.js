const DEMO_USER = { id: "demo-nadim", name: "Nadim Idrisi", currency: "INR" };
const merchants = [
  ["FreshMart", "Groceries"],
  ["Urban Cafe", "Food & Dining"],
  ["Metro Transit", "Transport"],
  ["Streamly", "Subscriptions"],
  ["Power Utility", "Bills"],
  ["HealthPlus Pharmacy", "Healthcare"],
  ["TechStore", "Shopping"],
  ["Salary", "Income"],
  ["QuickBite", "Food & Dining"],
  ["City Fuel", "Transport"],
  ["Book Nook", "Shopping"],
  ["CloudBox", "Subscriptions"]
];
function seededRandom(seed) {
  let n = seed;
  return () => ((n = n * 16807 % 2147483647) - 1) / 2147483646;
}
function createTransactions(now = /* @__PURE__ */ new Date()) {
  const random = seededRandom(417);
  const result = [];
  for (let monthOffset = 0; monthOffset < 7; monthOffset++) {
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthOffset, 1));
    for (let i = 0; i < 24; i++) {
      const [merchant, category] = merchants[Math.floor(random() * merchants.length)];
      const income = merchant === "Salary";
      const base = income ? 92e5 : Math.round((180 + random() * (category === "Food & Dining" ? 1600 : 4800)) * 100);
      const day = 1 + Math.floor(random() * 26);
      const date = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day, 10));
      result.push({ id: `tx-${monthOffset}-${i}`, ownerId: DEMO_USER.id, occurredAt: date.toISOString(), merchant, category, amountPaise: base, currency: "INR", kind: income ? "income" : "expense" });
    }
  }
  const current = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 9, 12));
  result.push({ id: "tx-synthetic-outlier", ownerId: DEMO_USER.id, occurredAt: current.toISOString(), merchant: "TechStore", category: "Shopping", amountPaise: 245e4, currency: "INR", kind: "expense" });
  return result;
}
const syntheticBills = [
  { id: "bill-power", ownerId: DEMO_USER.id, name: "Electricity", amountPaise: 235e3, dueAt: new Date(Date.now() + 4 * 864e5).toISOString(), status: "upcoming" },
  { id: "bill-internet", ownerId: DEMO_USER.id, name: "Internet", amountPaise: 89900, dueAt: new Date(Date.now() + 8 * 864e5).toISOString(), status: "upcoming" },
  { id: "bill-phone", ownerId: DEMO_USER.id, name: "Mobile plan", amountPaise: 59900, dueAt: new Date(Date.now() + 13 * 864e5).toISOString(), status: "upcoming" }
];
const syntheticEmis = [
  { id: "emi-laptop", ownerId: DEMO_USER.id, name: "Laptop EMI", installmentPaise: 425e3, nextDueAt: new Date(Date.now() + 6 * 864e5).toISOString(), remainingInstallments: 8 },
  { id: "emi-bike", ownerId: DEMO_USER.id, name: "Two-wheeler EMI", installmentPaise: 68e4, nextDueAt: new Date(Date.now() + 18 * 864e5).toISOString(), remainingInstallments: 14 }
];
export {
  DEMO_USER,
  createTransactions,
  syntheticBills,
  syntheticEmis
};
