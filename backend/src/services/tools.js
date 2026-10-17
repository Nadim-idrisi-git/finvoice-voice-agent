import { formatRupees } from "../lib/format.js";
import {
  categoryTotals,
  compareMonths,
  currentMonth,
  expenseTotal,
  incomeTotal,
  previousMonth,
  recurringSubscriptions,
  unusualSpending,
} from "../modules/analytics.js";
import { HttpError } from "../http.js";
import { loadFinance } from "../store/finance.js";
import {
  billsDue,
  briefing,
  duplicateCharges,
  failedAutopays,
  latestBalances,
  minimumBalanceTraps,
  recurringMandates,
} from "../modules/insights.js";

// Server-side registry of the tools the AI may call, shared by the text agent and live voice.
// Names, argument validation, and owner scoping live here; clients only forward calls.

const noParameters = { type: "object", properties: {}, required: [], additionalProperties: false };
const proposalParameters = {
  type: "object",
  properties: {
    title: { type: "string", description: "Short title, 3-100 characters." },
    details: { type: "string", description: "What the user asked for, 3-500 characters." },
  },
  required: ["title", "details"],
  additionalProperties: false,
};

function proposalArgs(args) {
  const title = typeof args?.title === "string" ? args.title.trim().slice(0, 100) : "";
  const details = typeof args?.details === "string" ? args.details.trim().slice(0, 500) : "";
  if (title.length < 3 || details.length < 3) return null;
  return { title, details };
}

const finance = (run) => async (ctx) => run(await loadFinance(ctx.store, ctx.user.id));
/** Tools over the parsed event dataset (SMS facts with sms_id evidence). */
const facts = (run) => async (ctx, args) => {
  if (!ctx.store.profile) throw new HttpError(503, "The event dataset is not loaded. Run npm run ingest.");
  return run(ctx.store.profile, args, ctx);
};
const AFFIRMATIVE = /\b(yes|yeah|yep|haan|han|ha|haa|ji|confirm|confirmed|ok|okay|sure|go ahead|do it|kar do|karo|kardo|theek|thik|bilkul|send it|please do)\b/i;
const textArg = (name, max) => (args) => {
  const value = typeof args?.[name] === "string" ? args[name].trim().slice(0, max) : "";
  return value.length >= 2 ? { [name]: value } : null;
};

function disputeLetter(user, d) {
  const rupees = (p) => `₹${(p / 100).toLocaleString("en-IN")}`;
  const trail = d.balanceTrailPaise.map(rupees).join(" → ");
  return [
    `Subject: Reversal of duplicate charges on account ending ${d.account}`,
    "",
    `Dear ${d.bank} team,`,
    "",
    `On ${d.date}, my account ending ${d.account} was debited ${rupees(d.chargeAmountPaise)} ${d.timesCharged} times for the same reason ("${d.reason}"). My balance moved ${trail}.`,
    `A single shortfall can attract only one charge. Please reverse the ${d.timesCharged - 1} duplicate debits totalling ${rupees(d.extraPaise)} and confirm by email.`,
    "",
    `Regards,`,
    user.name,
  ].join("\n");
}
const proposal = (type) => async (ctx, args) => ctx.actions.propose(ctx.user.id, { type, ...args });

