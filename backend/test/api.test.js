import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { fakeFetch, startApp } from "./helpers.js";

describe("versioned API (no OpenAI key)", () => {
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
  it("reports voice as not configured and refuses to transcribe without an ElevenLabs key", async () => {
    assert.equal((await api.request("/api/v1/voice/status")).body.configured, false);
    const response = await fetch(api.base + "/api/v1/voice/transcribe", {
      method: "POST",
      headers: { "Content-Type": "audio/webm" },
      body: new Uint8Array(2000),
    });
    assert.equal(response.status, 503);
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
  it("rate limits text chat per client", async () => {
    const api = await startApp({ ASSISTANT_RATE_LIMIT: "2" });
    const statuses = [];
    for (let i = 0; i < 3; i++) statuses.push((await api.request("/api/v1/assistant/message", { body: { message: "hi" } })).status);
    assert.deepEqual(statuses, [200, 200, 429]);
    await api.close();
  });
});

describe("ElevenLabs voice", () => {
  const keys = { OPENAI_API_KEY: "sk-test", ELEVENLABS_API_KEY: "xi-secret", ELEVENLABS_VOICE_ID: "voice123" };
  it("transcribes uploaded audio through Scribe without exposing the key", async () => {
    const fetch = fakeFetch({ text: " Mera IDFC charge kitna hai? ", language_code: "hin", language_probability: 0.93 });
    const api = await startApp(keys, { fetch });
    const response = await globalThis.fetch(api.base + "/api/v1/voice/transcribe", {
      method: "POST",
      headers: { "Content-Type": "audio/webm;codecs=opus" },
      body: new Uint8Array(4000),
    });
    const body = await response.json();
    await api.close();
    assert.equal(body.text, "Mera IDFC charge kitna hai?");
    assert.equal(body.languageCode, "hin");
    assert.equal(fetch.calls[0].url, "https://api.elevenlabs.io/v1/speech-to-text");
    assert.equal(fetch.calls[0].init.headers["xi-api-key"], "xi-secret");
    assert.equal(fetch.calls[0].body.get("model_id"), "scribe_v2");
    assert.doesNotMatch(JSON.stringify(body), /xi-secret/);
  });
  it("speaks only the validated answer this server produced, for its owner", async () => {
    const message = { type: "message", content: [{ type: "output_text", text: "Hi Vivek, this is your money call." }] };
    const audio = new ReadableStream({ start: (c) => (c.enqueue(new TextEncoder().encode("MP3DATA")), c.close()) });
    const fetch = fakeFetch({ id: "r1", output: [message] }, { stream: audio });
    const api = await startApp(keys, { fetch });
    const reply = await api.request("/api/v1/assistant/message", { body: { message: "The call has started.", channel: "voice" } });
    const speech = await globalThis.fetch(api.base + `/api/v1/voice/speech/${reply.body.speechId}`);
    const bytes = await speech.text();
    const missing = await globalThis.fetch(api.base + "/api/v1/voice/speech/not-issued");
    await api.close();
    assert.ok(reply.body.speechId);
    assert.equal(speech.headers.get("content-type"), "audio/mpeg");
    assert.equal(bytes, "MP3DATA");
    assert.equal(fetch.calls[1].url, "https://api.elevenlabs.io/v1/text-to-speech/voice123/stream?output_format=mp3_44100_128");
    assert.equal(fetch.calls[1].body.text, "Hi Vivek, this is your money call.");
    assert.equal(fetch.calls[1].body.model_id, "eleven_flash_v2_5");
    assert.equal(missing.status, 404);
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
