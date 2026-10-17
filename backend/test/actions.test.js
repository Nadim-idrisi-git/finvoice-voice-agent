import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createMemoryStore } from "../src/store/memory.js";
import { createActionService } from "../src/services/actions.js";

const emptyStore = () => createMemoryStore({ transactions: [], bills: [], emis: [] });

describe("action service", () => {
  it("never lets one owner see or confirm another owner's action", async () => {
    const actions = createActionService(emptyStore());
    const mine = await actions.propose("alice", { type: "reminder", title: "Rent", details: "Pay rent" });
    assert.deepEqual(await actions.list("bob"), []);
    await assert.rejects(actions.confirm("bob", mine.id), { status: 404 });
    assert.equal((await actions.confirm("alice", mine.id)).status, "SUCCEEDED");
  });
  it("records spending alerts on confirmation", async () => {
    const store = emptyStore();
    const actions = createActionService(store);
    const alert = await actions.propose("alice", { type: "spending_alert", title: "Food cap", details: "Over 5000" });
    await actions.confirm("alice", alert.id);
    assert.equal((await store.alerts.list("alice")).length, 1);
    assert.equal((await store.reminders.list("alice")).length, 0);
  });
});
