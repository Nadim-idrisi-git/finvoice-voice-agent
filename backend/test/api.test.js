import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { fakeFetch, startApp } from "./helpers.js";

describe("versioned API (no Gemini key)", () => {
  let api;
  before(async () => (api = await startApp()));
  after(() => api.close());

  it("serves the synthetic dashboard with security headers", async () => {
    const { status, body, headers } = await api.request("/api/v1/dashboard");
    assert.equal(status, 200);
    assert.equal(body.synthetic, true);
    assert.ok(body.transactions.length > 0);
    assert.equal(headers.get("x-content-type-options"), "nosniff");
    assert.ok(headers.get("x-request-id"));
  });
  it("answers with the rule-based assistant and validates input", async () => {
    const good = await api.request("/api/v1/assistant/message", { body: { message: "How much did I spend this month?" } });
    assert.equal(good.status, 200);
    assert.equal(good.body.source, "rules");
    assert.ok(good.body.data.amountPaise > 0);
    assert.match(good.body.answer, /₹/);
    const bad = await api.request("/api/v1/assistant/message", { body: { message: "" } });
    assert.equal(bad.status, 400);
  });
  it("requires confirmation and executes one in-app reminder idempotently", async () => {
    const proposed = await api.request("/api/v1/actions", {
      body: { type: "reminder", title: "Bill reminder", details: "Remind me before the next bill due date." },
    });
    assert.equal(proposed.status, 201);
    assert.equal(proposed.body.status, "AWAITING_CONFIRMATION");
    const confirmUrl = `/api/v1/actions/${proposed.body.id}/confirm`;
    assert.equal((await api.request(confirmUrl, { body: {} })).status, 400);
    assert.equal((await api.request(confirmUrl, { body: { confirmation: true } })).body.status, "SUCCEEDED");
    assert.equal((await api.request(confirmUrl, { body: { confirmation: true } })).body.status, "SUCCEEDED");
    const reminders = await api.request("/api/v1/reminders");
    assert.equal(reminders.body.filter((r) => r.title === "Bill reminder").length, 1);
    const audit = await api.request("/api/v1/audit");
    const events = audit.body.filter((e) => e.actionId === proposed.body.id).map((e) => e.event);
    assert.deepEqual(events, ["CONFIRMED_AND_EXECUTED", "PROPOSED"]);
  });
  it("returns 404 for an unknown action", async () => {
    assert.equal((await api.request("/api/v1/actions/nope/confirm", { body: { confirmation: true } })).status, 404);
  });
  it("does not issue a voice session without a Gemini key", async () => {
    assert.equal((await api.request("/api/v1/voice/session", { body: {} })).status, 503);
  });
  it("validates requested month and returns historical synthetic categories", async () => {
    const good = await api.request("/api/v1/analytics/month?month=2026-09");
    assert.equal(good.status, 200);
    assert.ok(good.body.totalPaise > 0);
    assert.equal((await api.request("/api/v1/analytics/month?month=2026-13")).status, 400);
  });
});

describe("voice tool registry", () => {
  let api;
  before(async () => (api = await startApp()));
  after(() => api.close());

  it("runs read tools with formatted rupee fields beside paise amounts", async () => {
    const { status, body } = await api.request("/api/v1/tools/get_upcoming_bills", { body: {} });
    assert.equal(status, 200);
    assert.equal(body.result[0].amountRupees, "₹2,350");
    assert.equal(body.proposesAction, false);
  });
  it("turns action tools into proposals that still need confirmation", async () => {
    const { body } = await api.request("/api/v1/tools/create_reminder", {
      body: { args: { title: "Pay internet", details: "Before it is due" } },
    });
    assert.equal(body.proposesAction, true);
    assert.equal(body.result.status, "AWAITING_CONFIRMATION");
    assert.deepEqual((await api.request("/api/v1/reminders")).body, []);
  });
  it("rejects unknown tools and invalid arguments", async () => {
    assert.equal((await api.request("/api/v1/tools/transfer_money", { body: {} })).status, 404);
    assert.equal((await api.request("/api/v1/tools/create_reminder", { body: { args: { title: 5 } } })).status, 400);
  });
});

describe("guards", () => {
  it("rejects synthetic demo API access in production", async () => {
    const api = await startApp({ NODE_ENV: "production" });
    assert.equal((await api.request("/api/v1/dashboard")).status, 503);
    await api.close();
  });
  it("rate limits voice session requests", async () => {
    const api = await startApp();
    const statuses = [];
    try {
      for (let i = 0; i < 7; i++) statuses.push((await api.request("/api/v1/voice/session", { body: {} })).status);
    } finally {
      await api.close();
    }
    assert.deepEqual(statuses, [503, 503, 503, 503, 503, 503, 429]);
  });
});

