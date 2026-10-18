import { Router } from "express";
import { validateMessage } from "../lib/validate.js";
import { answerFinancialQuestion, detectActionRequest } from "../modules/rules.js";
import { HttpError } from "../http.js";
import { loadFinance } from "../store/finance.js";
import { runAgent } from "../services/agent.js";
import { executeTool } from "../services/tools.js";
import { createVoiceSession } from "../services/voice.js";
import { validateAnswer } from "../services/validator.js";

/** Text chat (Gemini agent with rule-based fallback), voice tool execution, and voice session minting. */
export function assistantRoutes({ store, actions, config, gemini, log }) {
  const router = Router();
  // Recent Gemini conversation per user, for short-term conversation memory in text chat.
  const lastHistory = new Map();
  // Tool results from the user's previous turn, so follow-up answers can cite them.
  const lastEvidence = new Map();

  async function answerWithRules(message, ownerId) {
    const result = answerFinancialQuestion(message, await loadFinance(store, ownerId));
    const request = detectActionRequest(message);
    if (!request) return { answer: result.answer, intent: result.intent, data: result.data, actionProposals: [] };
    return {
      answer: "I drafted that as a proposal. Please review the exact details under Actions and confirm it there.",
      intent: result.intent,
      data: result.data,
      actionProposals: [await actions.propose(ownerId, request)],
    };
  }

  router.post("/assistant/message", async (req, res) => {
    const { value, error } = validateMessage(req.body);
    if (error) throw new HttpError(400, error);
    const user = res.locals.user;
    let reply;
    let source = "rules";
    if (gemini.configured) {
      try {
        reply = await runAgent({
          message: value.message,
          ctx: { user, store, actions, userMessage: value.message },
          gemini,
          model: config.GEMINI_MODEL,
          thinkingLevel: config.GEMINI_THINKING_LEVEL,
          history: lastHistory.get(user.id),
          evidenceCarryover: lastEvidence.get(user.id) ?? [],
          log,
        });
        lastHistory.set(user.id, reply.history);
        lastEvidence.set(user.id, reply.toolResults);
        source = "gemini";
      } catch (err) {
        log.warn({ requestId: req.id, error: err instanceof Error ? err.message : "unknown" }, "Agent failed; using rules");
      }
    }
    reply ??= await answerWithRules(value.message, user.id);
    const { history: _history, toolResults: _evidence, ...publicReply } = reply;
    res.json({
      ...publicReply,
      actionProposal: reply.actionProposals[0] ?? null,
      source,
      synthetic: true,
      requestId: req.id,
    });
  });

  // Voice tool calls are idempotent per Gemini function call id: a retried or duplicated call returns the
  // first result instead of running the tool (and creating an action) twice.
  const toolCallResults = new Map();
  // Recent tool results per user (server-produced, never client-supplied) for post-hoc voice validation.
  const recentResults = new Map();
  const remember = (userId, result) => recentResults.set(userId, [...(recentResults.get(userId) ?? []), result].slice(-40));
  router.post("/tools/:name", async (req, res) => {
    const callId = typeof req.body?.callId === "string" ? req.body.callId.slice(0, 100) : null;
    const key = callId && `${res.locals.user.id}:${callId}`;
    if (key && toolCallResults.has(key)) return res.json({ ...toolCallResults.get(key), replayed: true });
    // The user's latest words (voice transcript) let confirm_action require an explicit yes, as in text chat.
    const userMessage = typeof req.body?.userTranscript === "string" ? req.body.userTranscript.slice(0, 1000) : "";
    const result = await executeTool(req.params.name, req.body?.args, { user: res.locals.user, store, actions, userMessage });
    remember(res.locals.user.id, result.result);
    if (key) {
      toolCallResults.set(key, result);
      if (toolCallResults.size > 5000) toolCallResults.delete(toolCallResults.keys().next().value);
    }
    res.json(result);
  });

  // Voice answers are spoken while generated, so they are validated right after: the transcript is checked
  // against tool results this server produced for the user. The client then asks the model to self-correct.
  router.post("/voice/validate", async (req, res) => {
    const transcript = typeof req.body?.transcript === "string" ? req.body.transcript.slice(0, 2000) : "";
    const userMessage = typeof req.body?.userTranscript === "string" ? req.body.userTranscript.slice(0, 1000) : "";
    const result = validateAnswer({
      answer: transcript,
      toolResults: recentResults.get(res.locals.user.id) ?? [],
      userMessage,
      hasSucceededAction: (await actions.list(res.locals.user.id)).some((a) => a.status === "SUCCEEDED"),
      hasProposedAction: (await actions.list(res.locals.user.id)).some((a) => a.status === "AWAITING_CONFIRMATION"),
    });
    if (!result.ok) log.warn({ requestId: req.id, unsupported: result.unsupportedAmounts.map((a) => a.text) }, "Voice answer failed validation");
    res.json({ ok: result.ok, unsupportedAmounts: result.unsupportedAmounts.map((a) => a.text), unsupportedSuccess: result.unsupportedSuccess });
  });

  router.post("/voice/session", async (req, res) => {
    const voice = typeof req.body?.voice === "string" ? req.body.voice : undefined;
    res.json(await createVoiceSession({ config, user: res.locals.user, gemini, voice }));
  });

  return router;
}
