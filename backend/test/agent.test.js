import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fakeFetch, startApp } from "./helpers.js";

const message = (text) => ({ type: "message", content: [{ type: "output_text", text }] });
const call = (name, args = {}, id = "call_1") => ({
  type: "function_call",
  call_id: id,
  name,
  arguments: JSON.stringify(args),
});

describe("OpenAI text agent", () => {
  it("runs the tools the model asks for and returns the model's grounded answer", async () => {
    const fetch = fakeFetch(
      { id: "resp_1", output: [call("get_spending_summary")] },
      { id: "resp_2", output: [message("You spent ₹69,247.87 this month.")] },
    );
    const api = await startApp({ OPENAI_API_KEY: "sk-test" }, { fetch });
    const { body } = await api.request("/api/v1/assistant/message", { body: { message: "How much did I spend?" } });
    await api.close();

    assert.equal(body.source, "openai");
    assert.equal(body.answer, "You spent ₹69,247.87 this month.");
    assert.deepEqual(body.toolsUsed, ["get_spending_summary"]);
    const [first, second] = fetch.calls;
    assert.equal(first.url, "https://api.openai.com/v1/responses");
    assert.equal(first.body.model, "gpt-6-luna");
    assert.ok(first.body.tools.length >= 7);
    assert.equal(second.body.previous_response_id, "resp_1");
    const output = JSON.parse(second.body.input[0].output);
    assert.equal(second.body.input[0].call_id, "call_1");
    assert.match(output.totalRupees, /^₹/);
  });

  it("returns action proposals created by tools, still awaiting confirmation", async () => {
    const fetch = fakeFetch(
      { id: "r1", output: [call("create_reminder", { title: "Pay rent", details: "Remind me on the 1st" })] },
      { id: "r2", output: [message("I drafted a reminder. Please confirm it under Actions.")] },
    );
    const api = await startApp({ OPENAI_API_KEY: "sk-test" }, { fetch });
    const { body } = await api.request("/api/v1/assistant/message", { body: { message: "Remind me to pay rent" } });
    const reminders = await api.request("/api/v1/reminders");
    await api.close();

    assert.equal(body.actionProposal.status, "AWAITING_CONFIRMATION");
    assert.equal(body.actionProposal.title, "Pay rent");
    assert.deepEqual(reminders.body, []);
  });

  it("reports tool errors back to the model instead of failing the request", async () => {
    const fetch = fakeFetch({ id: "r1", output: [call("transfer_money")] }, { id: "r2", output: [message("I can't do that.")] });
    const api = await startApp({ OPENAI_API_KEY: "sk-test" }, { fetch });
    const { body } = await api.request("/api/v1/assistant/message", { body: { message: "Send money to Raj" } });
    await api.close();

    assert.equal(body.answer, "I can't do that.");
    assert.match(JSON.parse(fetch.calls[1].body.input[0].output).error, /Unknown tool/);
  });

  it("falls back to the rule-based assistant when OpenAI fails", async () => {
    const fetch = fakeFetch({ ok: false, status: 500, json: {} });
    const api = await startApp({ OPENAI_API_KEY: "sk-test" }, { fetch });
    const { status, body } = await api.request("/api/v1/assistant/message", {
      body: { message: "How much did I spend this month?" },
    });
    await api.close();

    assert.equal(status, 200);
    assert.equal(body.source, "rules");
    assert.match(body.answer, /₹/);
  });
});
