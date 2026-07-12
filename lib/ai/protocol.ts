// The event protocol between the AI agent and the rest of the app.
//
// The model no longer emits a text protocol. Instead it calls tools
// (list / read / write / edit) that mutate an in-memory working copy of the
// project files. The agent surfaces its activity as these discrete events:
//
//   - text        : assistant prose, streamed token-by-token
//   - tool-call    : the model invoked a tool (for logging / progress)
//   - file-write   : a file was created or overwritten this turn
//   - file-delete  : a file was removed this turn
//   - done         : the turn finished; carries the finalized writes + deletes
//   - error        : something went wrong

export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool-call"; tool: string; path?: string }
  | { type: "file-write"; path: string }
  | { type: "file-delete"; path: string }
  | {
      type: "done";
      writes: { path: string; content: string }[];
      deletes: string[];
    }
  | { type: "error"; message: string };

export type FileOp =
  | { kind: "write"; path: string; content: string }
  | { kind: "delete"; path: string };
