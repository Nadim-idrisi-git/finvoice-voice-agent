import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fakeFetch, startApp } from "./helpers.js";

const turn = (...parts) => ({ candidates: [{ content: { role: "model", parts } }] });
const message = (text) => turn({ text });
const call = (name, args = {}, id = "call_1") => turn({ functionCall: { id, name, args }, thoughtSignature: "sig_1" });

describe("Gemini text agent", () => {
  it("runs the tools the model asks for and returns the model's grounded answer", async () => {
    const fetch = fakeFetch(
      call("get_spending_summary"),
      message("You spent ₹69,247.87 this month."),
    );
    const api = await startApp({ GEMINI_API_KEY: "gk-test" }, { fetch });
    const { body } = await api.request("/api/v1/assistant/message", { body: { message: "How much did I spend?" } });
    await api.close();

    assert.equal(body.source, "gemini");
    assert.equal(body.answer, "You spent ₹69,247.87 this month.");
    assert.deepEqual(body.toolsUsed, ["get_spending_summary"]);
    const [first, second] = fetch.calls;
    assert.equal(first.url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent");
    assert.equal(first.init.headers["x-goog-api-key"], "gk-test");
    assert.ok(first.body.tools[0].functionDeclarations.length >= 7);
    // The model turn is sent back verbatim (thought signature included), followed by the tool result.
    const [, modelTurn, toolTurn] = second.body.contents;
    assert.equal(modelTurn.parts[0].thoughtSignature, "sig_1");
    const response = toolTurn.parts[0].functionResponse;
    assert.equal(response.id, "call_1");
    assert.match(response.response.result.totalRupees, /^₹/);
  });

  it("returns action proposals created by tools, still awaiting confirmation", async () => {
    const fetch = fakeFetch(
      call("create_reminder", { title: "Pay rent", details: "Remind me on the 1st" }),
      message("I drafted a reminder. Please confirm it under Actions."),
    );
    const api = await startApp({ GEMINI_API_KEY: "gk-test" }, { fetch });
    const { body } = await api.request("/api/v1/assistant/message", { body: { message: "Remind me to pay rent" } });
    const reminders = await api.request("/api/v1/reminders");
    await api.close();

    assert.equal(body.actionProposal.status, "AWAITING_CONFIRMATION");
    assert.equal(body.actionProposal.title, "Pay rent");
    assert.deepEqual(reminders.body, []);
  });

  it("reports tool errors back to the model instead of failing the request", async () => {
    const fetch = fakeFetch(call("transfer_money"), message("I can't do that."));
    const api = await startApp({ GEMINI_API_KEY: "gk-test" }, { fetch });
    const { body } = await api.request("/api/v1/assistant/message", { body: { message: "Send money to Raj" } });
    await api.close();

    assert.equal(body.answer, "I can't do that.");
    assert.match(fetch.calls[1].body.contents.at(-1).parts[0].functionResponse.response.error, /Unknown tool/);
  });

  it("keeps the conversation for the next message", async () => {
    const fetch = fakeFetch(message("Hello Vivek."), message("Sure."));
    const api = await startApp({ GEMINI_API_KEY: "gk-test" }, { fetch });
    await api.request("/api/v1/assistant/message", { body: { message: "Hi" } });
    await api.request("/api/v1/assistant/message", { body: { message: "Thanks" } });
    await api.close();

    const texts = fetch.calls[1].body.contents.map((c) => `${c.role}:${c.parts[0].text}`);
    assert.deepEqual(texts, ["user:Hi", "model:Hello Vivek.", "user:Thanks"]);
  });

  it("falls back to the rule-based assistant when Gemini fails", async () => {
    const fetch = fakeFetch({ ok: false, status: 500, json: {} });
    const api = await startApp({ GEMINI_API_KEY: "gk-test" }, { fetch });
    const { status, body } = await api.request("/api/v1/assistant/message", {
      body: { message: "How much did I spend this month?" },
    });
    await api.close();

    assert.equal(status, 200);
    assert.equal(body.source, "rules");
    assert.match(body.answer, /₹/);
  });
});
