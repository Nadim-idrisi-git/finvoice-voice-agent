import { Router } from "express";
import { messageSchema } from "@finance-agent/shared";
import { answerFinancialQuestion, detectActionRequest } from "../modules/agent.js";
import { HttpError } from "../http.js";
import { loadFinance } from "../store/finance.js";
import { executeTool } from "../services/tools.js";
import { createVoiceSession } from "../services/voice.js";

/** Text assistant, voice tool execution, and voice session minting. */
export function assistantRoutes({ store, actions, config, fetch, log }) {
  const router = Router();

  router.post("/assistant/message", async (req, res) => {
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Message must contain 1 to 1200 characters.");
    const { message } = parsed.data;
    const ownerId = res.locals.user.id;
    const result = answerFinancialQuestion(message, await loadFinance(store, ownerId));
    const request = detectActionRequest(message);
    if (request) {
      const actionProposal = await actions.propose(ownerId, request);
      return res.json({
        ...result,
        answer: "I drafted that as a proposal. Please review the exact details under Actions and confirm it there.",
        actionProposal,
        synthetic: true,
        requestId: req.id,
      });
    }
    res.json({ ...result, synthetic: true, requestId: req.id });
  });

  router.post("/tools/:name", async (req, res) => {
    res.json(await executeTool(req.params.name, req.body?.args, { user: res.locals.user, store, actions }));
  });

  router.post("/voice/session", async (_req, res) => {
    res.json(await createVoiceSession({ config, user: res.locals.user, fetch, log }));
  });

  return router;
}
