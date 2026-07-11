import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { log } from "../log";

// Single place that knows which provider/model generates the apps. The agent
// only sees `streamCompletion` and never touches a provider SDK directly, so
// swapping providers is just an env flag.

export type LLMMessage = { role: "user" | "assistant"; content: string };

const PROVIDER = (process.env.LLM_PROVIDER || "anthropic").toLowerCase();
const MAX_TOKENS = 16_000;

// Per-provider model defaults; AI_MODEL overrides either one.
function modelId(): string {
  if (process.env.AI_MODEL) return process.env.AI_MODEL;
  return PROVIDER === "openai" ? "gpt-4o" : "claude-sonnet-5";
}

let anthropic: Anthropic | null = null;
let openai: OpenAI | null = null;

function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local (see .env.example).",
    );
  }
  if (!anthropic) {
    anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 120_000, // fail loudly instead of hanging forever
      maxRetries: 1,
    });
  }
  return anthropic;
}

function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env.local (see .env.example).",
    );
  }
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      // If OPENAI_BASEURL is unset, the SDK falls back to its default
      // (https://api.openai.com/v1). Set it to point at any OpenAI-compatible
      // endpoint (Azure, OpenRouter, a local server, etc.).
      baseURL: process.env.OPENAI_BASEURL || undefined,
      timeout: 120_000, // fail loudly instead of hanging forever
      maxRetries: 1,
    });
  }
  return openai;
}

/**
 * Stream a completion as plain text deltas, hiding provider differences.
 * The agent feeds these deltas straight into the file-op parser.
 */
export async function* streamCompletion(opts: {
  system: string;
  messages: LLMMessage[];
}): AsyncGenerator<string> {
  log("ai", `provider=${PROVIDER} model=${modelId()} — requesting completion`);

  if (PROVIDER === "openai") {
    const client = getOpenAI();
    const stream = await client.chat.completions.create({
      model: modelId(),
      max_tokens: MAX_TOKENS,
      stream: true,
      // OpenAI takes the system prompt as the first message.
      messages: [{ role: "system", content: opts.system }, ...opts.messages],
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
    return;
  }

  // Default: Anthropic.
  const client = getAnthropic();
  const stream = client.messages.stream({
    model: modelId(),
    max_tokens: MAX_TOKENS,
    system: opts.system,
    messages: opts.messages,
  });
  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}

export const providerName = PROVIDER;