describe("Gemini Live voice session", () => {
  it("mints an ephemeral token with server-owned instructions and tools, never exposing the API key", async () => {
    const fetch = fakeFetch({ name: "auth_tokens/ek_test" });
    const api = await startApp({ GEMINI_API_KEY: "gk-secret" }, { fetch });
    const { status, body } = await api.request("/api/v1/voice/session", { body: { voice: "puck" } });
    await api.close();
    assert.equal(status, 200);
    assert.equal(body.token, "auth_tokens/ek_test");
    assert.equal(body.model, "gemini-3.8-live");
    assert.equal(body.voice, "Puck");
    assert.equal(fetch.calls[0].url, "https://generativelanguage.googleapis.com/v1beta/auth_tokens");
    assert.equal(fetch.calls[0].init.headers["x-goog-api-key"], "gk-secret");
    assert.equal(fetch.calls[0].body.uses, 1);
    const setup = fetch.calls[0].body.bidiGenerateContentSetup;
    assert.equal(setup.model, "models/gemini-3.8-live");
    assert.equal(setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, "Puck");
    assert.match(setup.systemInstruction.parts[0].text, /masculine/);
    const tools = setup.tools[0].functionDeclarations;
    assert.ok(tools.some((t) => t.name === "get_upcoming_bills" && t.behavior === "BLOCKING"));
    assert.doesNotMatch(JSON.stringify(body), /gk-secret/);
  });

  it("retries once when the connection to Gemini drops, then reports 502", async () => {
    const recovered = fakeFetch(new TypeError("fetch failed"), { name: "auth_tokens/ek_retry" });
    let api = await startApp({ GEMINI_API_KEY: "gk-secret" }, { fetch: recovered });
    const ok = await api.request("/api/v1/voice/session", { body: {} });
    await api.close();
    assert.equal(ok.status, 200);
    assert.equal(ok.body.token, "auth_tokens/ek_retry");
    assert.equal(recovered.calls.length, 2);

    const down = fakeFetch(new TypeError("fetch failed"), new TypeError("fetch failed"));
    api = await startApp({ GEMINI_API_KEY: "gk-secret" }, { fetch: down });
    const failed = await api.request("/api/v1/voice/session", { body: {} });
    await api.close();
    assert.equal(failed.status, 502);
    assert.equal(down.calls.length, 2);
  });
});

describe("tool idempotency", () => {
  it("replays the first result for a repeated call_id instead of creating a second action", async () => {
    const api = await startApp();
    const body = { args: { title: "Pay rent", details: "Before the 1st" }, callId: "call_abc" };
    const first = await api.request("/api/v1/tools/create_reminder", { body });
    const second = await api.request("/api/v1/tools/create_reminder", { body });
    const actions = await api.request("/api/v1/actions");
    await api.close();
    assert.equal(second.body.replayed, true);
    assert.equal(second.body.result.id, first.body.result.id);
    assert.equal(actions.body.length, 1);
  });
});

describe("voice answer validation", () => {
  it("accepts spoken amounts that tools returned and flags invented ones", async () => {
    const api = await startApp();
    await api.request("/api/v1/tools/get_upcoming_bills", { body: {} });
    const good = await api.request("/api/v1/voice/validate", { body: { transcript: "Your electricity bill is ₹2,350." } });
    const bad = await api.request("/api/v1/voice/validate", { body: { transcript: "Your electricity bill is ₹9,999." } });
    await api.close();
    assert.equal(good.body.ok, true);
    assert.deepEqual(bad.body.unsupportedAmounts, ["₹9,999"]);
  });
});

describe("voice confirmation guard", () => {
  it("rejects confirm_action from voice unless the user's last words say yes", async () => {
    const api = await startApp();
    const draft = await api.request("/api/v1/tools/create_reminder", { body: { args: { title: "Pay rent", details: "Before the 1st" } } });
    const id = draft.body.result.id;
    const refused = await api.request("/api/v1/tools/confirm_action", { body: { args: { action_id: id }, userTranscript: "Pehle details batao" } });
    const accepted = await api.request("/api/v1/tools/confirm_action", { body: { args: { action_id: id }, userTranscript: "Haan, confirm karo" } });
    await api.close();
    assert.equal(refused.status, 409);
    assert.equal(accepted.body.result.status, "SUCCEEDED");
  });

  it("accepts a yes transcribed in Devanagari, but not a Devanagari no", async () => {
    const api = await startApp();
    const confirm = async (userTranscript) => {
      const draft = await api.request("/api/v1/tools/create_reminder", { body: { args: { title: "Pay rent", details: "Before the 1st" } } });
      return api.request("/api/v1/tools/confirm_action", { body: { args: { action_id: draft.body.result.id }, userTranscript } });
    };
    const yes = await confirm("हाँ, कर दो");
    const no = await confirm("नहीं, रुको");
    await api.close();
    assert.equal(yes.body.result.status, "SUCCEEDED");
    assert.equal(no.status, 409);
  });
});

describe("production settings", () => {
  it("serves the demo API in production only with DEMO_MODE, and allows wildcard Vercel origins", async () => {
    const api = await startApp({ NODE_ENV: "production", DEMO_MODE: "true", WEB_ORIGIN: "https://finvoice*.vercel.app" });
    try {
      const ok = await fetch(api.base + "/api/v1/dashboard", { headers: { Origin: "https://finvoice-abc123.vercel.app" } });
      const bad = await fetch(api.base + "/api/v1/dashboard", { headers: { Origin: "https://evil.example.com" } });
      assert.equal(ok.status, 200);
      assert.equal(ok.headers.get("access-control-allow-origin"), "https://finvoice-abc123.vercel.app");
      assert.equal(bad.headers.get("access-control-allow-origin"), null);
    } finally {
      await api.close();
    }
  });
});
