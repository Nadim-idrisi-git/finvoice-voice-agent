// Runs the evaluation cases against the real agent (needs GEMINI_API_KEY in backend/.env).
// Usage: npm run eval  ·  Writes eval/results/latest.json and prints a summary.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createLogger } from "../src/middleware/requestLog.js";
import { createProfileStore, loadProfile } from "../src/store/profile.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const suite = JSON.parse(fs.readFileSync(path.join(dir, "cases.json"), "utf8"));
const profile = loadProfile();
if (!profile) throw new Error("Run npm run ingest first.");
const config = loadConfig({ ...process.env, NODE_ENV: "development", ASSISTANT_RATE_LIMIT: "100000" });
if (!config.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required for the evaluation.");

const ABSTAIN = /couldn.?t verify|can.?t verify|cannot verify|not (available|in your records)|don.?t have|no (data|information|record)|unable to|can.?t (find|see|access)|couldn.?t find|verify nahi|nahi (mil|hai|pata)|records? (mein|me) nahi|data nahi|उपलब्ध नहीं|नहीं (है|मिला)/i;
const rx = (s) => new RegExp(s, "i");

async function runCase(c) {
  const app = createApp({ config, store: createProfileStore(profile), log: createLogger({ silent: true }) });
  const server = app.listen(0);
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const post = (p, body) =>
    fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
  const turns = [];
  try {
    for (const message of c.turns) {
      const started = performance.now();
      const reply = await post("/assistant/message", { message });
      turns.push({ message, ms: Math.round(performance.now() - started), ...reply });
    }
    const actions = await fetch(base + "/actions").then((r) => r.json());
    const last = turns.at(-1);
    const usedAll = turns.flatMap((t) => t.toolsUsed ?? []);
    const usedLast = last.toolsUsed ?? [];
    const e = c.expect;
    const checks = [];
    const check = (name, ok, detail) => checks.push({ name, ok, ...(ok ? {} : { detail }) });
    check("answered by gemini", last.source === "gemini", last.source);
    for (const t of e.tools ?? []) check(`tool ${t}`, usedLast.includes(t) || usedAll.includes(t), usedAll);
    for (const t of e.prohibitedTools ?? []) check(`no tool ${t}`, !usedAll.includes(t), usedAll);
    for (const r of e.include ?? []) check(`include /${r}/`, rx(r).test(last.answer), last.answer);
    for (const r of e.exclude ?? []) check(`exclude /${r}/`, !rx(r).test(last.answer), last.answer);
    if (e.abstain) check("abstains", ABSTAIN.test(last.answer), last.answer);
    if (e.actionStatus) check(`action ${e.actionStatus}`, actions.some((a) => a.status === e.actionStatus), actions.map((a) => a.status));
    if (e.noSucceededAction) check("no succeeded action", !actions.some((a) => a.status === "SUCCEEDED"), actions.map((a) => a.status));
    check("validator did not abstain", last.validation?.status !== "abstained", last.validation);
    return { ...c, pass: checks.every((x) => x.ok), checks, turns: turns.map(({ message, answer, toolsUsed, validation, ms }) => ({ message, answer, toolsUsed, validation, ms })) };
  } catch (error) {
    return { ...c, pass: false, error: error.message, turns };
  } finally {
    server.close();
  }
}

async function pool(items, size, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: size }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

const pct = (n, d) => (d ? `${Math.round((n / d) * 1000) / 10}%` : "n/a");
const quantile = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

const results = await pool(suite.cases, 4, runCase);
const group = (key) =>
  Object.entries(results.reduce((acc, r) => ((acc[r[key]] ??= []).push(r), acc), {})).map(([k, rs]) => `${k} ${rs.filter((r) => r.pass).length}/${rs.length}`);
const withTools = results.filter((r) => r.expect.tools?.length);
const toolOk = withTools.filter((r) => r.checks?.filter((c) => c.name.startsWith("tool ")).every((c) => c.ok));
const abstainCases = results.filter((r) => r.expect.abstain);
const validations = results.flatMap((r) => r.turns.map((t) => t.validation?.status ?? "none"));
const latencies = results.flatMap((r) => r.turns.map((t) => t.ms)).filter(Number.isFinite);
const critical = results.filter((r) => r.severity === "critical");
const summary = {
  suiteVersion: suite.version,
  model: config.GEMINI_MODEL,
  thinkingLevel: config.GEMINI_THINKING_LEVEL ?? "default",
  ranAt: new Date().toISOString(),
  passed: `${results.filter((r) => r.pass).length}/${results.length}`,
  criticalPassed: `${critical.filter((r) => r.pass).length}/${critical.length}`,
  toolSelectionAccuracy: pct(toolOk.length, withTools.length),
  abstentionCorrect: pct(abstainCases.filter((r) => r.pass).length, abstainCases.length),
  validator: validations.reduce((acc, v) => ({ ...acc, [v]: (acc[v] ?? 0) + 1 }), {}),
  latencyMs: { p50: quantile(latencies, 0.5), p95: quantile(latencies, 0.95), max: Math.max(...latencies) },
  byCategory: group("category"),
  byLanguage: group("lang"),
};
fs.mkdirSync(path.join(dir, "results"), { recursive: true });
fs.writeFileSync(path.join(dir, "results/latest.json"), JSON.stringify({ summary, results }, null, 1));
console.log(JSON.stringify(summary, null, 1));
for (const r of results.filter((r) => !r.pass)) {
  console.log(`\nFAIL ${r.id} [${r.severity}]`, r.error ?? "");
  for (const c of r.checks ?? []) if (!c.ok) console.log("  ✗", c.name, "→", typeof c.detail === "string" ? c.detail.slice(0, 220) : JSON.stringify(c.detail));
}
process.exit(critical.every((r) => r.pass) ? 0 : 1);
