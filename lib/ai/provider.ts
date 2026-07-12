import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { log } from "../log";

// Single place that knows which provider/model generates the apps. The agent
// only sees `getModel()` and hands it to the AI SDK's `streamText`, so swapping
// providers is just an env flag.

const PROVIDER = (process.env.LLM_PROVIDER || "anthropic").toLowerCase();

// Per-provider model defaults; AI_MODEL overrides either one.
function modelId(): string {
  if (process.env.AI_MODEL) return process.env.AI_MODEL;
  return PROVIDER === "openai" ? "gpt-4o" : "claude-sonnet-5";
}

/**
 * Build the AI SDK language model for the configured provider. Anthropic and
 * OpenAI-compatible endpoints are both supported; set OPENAI_BASEURL to point
 * the OpenAI path at any compatible server (Azure, OpenRouter, a local model…).
 */
export function getModel(): LanguageModel {
  const id = modelId();
  log("ai", `provider=${PROVIDER} model=${id} — building AI SDK model`);

  if (PROVIDER === "openai") {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        "OPENAI_API_KEY is not set. Add it to .env.local (see .env.example).",
      );
    }
    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      // Unset → SDK default (https://api.openai.com/v1).
      baseURL: process.env.OPENAI_BASEURL || undefined,
    });
    // Force the chat-completions API so any OpenAI-compatible endpoint works
    // (the default Responses API isn't supported by most third-party servers).
    return openai.chat(id);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local (see .env.example).",
    );
  }
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropic(id);
}

export const providerName = PROVIDER;
