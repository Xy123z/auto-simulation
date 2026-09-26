import { ChatResponseBody, ChatTurn } from "./types";
import { matchDirectCommand, extractCommands } from "./commands";
import { askLlm } from "./llm";

const MAX_MESSAGE_LEN = 500;
const MAX_HISTORY_TURNS = 8;

export async function handleChat(rawMessage: string, rawHistory: ChatTurn[] | undefined): Promise<ChatResponseBody> {
  const message = (rawMessage || "").trim().slice(0, MAX_MESSAGE_LEN);
  const history = Array.isArray(rawHistory) ? rawHistory.slice(-MAX_HISTORY_TURNS) : [];

  if (!message) {
    return { reply: "I didn't catch that — try again?", instructions: [], source: "fallback" };
  }

  // 1. Instant, no-LLM fast path for wake-word imperatives ("Vision, dance").
  const direct = matchDirectCommand(message);
  if (direct) {
    return { reply: direct.reply, instructions: direct.instructions, source: "direct" };
  }

  // 2. Otherwise, hand it to the configured LLM and pull any command tags
  //    it chose to embed out of the reply, validating each one.
  console.log(`[chat] LLM request: "${message.slice(0, 80)}${message.length > 80 ? "…" : ""}"`);
  const result = await askLlm(message, history);
  if (!result.ok) {
    console.error(`[chat] LLM failed → ${result.text}`);
    return { reply: result.text, instructions: [], source: "fallback" };
  }

  const { text, instructions } = extractCommands(result.text);
  console.log(`[chat] LLM ok (${instructions.length} cmd(s)): "${text.slice(0, 80)}${text.length > 80 ? "…" : ""}"`);
  return { reply: text || "…", instructions, source: "llm" };
}
