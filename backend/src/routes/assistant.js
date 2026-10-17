import { Router } from "express";
import { validateMessage } from "../lib/validate.js";
import { answerFinancialQuestion, detectActionRequest } from "../modules/rules.js";
import { HttpError } from "../http.js";
import { loadFinance } from "../store/finance.js";
import { runAgent } from "../services/agent.js";
import { executeTool } from "../services/tools.js";
import { createVoiceSession } from "../services/voice.js";

/** Text chat (OpenAI agent with rule-based fallback), voice tool execution, and voice session minting. */
export function assistantRoutes({ store, actions, config, openai, log }) {
  const router = Router();

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
    if (openai.configured) {
      try {
        reply = await runAgent({ message: value.message, ctx: { user, store, actions }, openai, model: config.OPENAI_MODEL });
        source = "openai";
      } catch (err) {
        log.warn({ requestId: req.id, error: err instanceof Error ? err.message : "unknown" }, "Agent failed; using rules");
      }
    }
    reply ??= await answerWithRules(value.message, user.id);
    res.json({
      ...reply,
      actionProposal: reply.actionProposals[0] ?? null,
      source,
      synthetic: true,
      requestId: req.id,
    });
  });

  router.post("/tools/:name", async (req, res) => {
    res.json(await executeTool(req.params.name, req.body?.args, { user: res.locals.user, store, actions }));
  });

  router.post("/voice/session", async (_req, res) => {
    res.json(await createVoiceSession({ config, user: res.locals.user, openai }));
  });

  return router;
}
