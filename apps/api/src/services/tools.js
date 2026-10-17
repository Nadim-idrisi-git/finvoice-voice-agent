import { z } from "zod";
import { formatRupees } from "@finance-agent/shared/format";
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

// Server-side registry of the tools the voice model may call. The client only
// forwards calls here; names, argument validation and owner scoping live on the server.

const noArgs = z.object({}).passthrough();
const proposalArgs = z.object({
  title: z
    .string()
    .trim()
    .min(3)
    .transform((s) => s.slice(0, 100)),
  details: z
    .string()
    .trim()
    .min(3)
    .transform((s) => s.slice(0, 500)),
});
const proposalParameters = {
  type: "OBJECT",
  properties: { title: { type: "STRING" }, details: { type: "STRING" } },
  required: ["title", "details"],
};
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
    description: "Compare this month with the previous month.",
    run: finance(({ transactions }) => compareMonths(transactions, currentMonth(), previousMonth(currentMonth()))),
  },
  {
    name: "find_recurring_subscriptions",
    description: "Find recurring subscription merchants and average cost.",
    run: finance(({ transactions }) => recurringSubscriptions(transactions)),
  },
  {
    name: "get_upcoming_bills",
    description: "List upcoming synthetic bills.",
    run: finance(({ bills }) => bills),
  },
  {
    name: "get_emi_schedule",
    description: "List upcoming synthetic EMI installments.",
    run: finance(({ emis }) => emis),
  },
  {
    name: "get_unusual_spending",
    description: "Get deterministic unusual spending candidates from synthetic history; these are not fraud findings.",
    run: finance(({ transactions }) => unusualSpending(transactions)),
  },
  {
    name: "create_reminder",
    description: "Prepare an in-app reminder proposal. User confirmation is still required.",
    parameters: proposalParameters,
    args: proposalArgs,
    proposesAction: true,
    run: proposal("reminder"),
  },
  {
    name: "configure_spending_alert",
    description: "Prepare a spending alert proposal. User confirmation is still required.",
    parameters: proposalParameters,
    args: proposalArgs,
    proposesAction: true,
    run: proposal("spending_alert"),
  },
  {
    name: "prepare_subscription_action",
    description: "Prepare a simulated subscription workflow; no cancellation is executed.",
    parameters: proposalParameters,
    args: proposalArgs,
    proposesAction: true,
    run: proposal("subscription_workflow"),
  },
];
const byName = new Map(tools.map((tool) => [tool.name, tool]));

/** Gemini function declarations for the registry. */
export const toolDeclarations = tools.map(({ name, description, parameters }) => ({
  name,
  description,
  parameters: parameters ?? { type: "OBJECT", properties: {} },
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
  const parsed = (tool.args ?? noArgs).safeParse(rawArgs ?? {});
  if (!parsed.success) throw new HttpError(400, `Invalid arguments for ${name}.`);
  return { result: withRupees(await tool.run(ctx, parsed.data)), proposesAction: Boolean(tool.proposesAction) };
}
