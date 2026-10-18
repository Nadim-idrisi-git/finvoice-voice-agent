import { modelContent, outputText } from "./gemini.js";
import { executeTool, toolDefinitions } from "./tools.js";
import { textInstructions } from "./prompts.js";
import { ABSTAIN_MESSAGE, validateAnswer } from "./validator.js";

const MAX_TOOL_ROUNDS = 4;
// Conversation memory kept per user (Gemini is stateless); older turns are dropped at a user-turn boundary.
const MAX_HISTORY = 40;

/** Drops the oldest turns so history stays bounded and still starts with a plain user message. */
function trimHistory(contents) {
  if (contents.length <= MAX_HISTORY) return contents;
  const tail = contents.slice(-MAX_HISTORY);
  const start = tail.findIndex((c) => c.role === "user" && c.parts?.some((p) => typeof p.text === "string"));
  return start === -1 ? [] : tail.slice(start);
}

/**
 * Text agent: Gemini generateContent with function calling, followed by deterministic answer validation.
 * The model decides which tools to call; the server runs them for the authenticated user and feeds
 * results back. Before returning, every money amount and success claim is checked against this turn's
 * tool results. One corrective retry is allowed; otherwise the agent abstains.
 * Returns { answer, actionProposals, toolsUsed, validation, history }.
 */
export async function runAgent({ message, ctx, gemini, model, thinkingLevel, history = [], evidenceCarryover = [], log }) {
  const base = {
    systemInstruction: { parts: [{ text: textInstructions(ctx.user) }] },
    tools: [{ functionDeclarations: toolDefinitions }],
    ...(thinkingLevel ? { generationConfig: { thinkingConfig: { thinkingLevel } } } : {}),
  };
  const actionProposals = [];
  const toolsUsed = [];
  // Evidence from the previous turn lets follow-ups ("and how much was that?") cite earlier tool results.
  const toolResults = [...evidenceCarryover];
  // Prior turns keep the conversation's context (e.g. "yes, do it").
  const contents = [...history];

  async function respond(userTurn) {
    contents.push(userTurn);
    let content = modelContent(await gemini.generateContent(model, { ...base, contents }));
    for (let round = 0; ; round++) {
      // Model turns go back verbatim: Gemini 3 requires their thought signatures on the next request.
      contents.push(content);
      const calls = (content.parts ?? []).filter((part) => part.functionCall).map((part) => part.functionCall);
      if (!calls.length) break;
      if (round >= MAX_TOOL_ROUNDS) {
        contents.pop(); // unanswered calls would make the next request invalid
        break;
      }
      const parts = [];
      for (const call of calls) {
        toolsUsed.push(call.name);
        let output;
        try {
          const { result, proposesAction } = await executeTool(call.name, call.args ?? {}, ctx);
          if (proposesAction) actionProposals.push(result);
          toolResults.push(result);
          output = { result };
        } catch (error) {
          output = { error: error instanceof Error ? error.message : "Tool failed." };
        }
        parts.push({ functionResponse: { ...(call.id ? { id: call.id } : {}), name: call.name, response: output } });
      }
      contents.push({ role: "user", parts });
      content = modelContent(await gemini.generateContent(model, { ...base, contents }));
    }
    return content;
  }

  let content = await respond({ role: "user", parts: [{ text: message }] });

  const check = async (answer) =>
    validateAnswer({
      answer,
      toolResults,
      userMessage: message,
      hasSucceededAction: (await ctx.actions.list(ctx.user.id)).some((a) => a.status === "SUCCEEDED"),
      hasProposedAction: (await ctx.actions.list(ctx.user.id)).some((a) => a.status === "AWAITING_CONFIRMATION"),
      toolsCalled: toolsUsed.length,
    });

  let answer = outputText(content);
  let result = await check(answer);
  let status = "passed";
  if (!result.ok) {
    log?.warn({ unsupported: result.unsupportedAmounts.map((a) => a.text), success: result.unsupportedSuccess }, "Answer failed validation; retrying");
    const problems = [
      result.unsupportedAmounts.length &&
        `these amounts do not appear in any tool result: ${result.unsupportedAmounts.map((a) => a.text).join(", ")}`,
      result.unsupportedSuccess && "you said something was done, but no action has been confirmed",
      result.uncheckedNotFound && "you said something was not found without calling any tool to check; call the relevant tool first",
    ].filter(Boolean);
    content = await respond({
      role: "user",
      parts: [
        {
          text: `[System check, not from the user] Validation failed: ${problems.join("; ")}. Rewrite the answer using only values from tool results (call a tool if needed), or say you cannot verify it. Do not apologise at length.`,
        },
      ],
    });
    answer = outputText(content);
    result = await check(answer);
    status = result.ok ? "corrected" : "abstained";
    if (!result.ok) answer = ABSTAIN_MESSAGE;
  }

  return {
    history: trimHistory(contents),
    answer: answer || ABSTAIN_MESSAGE,
    actionProposals,
    toolsUsed,
    toolResults,
    validation: {
      status,
      unsupportedAmounts: result.unsupportedAmounts.map((a) => a.text),
      unsupportedSuccess: result.unsupportedSuccess,
      uncheckedNotFound: result.uncheckedNotFound,
    },
  };
}
