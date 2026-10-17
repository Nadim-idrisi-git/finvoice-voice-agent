import { outputText } from "./openai.js";
import { executeTool, toolDefinitions } from "./tools.js";
import { textInstructions } from "./prompts.js";

const MAX_TOOL_ROUNDS = 4;

/**
 * Text agent: OpenAI Responses API with tool calling. The model decides which tools to call;
 * the server runs them against the user's own records and feeds results back until the model answers.
 * Returns { answer, actionProposals, toolsUsed }.
 */
export async function runAgent({ message, ctx, openai, model }) {
  const base = { model, instructions: textInstructions(ctx.user), tools: toolDefinitions };
  let response = await openai.createResponse({ ...base, input: [{ role: "user", content: message }] });
  const actionProposals = [];
  const toolsUsed = [];

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
        output = result;
      } catch (error) {
        output = { error: error instanceof Error ? error.message : "Tool failed." };
      }
      outputs.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(output) });
    }
    response = await openai.createResponse({ ...base, previous_response_id: response.id, input: outputs });
  }

  return {
    answer: outputText(response) || "I could not put together an answer. Please try rephrasing.",
    actionProposals,
    toolsUsed,
  };
}
