import { describe, expect, it } from "vitest";
import { createMemoryStore } from "../store/memory.js";
import { createActionService } from "./actions.js";

describe("action service", () => {
  it("never lets one owner see or confirm another owner's action", async () => {
    const store = createMemoryStore({ transactions: [], bills: [], emis: [] });
    const actions = createActionService(store);
    const mine = await actions.propose("alice", { type: "reminder", title: "Rent", details: "Pay rent" });
    expect(await actions.list("bob")).toEqual([]);
    await expect(actions.confirm("bob", mine.id)).rejects.toMatchObject({ status: 404 });
    expect((await actions.confirm("alice", mine.id)).status).toBe("SUCCEEDED");
  });
  it("records spending alerts on confirmation", async () => {
    const store = createMemoryStore({ transactions: [], bills: [], emis: [] });
    const actions = createActionService(store);
    const alert = await actions.propose("alice", { type: "spending_alert", title: "Food cap", details: "Over 5000" });
    await actions.confirm("alice", alert.id);
    expect(await store.alerts.list("alice")).toHaveLength(1);
    expect(await store.reminders.list("alice")).toHaveLength(0);
  });
});
