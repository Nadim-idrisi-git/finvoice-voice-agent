import { describe, expect, it, vi } from "vitest";
import pino from "pino";
import request from "supertest";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const build = (env = {}, deps = {}) =>
  createApp({ config: loadConfig({ NODE_ENV: "test", ...env }), log: pino({ level: "silent" }), ...deps });

describe("versioned API", () => {
  it("serves the synthetic dashboard", async () => {
    const response = await request(build()).get("/api/v1/dashboard");
    expect(response.status).toBe(200);
    expect(response.body.synthetic).toBe(true);
    expect(response.body.transactions.length).toBeGreaterThan(0);
  });
  it("grounds assistant totals in paise records and validates input", async () => {
    const app = build();
    const good = await request(app)
      .post("/api/v1/assistant/message")
      .send({ message: "How much did I spend this month?" });
    expect(good.status).toBe(200);
    expect(good.body.data.amountPaise).toBeGreaterThan(0);
    expect(good.body.answer).toContain("₹");
    const bad = await request(app).post("/api/v1/assistant/message").send({ message: "" });
    expect(bad.status).toBe(400);
  });
  it("requires confirmation and executes one in-app reminder idempotently", async () => {
    const app = build();
    const proposed = await request(app)
      .post("/api/v1/actions")
      .send({ type: "reminder", title: "Bill reminder", details: "Remind me before the next bill due date." });
    expect(proposed.status).toBe(201);
    expect(proposed.body.status).toBe("AWAITING_CONFIRMATION");
    const unconfirmed = await request(app).post(`/api/v1/actions/${proposed.body.id}/confirm`).send({});
    expect(unconfirmed.status).toBe(400);
    const confirmed = await request(app)
      .post(`/api/v1/actions/${proposed.body.id}/confirm`)
      .send({ confirmation: true });
    expect(confirmed.body.status).toBe("SUCCEEDED");
    const duplicate = await request(app)
      .post(`/api/v1/actions/${proposed.body.id}/confirm`)
      .send({ confirmation: true });
    expect(duplicate.body.status).toBe("SUCCEEDED");
    const reminders = await request(app).get("/api/v1/reminders");
    expect(reminders.body.filter((r) => r.title === "Bill reminder")).toHaveLength(1);
    const audit = await request(app).get("/api/v1/audit");
    expect(audit.body.map((e) => e.event)).toEqual(["CONFIRMED_AND_EXECUTED", "PROPOSED"]);
  });
  it("returns 404 for an unknown action", async () => {
    const response = await request(build()).post("/api/v1/actions/nope/confirm").send({ confirmation: true });
    expect(response.status).toBe(404);
  });
  it("does not issue a voice token without provider credentials", async () => {
    const response = await request(build()).post("/api/v1/voice/session").send({});
    expect(response.status).toBe(503);
  });
  it("mints a v1alpha voice token with the server-owned prompt and tools", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ name: "auth_tokens/abc", expireTime: "x" }) });
    const response = await request(build({ GEMINI_API_KEY: "secret-key" }, { fetch }))
      .post("/api/v1/voice/session")
      .send({});
    expect(response.status).toBe(200);
    expect(fetch.mock.calls[0][0]).toContain("/v1alpha/auth_tokens");
    expect(response.body).toMatchObject({ token: "auth_tokens/abc", apiVersion: "v1alpha" });
    expect(response.body.tools.map((t) => t.name)).toContain("get_upcoming_bills");
    expect(fetch.mock.calls[0][1].headers["x-goog-api-key"]).toBe("secret-key");
    expect(JSON.stringify(response.body)).not.toContain("secret-key");
  });
  it("rejects synthetic demo API access in production", async () => {
    const response = await request(build({ NODE_ENV: "production" })).get("/api/v1/dashboard");
    expect(response.status).toBe(503);
  });
  it("validates requested month and returns historical synthetic categories", async () => {
    const app = build();
    const good = await request(app).get("/api/v1/analytics/month?month=2026-09");
    expect(good.status).toBe(200);
    expect(good.body.totalPaise).toBeGreaterThan(0);
    const bad = await request(app).get("/api/v1/analytics/month?month=2026-13");
    expect(bad.status).toBe(400);
  });
});

describe("voice tool registry", () => {
  it("runs read tools with formatted rupee fields beside paise amounts", async () => {
    const response = await request(build()).post("/api/v1/tools/get_upcoming_bills").send({});
    expect(response.status).toBe(200);
    expect(response.body.result[0].amountRupees).toBe("₹2,350");
    expect(response.body.proposesAction).toBe(false);
  });
  it("turns action tools into proposals that still need confirmation", async () => {
    const app = build();
    const response = await request(app)
      .post("/api/v1/tools/create_reminder")
      .send({ args: { title: "Pay internet", details: "Before it is due" } });
    expect(response.body.proposesAction).toBe(true);
    expect(response.body.result.status).toBe("AWAITING_CONFIRMATION");
    expect((await request(app).get("/api/v1/reminders")).body).toEqual([]);
  });
  it("rejects unknown tools and invalid arguments", async () => {
    const app = build();
    expect((await request(app).post("/api/v1/tools/transfer_money").send({})).status).toBe(404);
    expect(
      (
        await request(app)
          .post("/api/v1/tools/create_reminder")
          .send({ args: { title: 5 } })
      ).status,
    ).toBe(400);
  });
});
