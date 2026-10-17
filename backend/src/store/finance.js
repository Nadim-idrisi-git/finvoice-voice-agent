/** Everything the analytics and assistant modules need for one owner, from any store. */
export async function loadFinance(store, ownerId) {
  const [transactions, bills, emis] = await Promise.all([
    store.transactions(ownerId),
    store.bills(ownerId),
    store.emis(ownerId),
  ]);
  return { transactions, bills, emis };
}
