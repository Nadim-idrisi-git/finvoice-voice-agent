import { validateMessage } from "../lib/validate.js";
import { answerFinancialQuestion, detectActionRequest } from "../modules/rules.js";
import { HttpError } from "../http.js";
import { loadFinance } from "../store/finance.js";
import { runAgent } from "../services/agent.js";
import { executeTool } from "../services/tools.js";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import express from "express";

/**
 * Text and voice chat (OpenAI agent with rule-based fallback, validated before it is shown or spoken),
 * tool execution, and ElevenLabs voice: speech-to-text in, streaming text-to-speech out.
 */
export function assistantRoutes({ store, actions, config, openai, voice, log }) {
  const router = express.Router();
  // Last OpenAI response per user, for short-term conversation memory in text chat.
  const lastResponse = new Map();
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
    const channel = req.body?.channel === "voice" ? "voice" : "text";
    const user = res.locals.user;
    let reply;
    let source = "rules";
    if (openai.configured) {
      try {
        reply = await runAgent({
          message: value.message,
          ctx: { user, store, actions, userMessage: value.message },
          openai,
          model: config.OPENAI_MODEL,
          channel,
          previousResponseId: lastResponse.get(user.id),
          evidenceCarryover: lastEvidence.get(user.id) ?? [],
          log,
        });
        lastResponse.set(user.id, reply.responseId);
        lastEvidence.set(user.id, reply.toolResults);
        source = "openai";
      } catch (err) {
        log.warn({ requestId: req.id, error: err instanceof Error ? err.message : "unknown" }, "Agent failed; using rules");
      }
    }
    reply ??= await answerWithRules(value.message, user.id);
    const { responseId: _id, toolResults: _evidence, ...publicReply } = reply;
    let speechId = null;
    if (channel === "voice" && voice.configured) {
      speechId = crypto.randomUUID();
      speech.set(speechId, { ownerId: user.id, text: reply.answer });
      if (speech.size > 500) speech.delete(speech.keys().next().value);
    }
    res.json({
      ...publicReply,
      speechId,
      actionProposal: reply.actionProposals[0] ?? null,
      source,
      synthetic: true,
      requestId: req.id,
    });
  });

  // Voice tool calls are idempotent per OpenAI call_id: a retried or duplicated call returns the
  // first result instead of running the tool (and creating an action) twice.
  const toolCallResults = new Map();
  // Validated answers waiting to be spoken. The speech endpoint only voices text this server produced.
  const speech = new Map();
  router.post("/tools/:name", async (req, res) => {
    const callId = typeof req.body?.callId === "string" ? req.body.callId.slice(0, 100) : null;
    const key = callId && `${res.locals.user.id}:${callId}`;
    if (key && toolCallResults.has(key)) return res.json({ ...toolCallResults.get(key), replayed: true });
    const result = await executeTool(req.params.name, req.body?.args, { user: res.locals.user, store, actions });
    if (key) {
      toolCallResults.set(key, result);
      if (toolCallResults.size > 5000) toolCallResults.delete(toolCallResults.keys().next().value);
    }
    res.json(result);
  });

  router.get("/voice/status", (_req, res) => res.json({ configured: voice.configured && openai.configured, provider: "elevenlabs" }));

  // Browser uploads one utterance (webm/ogg/wav); ElevenLabs Scribe detects Hindi or English.
  router.post(
    "/voice/transcribe",
    express.raw({ type: ["audio/*", "video/webm", "application/octet-stream"], limit: "5mb" }),
    async (req, res) => {
      if (!voice.configured) throw new HttpError(503, "Voice is not configured. Add ELEVENLABS_API_KEY on the backend.");
      if (!Buffer.isBuffer(req.body) || req.body.length < 1000) throw new HttpError(400, "No audio received.");
      const mimeType = String(req.get("content-type") ?? "audio/webm").split(";")[0];
      res.json(await voice.transcribe(req.body, mimeType));
    },
  );

  // Streams ElevenLabs audio for a validated answer. Only ids issued above, only to their owner.
  router.get("/voice/speech/:id", async (req, res) => {
    const item = speech.get(req.params.id);
    if (!item || item.ownerId !== res.locals.user.id) throw new HttpError(404, "Speech not found.");
    const upstream = await voice.speak(item.text);
    res.set({ "Content-Type": "audio/mpeg", "Cache-Control": "no-store" });
    Readable.fromWeb(upstream.body).pipe(res);
  });

  return router;
}
