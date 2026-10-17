// Deterministic findings over the parsed SMS profile. Every finding carries the sms_ids it is based on,
// so the agent can only state what the data backs up.

import { formatRupees as inr } from "../lib/format.js";

const DAY = 864e5;
/** "BAJAJ FINANCE L" → "Bajaj Finance", "Groww Invest Te" → "Groww Invest": drop SMS-truncated tails, fix case. */
export function cleanName(raw) {
  const words = String(raw).replace(/\s+(Priv\w*|Pvt|Ltd|Limited)\b.*$/i, "").trim().split(/\s+/);
  while (words.length > 1 && words.at(-1).length <= 2) words.pop();
  const name = words.join(" ");
  return name === name.toUpperCase() ? name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : name;
}
/** Readable biller names from bill-reminder SMS. */
function cleanBiller(raw) {
  if (/\(LIC\)|Life Insur/i.test(raw)) return "LIC premium";
  return cleanName(String(raw).replace(/\s+connection with.*$/i, " broadband").replace(/\.\.\./g, ""));
}
/** "2026-10-08" → "8 Oct" for spoken and displayed titles. */
const pretty = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const day = (at) => at.slice(0, 10);
const sum = (items) => items.reduce((s, f) => s + f.amountPaise, 0);
const evidence = (items) => items.map((f) => f.smsId);

