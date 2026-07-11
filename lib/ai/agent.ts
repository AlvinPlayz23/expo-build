import "server-only";
import { streamCompletion } from "./provider";
import { SYSTEM_PROMPT, filesContext } from "./prompt";
import { StreamParser } from "./parser";
import { AgentEvent } from "./protocol";

export type ChatTurn = { role: "user" | "assistant"; content: string };
export type ProjectFile = { path: string; content: string };

/**
 * Run one turn of the app-building agent. Yields a live stream of events:
 * prose deltas, file open/close, and deletes. Current files are injected into
 * the system prompt each turn so the model edits against real state.
 */
export async function* runAgent(opts: {
  history: ChatTurn[];
  files: ProjectFile[];
}): AsyncGenerator<AgentEvent> {
  const parser = new StreamParser();

  const system = `${SYSTEM_PROMPT}\n\n# Project state\n${filesContext(opts.files)}`;

  // Providers expect a non-empty, user-first history.
  const messages = opts.history
    .filter((m) => m.content.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content }));

  if (messages.length === 0 || messages[0].role !== "user") {
    yield { type: "error", message: "Conversation must start with a user message." };
    return;
  }

  try {
    for await (const text of streamCompletion({ system, messages })) {
      for (const ev of parser.feed(text)) yield ev;
    }
    for (const ev of parser.end()) yield ev;
  } catch (err) {
    yield {
      type: "error",
      message: err instanceof Error ? err.message : "AI request failed.",
    };
  }
}
