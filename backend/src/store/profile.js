import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { billsDue, recurringMandates } from "../modules/insights.js";

// Store backed by the parsed event dataset (backend/data/profile.json, produced by `npm run ingest`).
// Same async, owner-scoped interface as the in-memory store, so routes and tools do not change.

export const PROFILE_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data/profile.json");

export function loadProfile(file = PROFILE_PATH) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
}

const titleCase = (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

function category(f) {
  if (f.type === "charge") return "Bank charges";
  if (f.via === "cash") return "Cash withdrawals";
  if (/bachatt|groww|mutual|fund|clearing|nse|bse|zerodha|invest/i.test(f.counterparty)) return "Savings & investments";
  if (/trusave|kreditbee|krazybee|bajaj fin|loan|fintech|credit/i.test(f.counterparty)) return "Loans & fintech autopay";
  if (f.via === "mandate") return "Autopay";
  if (/^(mr\.? |smt |shri )?[A-Z][A-Z .]+$/.test(f.counterparty) || /S\/?O /i.test(f.counterparty)) return "Transfers to people";
  return "Payments";
}

export function createProfileStore(profile) {
  const user = { id: profile.user.id, name: titleCase(profile.user.name), currency: "INR" };
  const ownerId = user.id;
  const transactions = profile.facts
    .filter((f) => ["debit", "credit", "charge"].includes(f.type))
    .map((f) => ({
      id: `sms-${f.smsId}`,
      smsId: f.smsId,
      ownerId,
      occurredAt: f.at,
      merchant: f.counterparty,
      category: f.type === "credit" ? "Income & refunds" : category(f),
      amountPaise: f.amountPaise,
      currency: "INR",
      kind: f.type === "credit" ? "income" : "expense",
    }));
  const bills = billsDue(profile.facts).map((b, i) => ({
    id: `bill-${b.evidence[0]}-${i}`,
    ownerId,
    name: b.biller,
    amountPaise: b.amountPaise,
    dueAt: `${b.dueOn ?? b.noticedOn}T00:00:00Z`,
    status: "upcoming",
    evidence: b.evidence,
  }));
  const emis = recurringMandates(profile.facts)
    .filter((m) => /trusave|kreditbee|bajaj|loan|fintech/i.test(m.merchant))
    .map((m) => ({
      id: `mandate-${m.merchant}`,
      ownerId,
      name: `${m.merchant} autopay`,
      installmentPaise: m.amountsPaise.at(-1),
      nextDueAt: `${m.lastSeen}T00:00:00Z`,
      remainingInstallments: `${m.perWeek}/week ·`,
      evidence: m.evidence,
    }));

  const owned = (rows) => async (id) => (id === ownerId ? rows : []);
  const collection = () => {
    const items = [];
    const find = (o, id) => items.find((x) => x.ownerId === o && x.id === id);
    return {
      list: async (o) => items.filter((x) => x.ownerId === o).map((x) => ({ ...x })),
      get: async (o, id) => (find(o, id) ? { ...find(o, id) } : null),
      insert: async (doc) => (items.unshift({ ...doc }), { ...doc }),
      update: async (o, id, patch) => (find(o, id) ? (Object.assign(find(o, id), patch), { ...find(o, id) }) : null),
    };
  };
  return {
    kind: "event-dataset",
    user,
    profile,
    transactions: owned(transactions),
    bills: owned(bills),
    emis: owned(emis),
    actions: collection(),
    reminders: collection(),
    alerts: collection(),
    audit: collection(),
  };
}
