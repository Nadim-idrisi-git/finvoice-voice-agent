import crypto from "node:crypto";
import { HttpError } from "../http.js";

// Proposal → explicit confirmation → execution, with an audit trail.
// Execution only creates in-app records; nothing leaves the app.

export function createActionService(store, { now = () => new Date(), newId = () => crypto.randomUUID() } = {}) {
  async function record(ownerId, actionId, event, at) {
    await store.audit.insert({ id: newId(), ownerId, actionId, event, at });
  }

  async function propose(ownerId, { type, title, details }) {
    const action = {
      id: newId(),
      ownerId,
      type,
      title,
      details,
      status: "AWAITING_CONFIRMATION",
      createdAt: now().toISOString(),
    };
    await store.actions.insert(action);
    await record(ownerId, action.id, "PROPOSED", action.createdAt);
    return action;
  }

  async function confirm(ownerId, actionId) {
    const action = await store.actions.get(ownerId, actionId);
    if (!action) throw new HttpError(404, "Action not found.");
    if (action.status === "SUCCEEDED") return action;
    if (action.status !== "AWAITING_CONFIRMATION") throw new HttpError(409, `Action is ${action.status}.`);
    const confirmedAt = now().toISOString();
    const updated = await store.actions.update(ownerId, actionId, { status: "SUCCEEDED", confirmedAt });
    const entry = { id: newId(), ownerId, title: action.title, details: action.details, createdAt: confirmedAt };
    if (action.type === "reminder") await store.reminders.insert(entry);
    if (action.type === "spending_alert") await store.alerts.insert(entry);
    await record(ownerId, actionId, "CONFIRMED_AND_EXECUTED", confirmedAt);
    return updated;
  }

  return { propose, confirm, list: (ownerId) => store.actions.list(ownerId) };
}
