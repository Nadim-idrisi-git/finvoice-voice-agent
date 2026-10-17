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
const proposal = (type) => async (ctx, args) => ctx.actions.propose(ctx.user.id, { type, ...args });

const tools = [
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

/** OpenAI function tools (same shape for the Responses API and Realtime sessions). */
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
