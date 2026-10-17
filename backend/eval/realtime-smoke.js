// Smoke test for the live voice agent: drives the real Realtime model in text mode with the exact
// voice prompt and tools, plays a Hinglish caller, and prints the conversation. Audio is not tested.
// Usage: npm run voice-smoke   (needs OPENAI_API_KEY in backend/.env)
import "dotenv/config";
import { loadConfig } from "../src/config.js";
import { createProfileStore, loadProfile } from "../src/store/profile.js";
import { createActionService } from "../src/services/actions.js";
import { executeTool, toolDefinitions } from "../src/services/tools.js";
import { voiceInstructions } from "../src/services/prompts.js";
import { validateAnswer } from "../src/services/validator.js";

const config = loadConfig();
const store = createProfileStore(loadProfile());
const ctx = { user: store.user, store, actions: createActionService(store) };
const turns = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["Haan bolo, kya hua?", "IDFC wala charge thoda detail mein batao", "Theek hai, uska reversal draft kar do", "Haan, confirm karo"];

const ws = new WebSocket(`wss://api.openai.com/v1/realtime?model=${config.OPENAI_REALTIME_MODEL}`, [
  "realtime",
  `openai-insecure-api-key.${config.OPENAI_API_KEY}`,
]);
const send = (event) => ws.send(JSON.stringify(event));
const toolResults = [];
let pendingTurns = [...turns];
let lastUser = "";

ws.onopen = () => {
  send({
    type: "session.update",
    session: { type: "realtime", instructions: voiceInstructions(ctx.user, config.OPENAI_VOICE), tools: toolDefinitions, tool_choice: "auto", output_modalities: ["text"] },
  });
  send({ type: "response.create" }); // the agent opens the call, as in the browser
};

ws.onmessage = async ({ data }) => {
  const event = JSON.parse(data);
  if (event.type === "error") {
    console.log("ERROR:", event.error?.message);
    return ws.close();
  }
  if (event.type !== "response.done") return;
  const output = event.response?.output ?? [];
  const calls = output.filter((item) => item.type === "function_call");
  const spokenBeforeTools = output.filter((item) => item.type === "message").flatMap((item) => item.content ?? []).map((p) => p.text ?? p.transcript ?? "").join(" ").trim();
  if (calls.length && spokenBeforeTools) console.log(`AGENT (before tool): ${spokenBeforeTools}`);
  if (calls.length) {
    for (const call of calls) {
      let result;
      try {
        ({ result } = await executeTool(call.name, JSON.parse(call.arguments || "{}"), ctx));
        toolResults.push(result);
      } catch (error) {
        result = { error: error.message };
      }
      console.log(`   [tool] ${call.name}`);
      send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) } });
    }
    return send({ type: "response.create" });
  }
  const text = output.flatMap((item) => item.content ?? []).map((part) => part.text ?? part.transcript ?? "").join(" ").trim();
  if (text) {
    const check = validateAnswer({
      answer: text,
      toolResults,
      userMessage: lastUser,
      hasSucceededAction: (await ctx.actions.list(ctx.user.id)).some((a) => a.status === "SUCCEEDED"),
      hasProposedAction: (await ctx.actions.list(ctx.user.id)).some((a) => a.status === "AWAITING_CONFIRMATION"),
    });
    console.log(`AGENT: ${text}\n   [validator] ${check.ok ? "ok" : JSON.stringify(check)}`);
  }
  const next = pendingTurns.shift();
  if (!next) {
    const actions = await ctx.actions.list(ctx.user.id);
    console.log("\nACTIONS:", actions.map((a) => `${a.status} · ${a.title}`));
    return ws.close();
  }
  lastUser = next;
  console.log(`\nUSER: ${next}`);
  send({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: next }] } });
  send({ type: "response.create" });
};
ws.onclose = () => process.exit(0);
setTimeout(() => (console.log("timeout"), process.exit(1)), 120_000);