/** Same bank charge (same account, amount, reason) debited more than once on the same day. */
export function duplicateCharges(facts) {
  const groups = new Map();
  for (const f of facts.filter((f) => f.type === "charge")) {
    const key = [f.counterparty, f.account, f.amountPaise, f.reason, day(f.at)].join("|");
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  return [...groups.values()]
    .filter((g) => g.length > 1)
    .map((g) => ({
      kind: "duplicate_charge",
      bank: g[0].counterparty,
      account: g[0].account,
      date: day(g[0].at),
      reason: g[0].reason,
      chargeAmountPaise: g[0].amountPaise,
      timesCharged: g.length,
      extraPaise: g[0].amountPaise * (g.length - 1),
      balanceTrailPaise: g.map((f) => f.balancePaise).filter(Boolean),
      evidence: evidence(g),
    }));
}

/** Autopays/NACH debits that bounced, plus the penalty charges they triggered. */
export function failedAutopays(facts) {
  const failed = facts.filter((f) => f.type === "failed" && /NACH|ACH|Auto ?Pay|mandate|shortfall/i.test(f.text));
  return failed.map((f) => {
    const penalties = facts.filter(
      (c) => c.type === "charge" && c.account === f.account && /NACH|return|bounce/i.test(c.reason + c.text) && Math.abs(new Date(c.at) - new Date(f.at)) < 3 * DAY,
    );
    return {
      kind: "failed_autopay",
      bank: f.counterparty,
      account: f.account,
      date: day(f.at),
      amountPaise: f.amountPaise,
      penaltyPaise: sum(penalties),
      evidence: evidence([f, ...penalties]),
    };
  });
}

/** Accounts that keep missing a minimum average balance, with the fees already paid for it. */
export function minimumBalanceTraps(facts) {
  const byAccount = new Map();
  for (const f of facts.filter((f) => f.type === "balance_warning" || (f.type === "charge" && /Minimum balance/i.test(f.reason)))) {
    const key = `${f.counterparty}|${f.account ?? "?"}`;
    byAccount.set(key, [...(byAccount.get(key) ?? []), f]);
  }
  return [...byAccount.values()]
    .map((items) => {
      const warnings = items.filter((f) => f.type === "balance_warning");
      const charges = items.filter((f) => f.type === "charge");
      return {
        kind: "minimum_balance_trap",
        bank: items[0].counterparty,
        account: items[0].account,
        requiredAveragePaise: Math.max(0, ...warnings.map((w) => w.amountPaise)),
        warnings: warnings.length,
        feesPaidPaise: sum(charges),
        evidence: evidence(items),
      };
    })
    .filter((t) => t.warnings > 0 || t.feesPaidPaise > 0)
    .sort((a, b) => b.feesPaidPaise - a.feesPaidPaise);
}

/** Mandates and UPI autopays grouped by merchant: how often and how much they pull. */
export function recurringMandates(facts) {
  const groups = new Map();
  for (const f of facts.filter((f) => f.type === "upcoming" || (f.type === "debit" && f.via === "mandate"))) {
    const name = cleanName(f.counterparty);
    groups.set(name, [...(groups.get(name) ?? []), f]);
  }
  return [...groups.entries()]
    .map(([merchant, items]) => {
      const debits = items.filter((f) => f.type === "debit");
      const scheduled = items.filter((f) => f.type === "upcoming");
      const dates = items.map((f) => f.dueOn ?? day(f.at)).sort();
      const spanDays = Math.max(1, (new Date(dates.at(-1)) - new Date(dates[0])) / DAY);
      const last30 = items.filter((f) => new Date(f.dueOn ?? day(f.at)) >= new Date(new Date(dates.at(-1)) - 30 * DAY));
      return {
        merchant,
        accounts: [...new Set(items.map((f) => f.account).filter(Boolean))],
        scheduledCount: scheduled.length,
        debitedCount: debits.length,
        perWeek: Math.round(((scheduled.length || debits.length) / spanDays) * 7 * 10) / 10,
        amountsPaise: [...new Set(items.map((f) => f.amountPaise))].sort((a, b) => a - b).slice(0, 8),
        last30DaysPaise: sum(last30.filter((f) => f.type === (scheduled.length ? "upcoming" : "debit"))),
        firstSeen: dates[0],
        lastSeen: dates.at(-1),
        evidence: evidence(items.slice(-5)),
      };
    })
    .filter((m) => m.scheduledCount + m.debitedCount >= 3)
    .sort((a, b) => b.last30DaysPaise - a.last30DaysPaise);
}

/** Latest known balance per account, from the most recent SMS that reported one. */
export function latestBalances(facts) {
  const latest = new Map();
  for (const f of facts) if (f.balancePaise != null && f.account) latest.set(`${f.sender}|${f.account}`, f);
  return [...latest.values()].map((f) => ({
    bank: bankFromSender(f.sender),
    account: f.account,
    balancePaise: f.balancePaise,
    asOf: day(f.at),
    asOfSpoken: pretty(day(f.at)),
    evidence: [f.smsId],
  }));
}

/** Latest reminder per biller (billers send several reminders for the same bill). */
export function billsDue(facts) {
  const latest = new Map();
  for (const f of facts.filter((f) => f.type === "bill_due")) latest.set(f.counterparty.slice(0, 20), f);
  return [...latest.values()]
    .map((f) => ({ biller: cleanBiller(f.counterparty), amountPaise: f.amountPaise, dueOn: f.dueOn, noticedOn: day(f.at), evidence: [f.smsId] }))
    .sort((a, b) => (b.dueOn ?? b.noticedOn).localeCompare(a.dueOn ?? a.noticedOn))
    .slice(0, 6);
}

/** The three things that matter most, ranked, for the opening of the money call. */
const briefingCache = new WeakMap();

/** Cached per profile object; the profile only changes when the dataset is re-ingested. */
export function briefing(profile) {
  if (!briefingCache.has(profile)) briefingCache.set(profile, computeBriefing(profile));
  return briefingCache.get(profile);
}

function computeBriefing(profile) {
  const { facts } = profile;
  const findings = [];
  for (const d of duplicateCharges(facts))
    findings.push({
      priority: 1,
      title: `${d.bank} charged the same ${inr(d.chargeAmountPaise)} fee ${d.timesCharged} times on ${pretty(d.date)}`,
      whyItMatters: `${d.timesCharged - 1} of those look like duplicates: ${inr(d.extraPaise)} worth asking the bank to reverse.`,
      suggestedAction: `Draft a reversal request to ${d.bank} for the duplicate charges.`,
      data: d,
    });
  const bounces = failedAutopays(facts).filter((f) => f.account);
  if (bounces.length) {
    const latest = bounces.at(-1);
    const sameAccount = bounces.filter((b) => b.account === latest.account);
    // Only frequent pullers are worth naming (once a month or more).
    const pullers = recurringMandates(facts).filter((m) => m.accounts.includes(latest.account) && m.perWeek >= 1);
    findings.push({
      priority: 2,
      title: `${sameAccount.length} autopays bounced on ${latest.bank} account ${latest.account} since ${pretty(sameAccount[0].date)}`,
      whyItMatters:
        `Penalty so far: ${inr(Math.max(...sameAccount.map((b) => b.penaltyPaise)))}.` +
        (pullers.length
          ? ` ${pullers.map((m) => `${m.merchant} debits this account about ${Math.round(m.perWeek)} times a week`).join("; ")}.`
          : ""),
      suggestedAction: "Set a reminder to top up this account before the next mandate, or move the mandate to a funded account.",
      data: {
        bounces: sameAccount.map(({ date, amountPaise, penaltyPaise }) => ({ date, amountPaise, penaltyPaise })),
        mandatesOnAccount: pullers.map(({ merchant, perWeek, last30DaysPaise }) => ({ merchant, perWeek, last30DaysPaise })),
        evidence: [...new Set(sameAccount.flatMap((b) => b.evidence))].slice(0, 6),
      },
    });
  }
  const cover = profile.insurance?.healthCovers?.[0];
  if (cover && cover.status !== "active")
    findings.push({
      priority: 1.5,
      title: `Your ${inr(cover.sumInsuredPaise)} ${cover.insurer} health cover has been off since ${pretty(String(cover.cancelledAt).slice(0, 10))}`,
      whyItMatters: `It was cancelled because the UPI AutoPay mandate was cancelled, so a hospital bill today would not be covered by it.${profile.insurance.eligibilityBlocks?.length ? " The records also show an eligibility block on new cover." : ""}`,
      suggestedAction: "Check claim eligibility for any admission, or ask the insurer about restoring cover.",
      data: { sumInsuredPaise: cover.sumInsuredPaise, insurer: cover.insurer, cancelledAt: cover.cancelledAt, reason: cover.cancellationReason, listedPremiumPaise: cover.listedPremiumPaise },
    });
  for (const t of minimumBalanceTraps(facts).slice(0, 1))
    findings.push({
      priority: 3,
      title: `${t.bank} account ${t.account ?? ""} keeps missing its ${inr(t.requiredAveragePaise)} minimum balance`,
      whyItMatters: `${t.warnings} warnings so far${t.feesPaidPaise ? ` and ${inr(t.feesPaidPaise)} already paid in fees` : ""}.`,
      suggestedAction: "Consider keeping the balance up, or moving to a zero-balance account.",
      data: t,
    });
  return {
    user: profile.user.name,
    asOf: profile.asOf,
    asOfSpoken: profile.asOf ? pretty(profile.asOf).replace(/^(\d+) (\w+)$/, "$1 $2") : null,
    topFindings: findings.sort((a, b) => a.priority - b.priority).slice(0, 3),
  };
}

const bankFromSender = (s) =>
  ({ HDFCBK: "HDFC Bank", HDFCBN: "HDFC Bank", PNBSMS: "Punjab National Bank", IDFCFB: "IDFC FIRST Bank" })[s] ?? s;