const tools = [
  {
    name: "get_money_briefing",
    description:
      "Start here. The three most important findings in the user's money right now (duplicate charges, bouncing autopays, fee traps), each with sms_id evidence and a suggested action.",
    run: facts((profile) => briefing(profile)),
  },
  {
    name: "get_bank_charges",
    description: "All bank charges: duplicate charges, minimum-balance fees and warnings, and autopay bounce penalties.",
    run: facts(({ facts }) => ({
      duplicates: duplicateCharges(facts),
      minimumBalanceTraps: minimumBalanceTraps(facts),
      bouncedAutopays: failedAutopays(facts),
    })),
  },
  {
    name: "get_account_balances",
    description: "Latest known balance for each bank account, from the most recent bank SMS.",
    run: facts(({ facts }) => latestBalances(facts)),
  },
  {
    name: "get_recurring_payments",
    description: "Mandates and UPI autopays: who pulls money, how often per week, and how much in the last 30 days.",
    run: facts(({ facts }) => recurringMandates(facts).slice(0, 8)),
  },
  {
    name: "get_bills_due",
    description: "Bills the user has been reminded about (biller, amount, due date).",
    run: facts(({ facts }) => billsDue(facts)),
  },
  {
    name: "search_transactions",
    description: "Search the user's money SMS by merchant, bank, or keyword (e.g. 'Trusave', 'ATM', 'salary'). Returns up to 12 matches with dates and sms_id.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "Merchant, bank, or keyword." } },
      required: ["query"],
      additionalProperties: false,
    },
    parseArgs: textArg("query", 60),
    run: facts(({ facts }, { query }) => {
      const q = query.toLowerCase();
      const matches = facts.filter((f) => `${f.counterparty} ${f.text}`.toLowerCase().includes(q));
      return {
        query,
        matches: matches.length,
        totalPaise: matches.filter((f) => f.type === "debit" || f.type === "charge").reduce((s, f) => s + f.amountPaise, 0),
        recent: matches.slice(-12).map((f) => ({ date: f.at.slice(0, 10), type: f.type, counterparty: f.counterparty, amountPaise: f.amountPaise, account: f.account, smsId: f.smsId })),
      };
    }),
  },
  {
    name: "draft_charge_reversal_request",
    description:
      "Draft a reversal request to the bank for duplicate charges found in the data. Creates a proposal the user must confirm. Read the key details to the user, then ask for a clear yes.",
    proposesAction: true,
    run: facts(async (profile, _args, ctx) => {
      const [d] = duplicateCharges(profile.facts);
      if (!d) throw new HttpError(404, "No duplicate charges found in the data.");
      const pending = (await ctx.actions.list(ctx.user.id)).find(
        (a) => a.type === "dispute_draft" && a.status === "AWAITING_CONFIRMATION",
      );
      if (pending) return pending;
      return ctx.actions.propose(ctx.user.id, {
        type: "dispute_draft",
        title: `Reversal request to ${d.bank}: ₹${d.extraPaise / 100} duplicate charges`,
        details: disputeLetter(ctx.user, d),
      });
    }),
  },
  {
    name: "confirm_action",
    description:
      "Execute a proposed action AFTER the user has clearly said yes on this call. Never call this without an explicit yes in the user's last turn.",
    parameters: {
      type: "object",
      properties: { action_id: { type: "string", description: "The id returned when the action was proposed." } },
      required: ["action_id"],
      additionalProperties: false,
    },
    parseArgs: textArg("action_id", 80),
    proposesAction: true,
    run: async (ctx, { action_id }) => {
      // Text chat passes the user's message; refuse to execute without an explicit yes in it.
      if (ctx.userMessage !== undefined && !AFFIRMATIVE.test(ctx.userMessage)) {
        throw new HttpError(409, "The user has not said yes yet. Read back the draft and ask for a clear yes first.");
      }
      return ctx.actions.confirm(ctx.user.id, action_id);
    },
  },
  {
    name: "get_spending_summary",
    description: "Get the current month total expenses and income in INR.",
    run: finance(({ transactions }) => {
      const month = currentMonth();
      return { month, totalPaise: expenseTotal(transactions, month), incomePaise: incomeTotal(transactions, month) };
    }),
  },
  {
    name: "get_category_breakdown",
    description: "Get current month spending by category.",
    run: finance(({ transactions }) => categoryTotals(transactions, currentMonth())),
  },
  {
    name: "compare_monthly_spending",
    description: "Compare this month's spending with the previous month.",
    run: finance(({ transactions }) => compareMonths(transactions, currentMonth(), previousMonth(currentMonth()))),
  },
  {
    name: "find_recurring_subscriptions",
    description: "Find recurring subscription merchants and their average monthly cost.",
    run: finance(({ transactions }) => recurringSubscriptions(transactions)),
  },
  {
    name: "get_upcoming_bills",
    description: "List upcoming synthetic bills with due dates.",
    run: finance(({ bills }) => bills),
  },
  {
    name: "get_emi_schedule",
    description: "List upcoming synthetic EMI installments.",
    run: finance(({ emis }) => emis),
  },
  {
    name: "get_unusual_spending",
    description: "Get unusual spending candidates from synthetic history. These are review candidates, not fraud findings.",
    run: finance(({ transactions }) => unusualSpending(transactions)),
  },
  {
    name: "create_reminder",
    description: "Prepare an in-app reminder proposal. The user must still confirm it in the app.",
    parameters: proposalParameters,
    parseArgs: proposalArgs,
    proposesAction: true,
    run: proposal("reminder"),
  },
  {
    name: "configure_spending_alert",
    description: "Prepare a spending alert proposal. The user must still confirm it in the app.",
    parameters: proposalParameters,
    parseArgs: proposalArgs,
    proposesAction: true,
    run: proposal("spending_alert"),
  },
  {
    name: "prepare_subscription_action",
    description: "Prepare a simulated subscription workflow proposal. No cancellation is ever executed.",
    parameters: proposalParameters,
    parseArgs: proposalArgs,
    proposesAction: true,
    run: proposal("subscription_workflow"),
  },
];
const byName = new Map(tools.map((tool) => [tool.name, tool]));

/** OpenAI function tools for the Responses API (used by both text and voice turns). */
export const toolDefinitions = tools.map(({ name, description, parameters }) => ({
  type: "function",
  name,
  description,
  parameters: parameters ?? noParameters,
}));

/** Adds a spoken-ready `xRupees` string beside every numeric `xPaise` field. */
export function withRupees(value) {
  if (Array.isArray(value)) return value.map(withRupees);
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [key, v] of Object.entries(value)) {
    out[key] = withRupees(v);
    if (key.endsWith("Paise") && typeof v === "number") out[`${key.slice(0, -5)}Rupees`] = formatRupees(v);
  }
  return out;
}

/** Validates and runs one tool for the authenticated user in `ctx`. */
export async function executeTool(name, rawArgs, ctx) {
  const tool = byName.get(name);
  if (!tool) throw new HttpError(404, `Unknown tool: ${name}`);
  const args = tool.parseArgs ? tool.parseArgs(rawArgs ?? {}) : {};
  if (!args) throw new HttpError(400, `Invalid arguments for ${name}.`);
  return { result: withRupees(await tool.run(ctx, args)), proposesAction: Boolean(tool.proposesAction) };
}
