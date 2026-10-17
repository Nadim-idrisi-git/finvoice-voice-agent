import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./index.js";
describe("versioned API", () => {
  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });
  it("serves the synthetic dashboard", async () => {
    const response = await request(app).get("/api/v1/dashboard");
    expect(response.status).toBe(200);
    expect(response.body.synthetic).toBe(true);
    expect(response.body.transactions.length).toBeGreaterThan(0);
  });
  it("grounds assistant totals in paise records and validates input", async () => {
    const good = await request(app).post("/api/v1/assistant/message").send({ message: "How much did I spend this month?" });
    expect(good.status).toBe(200);
    expect(good.body.data.amountPaise).toBeGreaterThan(0);
    expect(good.body.answer).toContain("\u20B9");
    const bad = await request(app).post("/api/v1/assistant/message").send({ message: "" });
    expect(bad.status).toBe(400);
  });
  it("requires confirmation and executes one in-app reminder idempotently", async () => {
    const proposed = await request(app).post("/api/v1/actions").send({ type: "reminder", title: "Bill reminder", details: "Remind me before the next bill due date." });
    expect(proposed.status).toBe(201);
    expect(proposed.body.status).toBe("AWAITING_CONFIRMATION");
    const unconfirmed = await request(app).post(`/api/v1/actions/${proposed.body.id}/confirm`).send({});
    expect(unconfirmed.status).toBe(400);
    const confirmed = await request(app).post(`/api/v1/actions/${proposed.body.id}/confirm`).send({ confirmation: true });
    expect(confirmed.body.status).toBe("SUCCEEDED");
    const duplicate = await request(app).post(`/api/v1/actions/${proposed.body.id}/confirm`).send({ confirmation: true });
    expect(duplicate.body.status).toBe("SUCCEEDED");
    const reminders = await request(app).get("/api/v1/reminders");
    expect(reminders.body.some((r) => r.title === "Bill reminder")).toBe(true);
  });
  it("does not issue a voice token without provider credentials", async () => {
    delete process.env.GEMINI_API_KEY;
    const response = await request(app).post("/api/v1/voice/session").send({});
    expect(response.status).toBe(503);
  });
  it("rejects synthetic demo API access in production", async () => {
    const original = "development";
    process.env.NODE_ENV = "production";
    const response = await request(app).get("/api/v1/dashboard");
    expect(response.status).toBe(503);
    process.env.NODE_ENV = original;
  });
  it("validates requested month and returns historical synthetic categories", async () => {
    const good = await request(app).get("/api/v1/analytics/month?month=2026-09");
    expect(good.status).toBe(200);
    expect(good.body.totalPaise).toBeGreaterThan(0);
    const bad = await request(app).get("/api/v1/analytics/month?month=2026-13");
    expect(bad.status).toBe(400);
  });
});
