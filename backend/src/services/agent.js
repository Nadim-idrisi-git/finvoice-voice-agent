import { outputText } from "./openai.js";
import { executeTool, toolDefinitions } from "./tools.js";
import { textInstructions } from "./prompts.js";
import { ABSTAIN_MESSAGE, validateAnswer } from "./validator.js";

const MAX_TOOL_ROUNDS = 4;

/**
 * Text agent: OpenAI Responses API with tool calling, followed by deterministic answer validation.
 * The model decides which tools to call; the server runs them for the authenticated user and feeds
 * results back. Before returning, every money amount and success claim is checked against this turn's
 * tool results. One corrective retry is allowed; otherwise the agent abstains.
 * Returns { answer, actionProposals, toolsUsed, validation, responseId }.
 */
export async function runAgent({ message, ctx, openai, model, previousResponseId, evidenceCarryover = [], log }) {
  const base = { model, instructions: textInstructions(ctx.user), tools: toolDefinitions };
  const actionProposals = [];
  const toolsUsed = [];
  // Evidence from the previous turn lets follow-ups ("and how much was that?") cite earlier tool results.
  const toolResults = [...evidenceCarryover];

  async function respond(request) {
    let response = await openai.createResponse(request);
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const calls = (response.output ?? []).filter((item) => item.type === "function_call");
      if (!calls.length) break;
      const outputs = [];
      for (const call of calls) {
        toolsUsed.push(call.name);
        let output;
        try {
          const { result, proposesAction } = await executeTool(call.name, JSON.parse(call.arguments || "{}"), ctx);
          if (proposesAction) actionProposals.push(result);
          toolResults.push(result);
          output = result;
        } catch (error) {
          output = { error: error instanceof Error ? error.message : "Tool failed." };
        }
        outputs.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(output) });
      }
      response = await openai.createResponse({ ...base, previous_response_id: response.id, input: outputs });
    }
    return response;
  }

  // Chaining on the previous response keeps the conversation's context (e.g. "yes, do it").
  let response = await respond({
    ...base,
    ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
    input: [{ role: "user", content: message }],
  });

  const check = async (answer) =>
    validateAnswer({
      answer,
      toolResults,
      userMessage: message,
      hasSucceededAction: (await ctx.actions.list(ctx.user.id)).some((a) => a.status === "SUCCEEDED"),
    });

  let answer = outputText(response);
  let result = await check(answer);
  let status = "passed";
  if (!result.ok) {
    log?.warn({ unsupported: result.unsupportedAmounts.map((a) => a.text), success: result.unsupportedSuccess }, "Answer failed validation; retrying");
    const problems = [
      result.unsupportedAmounts.length &&
        `these amounts do not appear in any tool result: ${result.unsupportedAmounts.map((a) => a.text).join(", ")}`,
      result.unsupportedSuccess && "you said something was done, but no action has been confirmed",
    ].filter(Boolean);
    response = await respond({
      ...base,
      previous_response_id: response.id,
      input: [
        {
          role: "developer",
          content: `Validation failed: ${problems.join("; ")}. Rewrite the answer using only values from tool results (call a tool if needed), or say you cannot verify it. Do not apologise at length.`,
        },
      ],
    });
    answer = outputText(response);
    result = await check(answer);
    status = result.ok ? "corrected" : "abstained";
    if (!result.ok) answer = ABSTAIN_MESSAGE;
  }

  return {
    responseId: response.id,
    answer: answer || ABSTAIN_MESSAGE,
    actionProposals,
    toolsUsed,
    toolResults,
    validation: { status, unsupportedAmounts: result.unsupportedAmounts.map((a) => a.text), unsupportedSuccess: result.unsupportedSuccess },
  };
}
