import { createTransactions, syntheticBills, syntheticEmis } from "../data/seed.js";

// Every store method is async and owner-scoped so a persistent implementation
// (e.g. MongoDB) can replace this one without changing callers.

function ownedCollection() {
  const items = [];
  const find = (ownerId, id) => items.find((item) => item.ownerId === ownerId && item.id === id);
  return {
    list: async (ownerId) => items.filter((item) => item.ownerId === ownerId).map((item) => ({ ...item })),
    get: async (ownerId, id) => {
      const item = find(ownerId, id);
      return item ? { ...item } : null;
    },
    insert: async (doc) => {
      items.unshift({ ...doc });
      return { ...doc };
    },
    update: async (ownerId, id, patch) => {
      const item = find(ownerId, id);
      if (!item) return null;
      Object.assign(item, patch);
      return { ...item };
    },
  };
}

export function createMemoryStore({
  transactions = createTransactions(),
  bills = syntheticBills,
  emis = syntheticEmis,
} = {}) {
  const owned = (rows) => async (ownerId) => rows.filter((row) => row.ownerId === ownerId);
  return {
    kind: "memory",
    transactions: owned(transactions),
    bills: owned(bills),
    emis: owned(emis),
    actions: ownedCollection(),
    reminders: ownedCollection(),
    alerts: ownedCollection(),
    audit: ownedCollection(),
  };
}
