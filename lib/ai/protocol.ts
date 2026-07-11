// The wire protocol between the AI agent and the rest of the app.
//
// The model is instructed to emit prose interleaved with file blocks:
//
//   Here's a counter app.
//   <expoFile path="App.js">
//   ...code...
//   </expoFile>
//   <expoDelete path="components/Old.js" />
//
// The streaming parser turns that raw text into these discrete events.

export type AgentEvent =
  | { type: "text"; delta: string } // assistant prose, streamed
  | { type: "file-open"; path: string } // started writing a file
  | { type: "file-close"; path: string; content: string } // file complete
  | { type: "delete"; path: string } // file should be removed
  | { type: "error"; message: string };

export type FileOp =
  | { kind: "write"; path: string; content: string }
  | { kind: "delete"; path: string };

// Tag names kept unlikely-to-collide with real RN/JSX content.
export const FILE_OPEN = /<expoFile\s+path="([^"]+)"\s*>/;
export const FILE_CLOSE = "</expoFile>";
export const DELETE_TAG = /<expoDelete\s+path="([^"]+)"\s*\/>/;
