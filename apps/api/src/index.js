import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pino from "pino";
import { pinoHttp } from "pino-http";
import mongoose from "mongoose";
import { actionSchema, confirmationSchema, messageSchema } from "@finance-agent/shared";
import { z } from "zod";
import { DEMO_USER, createTransactions, syntheticBills, syntheticEmis } from "./data/seed.js";
import { categoryTotals, compareMonths, currentMonth, expenseTotal, incomeTotal, merchantTotals, previousMonth, recurringSubscriptions, rupees, unusualSpending } from "./modules/analytics.js";
import { answerFinancialQuestion } from "./modules/agent.js";
const environmentSchema = z.object({ NODE_ENV: z.enum(["development", "test", "production"]).default("development"), PORT: z.coerce.number().int().positive().max(65535).default(4100), WEB_ORIGIN: z.string().url().default("http://localhost:5173"), MONGODB_URI: z.string().optional(), GEMINI_API_KEY: z.string().optional(), GEMINI_LIVE_MODEL: z.string().min(1).default("gemini-3.8-live"), GEMINI_VOICE: z.string().min(1).max(60).default("Kore") });
const env = environmentSchema.parse(process.env);
const log = pino({ level: env.NODE_ENV === "test" ? "silent" : "info", redact: ["req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie"] });
const app = express();
const port = env.PORT;
const webOrigin = env.WEB_ORIGIN;
const rows = createTransactions();
const actions = [];
const reminders = [];
const alerts = [];
const audit = [];
let databaseStatus = "synthetic-fixture";
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: webOrigin, credentials: true, methods: ["GET", "POST"] }));
app.use(express.json({ limit: "24kb" }));
app.use(pinoHttp({ logger: log, genReqId: (req) => req.headers["x-request-id"]?.toString() ?? crypto.randomUUID(), serializers: { req: (req) => ({ id: req.id, method: req.method, url: req.url }) } }));
app.use(rateLimit({ windowMs: 6e4, limit: 60, standardHeaders: "draft-7", legacyHeaders: false }));
app.get("/health", (_req, res) => res.json({ status: "ok", database: databaseStatus, voiceConfigured: Boolean(process.env.GEMINI_API_KEY) }));
app.use("/api/v1", (_req, res, next) => {
  if (process["env"]["NODE_ENV"] === "production") return res.status(503).json({ error: "Production authentication is not implemented. This synthetic demo API is unavailable in production." });
  res.locals.user = DEMO_USER;
  next();
});
app.use("/api/v1/voice/session", rateLimit({ windowMs: 6e4, limit: 3, standardHeaders: "draft-7", legacyHeaders: false }));
const owned = (items) => items.filter((i) => i.ownerId === DEMO_USER.id);
const withRupees = (value) => {
  if (Array.isArray(value)) return value.map(withRupees);
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [key, v] of Object.entries(value)) {
    out[key] = withRupees(v);
    if (key.endsWith("Paise") && typeof v === "number") out[`${key.slice(0, -5)}Rupees`] = rupees(v);
  }
  return out;
};
app.get("/api/v1/session", (_req, res) => res.json({ user: DEMO_USER, mode: "synthetic-demo" }));
app.get("/api/v1/dashboard", (_req, res) => {
  const month = currentMonth();
  const total = expenseTotal(rows, month);
  const compare = compareMonths(rows, month, previousMonth(month));
  const dayTotals = /* @__PURE__ */ new Map();
  for (const tx of rows) if (tx.occurredAt.slice(0, 7) === month && tx.kind === "expense") {
    const day = Number(tx.occurredAt.slice(8, 10));
    dayTotals.set(day, (dayTotals.get(day) ?? 0) + tx.amountPaise);
  }
  res.json({ user: DEMO_USER, month, totalPaise: total, previousTotalPaise: compare.previousPaise, changePercent: compare.changePercent, categories: categoryTotals(rows, month), transactions: rows.filter((t) => t.occurredAt.slice(0, 7) === month).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 8), dailySpending: [...dayTotals].sort((a, b) => a[0] - b[0]).map(([day, amountPaise]) => ({ day, amountPaise })), unusual: unusualSpending(rows), subscriptions: recurringSubscriptions(rows), bills: owned(syntheticBills), emis: owned(syntheticEmis), synthetic: true });
});
app.get("/api/v1/analytics/summary", (_req, res) => res.json(withRupees({ month: currentMonth(), totalPaise: expenseTotal(rows, currentMonth()), incomePaise: incomeTotal(rows, currentMonth()) })));
app.get("/api/v1/analytics/categories", (_req, res) => res.json(withRupees(categoryTotals(rows, currentMonth()))));
app.get("/api/v1/analytics/month", (req, res) => {
  const month = typeof req.query.month === "string" ? req.query.month : "";
  if (!/^\d{4}-\d{2}$/.test(month) || Number(month.slice(5)) < 1 || Number(month.slice(5)) > 12) return res.status(400).json({ error: "A valid YYYY-MM month is required." });
  res.json({ month, totalPaise: expenseTotal(rows, month), categories: categoryTotals(rows, month) });
});
app.get("/api/v1/analytics/compare", (_req, res) => res.json(withRupees(compareMonths(rows, currentMonth(), previousMonth(currentMonth())))));
app.get("/api/v1/analytics/merchants", (_req, res) => res.json(withRupees(merchantTotals(rows, currentMonth()))));
app.get("/api/v1/analytics/unusual", (_req, res) => res.json(withRupees(unusualSpending(rows))));
app.get("/api/v1/subscriptions", (_req, res) => res.json(withRupees(recurringSubscriptions(rows))));
app.get("/api/v1/bills", (_req, res) => res.json(withRupees(owned(syntheticBills))));
app.get("/api/v1/emis", (_req, res) => res.json(withRupees(owned(syntheticEmis))));
app.get("/api/v1/actions", (_req, res) => res.json(owned(actions)));
app.get("/api/v1/audit", (_req, res) => res.json(owned(audit)));
app.get("/api/v1/reminders", (_req, res) => res.json(owned(reminders)));
app.get("/api/v1/alerts", (_req, res) => res.json(owned(alerts)));
app.post("/api/v1/assistant/message", (req, res) => {
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Message must contain 1 to 1200 characters." });
  const result = answerFinancialQuestion(parsed.data.message, rows);
  if (/remind|reminder|yaad dila|याद दिला|spending alert|configure an alert/i.test(parsed.data.message)) {
    const action = { id: crypto.randomUUID(), ownerId: DEMO_USER.id, type: /alert/i.test(parsed.data.message) ? "spending_alert" : "reminder", title: /alert/i.test(parsed.data.message) ? "Spending alert proposal" : "Reminder proposal", details: parsed.data.message.slice(0, 500), status: "AWAITING_CONFIRMATION", createdAt: (/* @__PURE__ */ new Date()).toISOString() };
    actions.unshift(action);
    audit.unshift({ id: crypto.randomUUID(), ownerId: DEMO_USER.id, actionId: action.id, event: "PROPOSED", at: action.createdAt });
    return res.json({ ...result, answer: "I drafted that as a proposal. Please review the exact details under Actions and confirm it there.", actionProposal: action, synthetic: true, requestId: req.id });
  }
  res.json({ ...result, synthetic: true, requestId: req.id });
});
app.post("/api/v1/actions", (req, res) => {
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid action." });
  const action = { id: crypto.randomUUID(), ownerId: DEMO_USER.id, ...parsed.data, status: "AWAITING_CONFIRMATION", createdAt: (/* @__PURE__ */ new Date()).toISOString() };
  actions.unshift(action);
  audit.unshift({ id: crypto.randomUUID(), ownerId: DEMO_USER.id, actionId: action.id, event: "PROPOSED", at: action.createdAt });
  res.status(201).json(action);
});
app.post("/api/v1/actions/:id/confirm", (req, res) => {
  if (!confirmationSchema.safeParse(req.body).success) return res.status(400).json({ error: "Explicit confirmation is required." });
  const action = actions.find((a) => a.id === req.params.id && a.ownerId === DEMO_USER.id);
  if (!action) return res.status(404).json({ error: "Action not found." });
  if (action.status === "SUCCEEDED") return res.json(action);
  if (action.status !== "AWAITING_CONFIRMATION") return res.status(409).json({ error: `Action is ${action.status}.` });
  action.status = "SUCCEEDED";
  action.confirmedAt = (/* @__PURE__ */ new Date()).toISOString();
  if (action.type === "reminder") reminders.unshift({ id: crypto.randomUUID(), ownerId: action.ownerId, title: action.title, details: action.details, createdAt: action.confirmedAt });
  if (action.type === "spending_alert") alerts.unshift({ id: crypto.randomUUID(), ownerId: action.ownerId, title: action.title, details: action.details, createdAt: action.confirmedAt });
  if (action.type === "subscription_workflow") action.status = "SUCCEEDED";
  audit.unshift({ id: crypto.randomUUID(), ownerId: action.ownerId, actionId: action.id, event: "CONFIRMED_AND_EXECUTED", at: action.confirmedAt });
  res.json(action);
});
const financialTools = [
  { name: "get_spending_summary", description: "Get the current month total expenses in INR.", parameters: { type: "OBJECT", properties: {} } },
  { name: "get_category_breakdown", description: "Get current month category spending.", parameters: { type: "OBJECT", properties: {} } },
  { name: "compare_monthly_spending", description: "Compare this month with the previous month.", parameters: { type: "OBJECT", properties: {} } },
  { name: "find_recurring_subscriptions", description: "Find recurring subscription merchants and average cost.", parameters: { type: "OBJECT", properties: {} } },
  { name: "get_upcoming_bills", description: "List upcoming synthetic bills.", parameters: { type: "OBJECT", properties: {} } },
  { name: "get_emi_schedule", description: "List upcoming synthetic EMI installments.", parameters: { type: "OBJECT", properties: {} } },
  { name: "get_unusual_spending", description: "Get deterministic unusual spending candidates from synthetic history; these are not fraud findings.", parameters: { type: "OBJECT", properties: {} } },
  { name: "create_reminder", description: "Prepare an in-app reminder proposal. User confirmation is still required.", parameters: { type: "OBJECT", properties: { title: { type: "STRING" }, details: { type: "STRING" } }, required: ["title", "details"] } },
  { name: "configure_spending_alert", description: "Prepare a spending alert proposal. User confirmation is still required.", parameters: { type: "OBJECT", properties: { title: { type: "STRING" }, details: { type: "STRING" } }, required: ["title", "details"] } },
  { name: "prepare_subscription_action", description: "Prepare a simulated subscription workflow; no cancellation is executed.", parameters: { type: "OBJECT", properties: { title: { type: "STRING" }, details: { type: "STRING" } }, required: ["title", "details"] } }
];
app.post("/api/v1/voice/session", async (_req, res) => {
  if (!env.GEMINI_API_KEY) return res.status(503).json({ error: "Live voice is not configured. Add GEMINI_API_KEY on the API server. Text assistant remains available." });
  try {
    const model = env.GEMINI_LIVE_MODEL;
    const instruction = `You are a concise, warm financial assistant for ${DEMO_USER.name}. Speak naturally in English, Hindi, or Hinglish matching the user. All money is INR. These are synthetic demo records. Use tools for financial facts; never guess amounts. Tool results include fields ending in Rupees that are already formatted in INR; speak those values and never read fields ending in Paise aloud as rupees. Explain there is no real bank connection. You may propose reminders or alerts, but never say an action is created until the app confirms it. Do not initiate money movement or claim subscription cancellation.`;
    const voice = env.GEMINI_VOICE;
    const liveConnectConstraints = { model: `models/${model}`, config: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } }, systemInstruction: { parts: [{ text: instruction }] }, inputAudioTranscription: {}, outputAudioTranscription: {}, sessionResumption: {}, tools: [{ functionDeclarations: financialTools }] } };
    const googleResponse = await fetch("https://generativelanguage.googleapis.com/v1alpha/auth_tokens", { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY }, body: JSON.stringify({ uses: 1, expireTime: new Date(Date.now() + 30 * 6e4).toISOString(), newSessionExpireTime: new Date(Date.now() + 6e4).toISOString(), liveConnectConstraints }) });
    if (!googleResponse.ok) {
      log.warn({ status: googleResponse.status }, "Voice token provider rejected request");
      return res.status(502).json({ error: "The voice provider could not initialize a session. Check model access and API configuration." });
    }
    const token = await googleResponse.json();
    if (!token.name) return res.status(502).json({ error: "Voice provider returned an invalid session token." });
    res.json({ token: token.name, model, voice, systemInstruction: instruction, tools: financialTools, websocketUrl: "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained", expiresAt: token.expireTime, modalities: ["AUDIO"], transport: "WebSocket" });
  } catch (error) {
    log.warn({ error: error instanceof Error ? error.message : "unknown" }, "Voice session initialization failed");
    res.status(502).json({ error: "Could not initialize voice session." });
  }
});
app.use((err, req, res, _next) => {
  log.error({ requestId: req.id, error: err instanceof Error ? err.message : "unknown" }, "Request failed");
  res.status(500).json({ error: "The request could not be completed.", requestId: req.id });
});
if (process["env"]["NODE_ENV"] !== "test") {
  if (env.MONGODB_URI) {
    void mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 5e3 }).then(() => {
      databaseStatus = "connected";
      log.info("MongoDB connected");
    }).catch((error) => {
      databaseStatus = "disconnected";
      log.warn({ error: error instanceof Error ? error.message : "unknown" }, "MongoDB unavailable; serving synthetic demo fixture");
    });
  }
  app.listen(port, () => log.info({ port, webOrigin }, "API listening"));
}
export {
  app
};
