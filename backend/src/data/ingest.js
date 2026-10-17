// Turns one user's raw event SMS into structured, evidence-backed money facts.
// Usage: DATASET_DIR=~/Downloads/buildathon DEMO_USER_ID=1748108541385190 npm run ingest
// Output: backend/data/profile.json (every fact keeps the sms_id it came from).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LOCAL_DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data/raw");
const DATASET_DIR = (process.env.DATASET_DIR ?? (fs.existsSync(LOCAL_DATA) ? LOCAL_DATA : path.join(os.homedir(), "Downloads/buildathon"))).replace(/^~/, os.homedir());
const USER_ID = process.env.DEMO_USER_ID ?? "1748108541385190";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../data/profile.json");

/** Streams a CSV file (quoted fields may contain newlines) and calls onRow(object) per record. */
async function readCsv(file, onRow) {
  let header = null;
  let field = "";
  let row = [];
  let quoted = false;
  let pendingQuote = false;
  const emit = () => {
    row.push(field);
    field = "";
    if (!header) header = row;
    else if (row.length > 1) onRow(Object.fromEntries(header.map((h, i) => [h, row[i] ?? ""])));
    row = [];
  };
  for await (const chunk of fs.createReadStream(file, { encoding: "utf8" })) {
    for (const ch of chunk.replace(/\0/g, "")) {
      if (pendingQuote) {
        pendingQuote = false;
        if (ch === '"') {
          field += '"';
          continue;
        }
        quoted = false;
      }
      if (quoted) {
        if (ch === '"') pendingQuote = true;
        else field += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n") emit();
      else if (ch !== "\r") field += ch;
    }
  }
  if (field || row.length) emit();
}

const BANK_SENDER = /HDFCB|PNBSMS|IDFCFB|SBI|ICICI|AXISB|KOTAK|BOBTXN|CANBNK|UNIONB|YESB|INDUSB|IOBCHN|PAYTMB|AIRBNK|AUBANK/i;
const AMOUNT = String.raw`(?:Rs\.?|INR|₹)\s?([\d,]+(?:\.\d+)?)`;
const num = (s) => Math.round(Number(String(s).replace(/,/g, "")) * 100); // → paise
const clean = (s) => s.replace(/\s+/g, " ").replace(/[.,]+$/, "").trim();

/** Normalises dd/mm/yy, dd-mm-yy, dd-mm-yyyy, or dd-MON-yy to YYYY-MM-DD. */
function parseDate(text) {
  const months = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
  let m = text.match(/(\d{1,2})[/-]([A-Za-z]{3})[/-](\d{2,4})/);
  if (m) return iso(m[3], months[m[2].toUpperCase()], m[1]);
  m = text.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) return iso(m[3], m[2], m[1]);
  return null;
}
const iso = (y, mo, d) => `${String(y).length === 2 ? `20${y}` : y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function account(text) {
  const m = text.match(/(?:A\/?c(?:count)?|Ac|a\/c no|Card)\s*(?:No\.?\s*|ending\s*)?[xX*]*\s?[xX*]*(\d{3,})/i);
  return m ? m[1].slice(-4) : null;
}
function balance(text) {
  const m = text.match(new RegExp(String.raw`(?:Avl\.? ?bal|Aval Bal|Bal(?:ance)?|New Bal(?:ance)?(?: is)?)\s*:?\s*(?:Rs\.?|INR)?\s?([\d,]+(?:\.\d+)?)`, "i"));
  return m ? num(m[1]) : null;
}

/** Classifies one transactional SMS into a fact, or null if it carries no money event. */
function parse(sms) {
  const t = sms.body_text.replace(/\s+/g, " ");
  const bank = sms.sender.split("-")[1] ?? sms.sender;
  const base = { smsId: sms.sms_id, at: sms.received_at_ist.slice(0, 19), sender: bank, text: t.slice(0, 240) };
  let m;

  // Upcoming mandate / autopay debits
  if ((m = t.match(new RegExp(String.raw`E-Mandate! ${AMOUNT} will be deducted on (\S+).*?For (.+?) mandate`, "i"))))
    return { ...base, type: "upcoming", amountPaise: num(m[1]), dueOn: parseDate(m[2]), counterparty: clean(m[3]), via: "mandate", account: account(t) };
  if ((m = t.match(new RegExp(String.raw`will be debited for ${AMOUNT} on (\S+) for UPI Autopay on (.+?),`, "i"))))
    return { ...base, type: "upcoming", amountPaise: num(m[1]), dueOn: parseDate(m[2]), counterparty: clean(m[3]), via: "upi_autopay", account: account(t) };

  // Bills due
  if ((m = t.match(new RegExp(String.raw`^(.+?) \(\S+\) bill of ${AMOUNT} is due (\w+)`, "i"))))
    return { ...base, type: "bill_due", amountPaise: num(m[2]), counterparty: clean(m[1]), dueOn: m[3] === "tomorrow" ? nextDay(base.at) : null };
  if ((m = t.match(new RegExp(String.raw`bill dated .*? for (.+?) is due for payment on (\S+)\. Total amount payable : ${AMOUNT}`, "i"))))
    return { ...base, type: "bill_due", amountPaise: num(m[3]), counterparty: clean(m[1]).slice(0, 40), dueOn: parseDate(m[2]) };

  if (!BANK_SENDER.test(sms.sender)) {
    // Investment confirmations from fund houses
    if ((m = t.match(new RegExp(String.raw`(SIP )?Purchase (?:of ${AMOUNT} in .*?in (.+?) for|in Folio \S+ (?:under|in) (.+?) for ${AMOUNT})`, "i")))) {
      const amount = m[2] ?? m[5];
      const fund = clean(m[3] ?? m[4] ?? "Mutual fund");
      if (amount) return { ...base, type: "investment", amountPaise: num(amount), counterparty: fund.slice(0, 60), via: m[1] ? "sip" : "purchase" };
    }
    return null;
  }

  // Minimum-balance warnings (no money moved yet)
  if (/(?:AMB|Avg\.? bal).*(?:not maintained|doesn't have|Avoid non-maintenance)/i.test(t) && !/debited/i.test(t)) {
    const required = t.match(/(?:required AMB of|AMB of|Avg\. bal\. of)\s*Rs\.?\s?([\d,]+)/i);
    return { ...base, type: "balance_warning", amountPaise: required ? num(required[1]) : 0, counterparty: bankName(bank), account: account(t) };
  }

  // Bank charges actually debited
  if (/Average Monthly Balance|non[- ]maintenance|Returning charges|penalty|charges/i.test(t)) {
    const charged = t.match(new RegExp(String.raw`(?:debited (?:with|by)|charges of)\s*${AMOUNT}`, "i"));
    if (charged)
      return {
        ...base,
        type: "charge",
        amountPaise: num(charged[1]),
        counterparty: bankName(bank),
        reason: /Average Monthly Balance|MAB|non[- ]maintenance/i.test(t) ? "Minimum balance not maintained" : /NACH|Returning/i.test(t) ? "Autopay bounce (NACH return) charge" : "Bank charge",
        account: account(t),
        balancePaise: balance(t),
      };
  }

  // Failed payments
  if (/unsuccessful|failed|bounced|insufficient|declined|returned/i.test(t) && (m = t.match(new RegExp(AMOUNT, "i"))))
    return { ...base, type: "failed", amountPaise: num(m[1]), counterparty: bankName(bank), account: account(t) };

  // Debits
  const debit =
    t.match(new RegExp(String.raw`UPI Mandate: Sent ${AMOUNT} from .*? To (.+?) \d{2}/\d{2}/\d{2}`, "i")) ??
    t.match(new RegExp(String.raw`Sent ${AMOUNT} From .*? To (.+?) On`, "i")) ??
    t.match(new RegExp(String.raw`${AMOUNT} deducted from .*? towards (.+?) UMRN`, "i")) ??
    t.match(new RegExp(String.raw`debited (?:INR|Rs\.?)\s?([\d,]+(?:\.\d+)?) Dt .*? to (.+?) thru`, "i")) ??
    t.match(new RegExp(String.raw`Withdrawn ${AMOUNT} From .*? At (.+?) On`, "i")) ??
    t.match(new RegExp(String.raw`debited (?:with|by|for)? ?${AMOUNT}.*?(through ATM|for bill payment|towards [^.]+)?`, "i"));
  if (debit) {
    const cash = /Withdrawn|through ATM/i.test(t);
    const via = /mandate|UMRN|Autopay/i.test(t) ? "mandate" : cash ? "cash" : /UPI/i.test(t) ? "upi" : "bank";
    const counterparty = cash ? "Cash withdrawal" : clean(debit[2] ?? "Unknown").replace(/^towards /i, "").slice(0, 50);
    return { ...base, type: "debit", amountPaise: num(debit[1]), counterparty, via, account: account(t), balancePaise: balance(t) };
  }

  // Credits
  const credit =
    t.match(new RegExp(String.raw`Credit Alert! ${AMOUNT} credited .*? from (?:VPA )?(\S+)`, "i")) ??
    t.match(new RegExp(String.raw`Received! ${AMOUNT} in .*? For (?:IMPS|NEFT|UPI) -?(.+?)-`, "i")) ??
    t.match(new RegExp(String.raw`${AMOUNT} deposited in .*? for (?:NEFT Cr-\S+-|FT- )?(.+?)[.-]`, "i")) ??
    t.match(new RegExp(String.raw`[Cc]redited (?:with|by|for) ${AMOUNT}.*?(?:from|by|thru) (.+?)[.(]`, "i")) ??
    t.match(new RegExp(String.raw`[Cc]redited with ${AMOUNT}()`, "i"));
  if (credit)
    return { ...base, type: "credit", amountPaise: num(credit[1]), counterparty: clean(credit[2] ?? "Unknown").slice(0, 50), account: account(t), balancePaise: balance(t) };

  return null;
}

/** Rejects facts that would be unsafe to state: bad amounts, dates, or missing evidence. */
function validateFact(f) {
  if (!f.smsId) return "missing sms_id";
  if (!Number.isInteger(f.amountPaise) || f.amountPaise <= 0) return "invalid amount";
  if (f.amountPaise > 10_000_000_00) return "amount out of range";
  if (Number.isNaN(Date.parse(f.at))) return "invalid timestamp";
  if (f.dueOn && !/^\d{4}-\d{2}-\d{2}$/.test(f.dueOn)) return "invalid due date";
  return null;
}

const nextDay = (at) => new Date(new Date(`${at.slice(0, 10)}T00:00:00Z`).getTime() + 864e5).toISOString().slice(0, 10);
const bankName = (code) =>
  ({ HDFCBK: "HDFC Bank", HDFCBN: "HDFC Bank", PNBSMS: "Punjab National Bank", IDFCFB: "IDFC FIRST Bank" })[code] ?? code;

const rupeesToPaise = (v) => (v === "" || v == null ? null : Math.round(Number(v) * 100));
const userRows = async (file) => {
  const rows = [];
  await readCsv(path.join(DATASET_DIR, file), (r) => r.user_id === USER_ID && rows.push(r));
  return rows;
};

/** Structured records for the user: insurance, investments, loans, and a searchable email index. */
async function readRecords() {
  const fundNames = {};
  await readCsv(path.join(DATASET_DIR, "investment/funds.csv"), (r) => (fundNames[r.fund_id] = r.fund_name ?? r.name ?? r.scheme_name ?? r.fund_id));
  const [policies, premiumTx, holdings, sips, orders, loans] = await Promise.all([
    userRows("insurance/policies.csv"),
    userRows("insurance/transactions.csv"),
    userRows("investment/holdings.csv"),
    userRows("investment/sip_plans.csv"),
    userRows("investment/orders.csv"),
    userRows("loan/loan_applications.csv"),
  ]);
  const successfulOrders = orders.filter((o) => o.status === "SUCCESS");

  const emails = [];
  const seen = new Set();
  await readCsv(path.join(DATASET_DIR, "emails/emails.csv"), (r) => {
    if (r.user_id !== USER_ID) return;
    const subject = r.subject.replace(/^(re|fwd?):\s*/i, "").trim();
    const date = r.received_at.slice(0, 10);
    const key = `${date}|${subject}`;
    if (seen.has(key) || /^Delivery Status Notification/i.test(subject)) return; // forwarded copies and bounces
    seen.add(key);
    const snippet = r.body.replace(/https?:\S+/g, "").replace(/\s+/g, " ").trim().slice(0, 300);
    emails.push({ emailId: `email-${emails.length + 1}`, date, subject: subject.slice(0, 140), snippet });
  });

  return {
    insurance: {
      policies: policies.map((p) => ({
        policyId: p.policy_id,
        status: p.status,
        premiumPaise: rupeesToPaise(p.cycle_premium),
        cycleStart: p.current_cycle_start,
        cycleEnd: p.current_cycle_end,
        createdAt: p.created_at,
        cancelledAt: p.cancelled_at || null,
        cancellationReason: p.cancellation_reason || null,
        source: "insurance/policies.csv",
      })),
      payments: premiumTx.map((t) => ({
        transactionId: t.transaction_id,
        purpose: t.purpose,
        amountPaise: rupeesToPaise(t.amount_requested),
        status: t.status,
        at: t.resolved_at || t.created_at,
        source: "insurance/transactions.csv",
      })),
    },
    investments: {
      holdings: holdings.map((h) => ({
        product: h.product,
        fund: fundNames[h.fund_id] ?? h.fund_id,
        folio: h.folio_number,
        units: Number(h.units),
        investedPaise: rupeesToPaise(h.invested_amount_inr),
        currentValuePaise: rupeesToPaise(h.current_value_inr),
        gainPaise: rupeesToPaise(h.current_value_inr) - rupeesToPaise(h.invested_amount_inr),
        navPaise: rupeesToPaise(h.latest_nav_inr),
        navDate: h.nav_date,
        source: "investment/holdings.csv",
      })),
      sips: sips.map((s) => ({
        product: s.product,
        fund: fundNames[s.fund_id] ?? s.fund_id,
        frequency: s.frequency,
        amountPaise: rupeesToPaise(s.amount_inr),
        status: s.status,
        startedOn: (s.first_debit_date || s.activated_at || s.created_at || "").slice(0, 10),
        cancelledOn: (s.cancelled_at || "").slice(0, 10) || null,
        source: "investment/sip_plans.csv",
      })),
      orderCount: orders.length,
      successfulOrders: successfulOrders.length,
      successfulOrderTotalPaise: successfulOrders.reduce((sum, o) => sum + rupeesToPaise(o.amount_inr), 0),
      lastOrderOn: successfulOrders.map((o) => o.traded_on || o.created_at.slice(0, 10)).sort().at(-1) ?? null,
    },
    loans: loans.map((l) => ({
      applicationId: l.application_id,
      lender: l.lender,
      status: l.loan_status,
      reason: l.end_reason || null,
      appliedOn: (l.applied_at || "").slice(0, 10),
      endedOn: (l.ended_at || "").slice(0, 10) || null,
      requestedPaise: rupeesToPaise(l.requested_amount),
      interestRatePct: l.interest_rate_yearly_pct ? Number(l.interest_rate_yearly_pct) : null,
      source: "loan/loan_applications.csv",
    })),
    emails,
  };
}

async function main() {
  const user = {};
  await readCsv(path.join(DATASET_DIR, "emails/users_data.csv"), (r) => {
    if (r.user_id === USER_ID) Object.assign(user, { id: r.user_id, name: `${r.first_name} ${r.last_name}`.trim() });
  });
  const facts = [];
  const seenSms = new Set();
  const quality = { duplicateSmsIds: 0, transactional: 0, unparsedMoneySms: 0, unparsedSamples: [], rejected: [] };
  let scanned = 0;
  await readCsv(path.join(DATASET_DIR, "sms/sms.csv"), (r) => {
    if (r.user_id !== USER_ID) return;
    scanned++;
    if (seenSms.has(r.sms_id)) return void quality.duplicateSmsIds++;
    seenSms.add(r.sms_id);
    if (!/-(S|T)$/.test(r.sender) || /otp|one time password|verification code/i.test(r.body_text)) return;
    quality.transactional++;
    const fact = parse(r);
    const problem = fact && validateFact(fact);
    if (problem) quality.rejected.push({ smsId: r.sms_id, problem });
    else if (fact) facts.push(fact);
    else if (BANK_SENDER.test(r.sender) && /(?:Rs\.?|INR|₹)\s?\d/i.test(r.body_text) && /debit|credit|deduct|sent|withdrawn|received|deposited/i.test(r.body_text)) {
      quality.unparsedMoneySms++;
      if (quality.unparsedSamples.length < 15) quality.unparsedSamples.push({ smsId: r.sms_id, text: r.body_text.slice(0, 140) });
    }
  });
  facts.sort((a, b) => a.at.localeCompare(b.at));
  const records = await readRecords();
  const profile = {
    source: "Voice AI Buildathon mock dataset (synthetic). Facts parsed from transactional SMS; each keeps its sms_id.",
    generatedAt: new Date().toISOString(),
    user: { id: USER_ID, name: user.name ?? "Demo user" },
    asOf: facts.at(-1)?.at.slice(0, 10) ?? null,
    smsScanned: scanned,
    quality: { ...quality, rejected: quality.rejected.slice(0, 20), rejectedCount: quality.rejected.length },
    ...records,
    facts,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(profile, null, 1));
  const byType = facts.reduce((acc, f) => ({ ...acc, [f.type]: (acc[f.type] ?? 0) + 1 }), {});
  console.log(`${profile.user.name}: scanned ${scanned} SMS → ${facts.length} facts`, byType, `→ ${OUT}`);
  console.log("Records:", { insurancePolicies: records.insurance.policies.length, premiumPayments: records.insurance.payments.length, holdings: records.investments.holdings.length, sips: records.investments.sips.length, orders: records.investments.orderCount, loanApplications: records.loans.length, emails: records.emails.length });
  console.log("Data quality:", { duplicateSmsIds: quality.duplicateSmsIds, transactional: quality.transactional, rejected: quality.rejected.length, unparsedBankMoneySms: quality.unparsedMoneySms });
  for (const s of quality.unparsedSamples.slice(0, 8)) console.log("  unparsed:", s.smsId, s.text);
}

await main();
