import { ChatTurn } from "./types";
import { describeCommandsForPrompt } from "./commands";

const PROVIDER = (process.env.LLM_PROVIDER || "openai").toLowerCase();
const API_KEY = process.env.LLM_API_KEY || "";
const MODEL = process.env.LLM_MODEL || (PROVIDER === "anthropic" ? "claude-sonnet-4-6" : "gpt-4o-mini");
const API_URL =
  process.env.LLM_API_URL || (PROVIDER === "anthropic" ? "https://api.anthropic.com/v1/messages" : "https://api.openai.com/v1/chat/completions");
const REQUEST_TIMEOUT_MS = 12000;

export function isLlmConfigured(): boolean {
  return API_KEY.length > 0;
}

export function llmSummary() {
  return { provider: PROVIDER, model: MODEL, configured: isLlmConfigured() };
}

function systemPrompt(): string {
  return [
    "You are Vision, a small talking robot with a 3D body that a person can see and hear.",
    "Reply the way you'd actually speak out loud: short, warm, conversational — a sentence or two, not a lecture.",
    "You may make your body move by embedding tags anywhere in your reply, on their own or mixed into a sentence:",
    `  [[CMD:NAME]] or [[CMD:NAME arg]] — NAME must be one of: ${describeCommandsForPrompt()}.`,
    "  [[WAIT:milliseconds]] — a pause between actions (max 5000).",
    "Examples: [[CMD:DANCE 2500]], [[CMD:TURN_LEFT 600]], [[CMD:EYE_SET 40]], [[CMD:AUDIO_SPEAK \"Hi!\"]].",
    "Only use a movement tag when it actually fits what you're saying (e.g. someone asks you to dance, look somewhere, walk, or you want to react physically) — most replies need none at all.",
    "Tags are invisible to the person; they never appear in what gets spoken, so don't describe them in words too.",
    "Never invent a command name that isn't in the list above.",
  ].join("\n");
}

interface LlmResult {
  ok: boolean;
  text: string;
}

async function callOpenAiCompatible(message: string, history: ChatTurn[]): Promise<LlmResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt() },
          ...history.map((h) => ({ role: h.role, content: h.content })),
          { role: "user", content: message },
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const msg = `LLM endpoint returned ${res.status}: ${body.slice(0, 200)}`;
      console.error("[LLM]", msg);
      return { ok: false, text: msg };
    }
    const data: any = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? "";
    return { ok: true, text };
  } catch (err: any) {
    const msg = err?.name === "AbortError" ? "LLM request timed out." : `LLM request failed: ${err?.message || err}`;
    console.error("[LLM]", msg);
    return { ok: false, text: msg };
  } finally {
    clearTimeout(timer);
  }
}

async function callAnthropic(message: string, history: ChatTurn[]): Promise<LlmResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        system: systemPrompt(),
        messages: [...history.map((h) => ({ role: h.role, content: h.content })), { role: "user", content: message }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const msg = `LLM endpoint returned ${res.status}: ${body.slice(0, 200)}`;
      console.error("[LLM]", msg);
      return { ok: false, text: msg };
    }
    const data: any = await res.json();
    const text = (data?.content || []).map((b: any) => (b.type === "text" ? b.text : "")).join("");
    return { ok: true, text };
  } catch (err: any) {
    const msg = err?.name === "AbortError" ? "LLM request timed out." : `LLM request failed: ${err?.message || err}`;
    console.error("[LLM]", msg);
    return { ok: false, text: msg };
  } finally {
    clearTimeout(timer);
  }
}

export async function askLlm(message: string, history: ChatTurn[]): Promise<LlmResult> {
  if (!isLlmConfigured()) {
    return {
      ok: false,
      text: "I don't have a brain plugged in yet — set LLM_API_KEY in the server's .env file so I can actually think.",
    };
  }
  return PROVIDER === "anthropic" ? callAnthropic(message, history) : callOpenAiCompatible(message, history);
}
