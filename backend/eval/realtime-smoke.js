// Smoke test for the live voice agent: mints the same ephemeral Live session the browser gets (voice prompt,
// tools, voice), plays a Hinglish caller as typed turns, and prints the spoken transcript. Audio quality is not tested.
// Usage: npm run voice-smoke   (needs GEMINI_API_KEY in backend/.env)
import "dotenv/config";
import { loadConfig } from "../src/config.js";
import { createProfileStore, loadProfile } from "../src/store/profile.js";
import { createActionService } from "../src/services/actions.js";
import { executeTool } from "../src/services/tools.js";
import { createGeminiClient } from "../src/services/gemini.js";
import { createVoiceSession } from "../src/services/voice.js";
import { validateAnswer } from "../src/services/validator.js";

const config = loadConfig();
const store = createProfileStore(loadProfile());
const ctx = { user: store.user, store, actions: createActionService(store) };
const turns = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["Haan bolo, kya hua?", "IDFC wala charge thoda detail mein batao", "Theek hai, uska reversal draft kar do", "Haan, confirm karo"];

const gemini = createGeminiClient({ apiKey: config.GEMINI_API_KEY, fetch, log: console });
const session = await createVoiceSession({ config, user: ctx.user, gemini });
console.log(`model ${session.model} · voice ${session.voice}\n`);

const ws = new WebSocket(`${session.liveUrl}?access_token=${encodeURIComponent(session.token)}`);
const send = (message) => ws.send(JSON.stringify(message));
const say = (text) => send({ clientContent: { turns: [{ role: "user", parts: [{ text }] }], turnComplete: true } });
const toolResults = [];
const pendingTurns = [...turns];
let lastUser = "";
let spoken = "";

ws.onopen = () => send({ setup: {} }); // the setup itself is locked in the token
ws.onmessage = async ({ data }) => {
  const message = JSON.parse(typeof data === "string" ? data : Buffer.from(await data.arrayBuffer()).toString());
  // The agent opens the call, as in the browser.
  if (message.setupComplete) return say("(The call has just connected. Open the weekly money call now.)");
  if (message.toolCall) {
    const functionResponses = [];
    for (const call of message.toolCall.functionCalls ?? []) {
      let response;
      try {
        const { result } = await executeTool(call.name, call.args ?? {}, { ...ctx, userMessage: lastUser || undefined });
        toolResults.push(result);
        response = { result };
      } catch (error) {
        response = { error: error.message };
      }
      if (spoken.trim()) console.log(`AGENT (before tool): ${spoken.trim()}`), (spoken = "");
      console.log(`   [tool] ${call.name}`);
      functionResponses.push({ id: call.id, name: call.name, response });
    }
    return send({ toolResponse: { functionResponses } });
  }
  const content = message.serverContent;
  if (!content) return;
  if (content.outputTranscription?.text) spoken += content.outputTranscription.text;
  if (!content.turnComplete) return;
  const text = spoken.trim();
  spoken = "";
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
  say(next);
};
ws.onclose = (event) => {
  if (event.code !== 1000) console.log("closed:", event.code, event.reason);
  process.exit(0);
};
setTimeout(() => (console.log("timeout"), process.exit(1)), 180_000);
