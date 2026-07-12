import "server-only";
import { streamText, stepCountIs, type ModelMessage } from "ai";
import { getModel } from "./provider";
import { SYSTEM_PROMPT, filesContext } from "./prompt";
import { createFileTools, FileStore } from "./tools";
import { AgentEvent } from "./protocol";

export type ChatTurn = { role: "user" | "assistant"; content: string };
export type ProjectFile = { path: string; content: string };

// Cap the agentic loop so a misbehaving model can't spin forever. Each tool
// call + the model's follow-up counts as steps; ~24 comfortably covers a
// multi-file app plus a few edits.
const MAX_STEPS = 24;
const MAX_OUTPUT_TOKENS = 16_000;

/**
 * Run one turn of the app-building agent using the AI SDK's tool-calling loop.
 * The model calls file tools (list/read/write/edit) against an in-memory copy
 * of the project seeded from Convex; we stream its prose and tool activity as
 * events, and emit a final `done` event with the buffered writes + deletes to
 * persist once the turn completes.
 */
export async function* runAgent(opts: {
  history: ChatTurn[];
  files: ProjectFile[];
}): AsyncGenerator<AgentEvent> {
  const store = new FileStore(opts.files);
  const tools = createFileTools(store);

  const system = `${SYSTEM_PROMPT}\n\n# Project state\n${filesContext(opts.files)}`;

  // Providers expect a non-empty, user-first history. Build each message with
  // a literal role so it's a proper ModelMessage (no cast needed).
  const messages: ModelMessage[] = opts.history
    .filter((m) => m.content.trim().length > 0)
    .map((m) =>
      m.role === "user"
        ? { role: "user" as const, content: m.content }
        : { role: "assistant" as const, content: m.content },
    );

  if (messages.length === 0 || messages[0].role !== "user") {
    yield { type: "error", message: "Conversation must start with a user message." };
    return;
  }

  try {
    const result = streamText({
      model: getModel(),
      system,
      messages,
      tools,
      stopWhen: stepCountIs(MAX_STEPS),
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    });

    for await (const part of result.fullStream) {
      switch (part.type) {
        case "text-delta":
          if (part.text) yield { type: "text", delta: part.text };
          break;

        case "tool-call": {
          const path = (part.input as { path?: string } | undefined)?.path;
          yield { type: "tool-call", tool: part.toolName, path };
          break;
        }

        case "tool-result": {
          const out = part.output as
            | { action?: string; path?: string }
            | undefined;
          if (out?.action === "write" && out.path) {
            yield { type: "file-write", path: out.path };
          } else if (out?.action === "delete" && out.path) {
            yield { type: "file-delete", path: out.path };
          }
          break;
        }

        case "error":
          yield {
            type: "error",
            message:
              part.error instanceof Error
                ? part.error.message
                : String(part.error),
          };
          break;

        // start / start-step / finish / reasoning / tool-input-* etc. — ignore.
        default:
          break;
      }
    }
  } catch (err) {
    yield {
      type: "error",
      message: err instanceof Error ? err.message : "AI request failed.",
    };
    return;
  }

  const { writes, deletes } = store.finalize();
  yield { type: "done", writes, deletes };
}
