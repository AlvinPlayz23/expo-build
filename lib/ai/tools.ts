import "server-only";
import { tool } from "ai";
import { z } from "zod";

/**
 * An in-memory working copy of the project's files for a single agent turn.
 * Seeded from Convex (the source of truth), mutated by the tools, then
 * `finalize()`d into the set of writes + deletes to persist once at the end.
 *
 * Buffering in memory (rather than hitting Convex/the sandbox per tool call)
 * keeps a turn fast and means the sandbox is synced exactly once.
 */
export class FileStore {
  private files = new Map<string, string>();
  private touched = new Set<string>(); // paths created/overwritten this turn
  private removed = new Set<string>(); // paths deleted this turn

  constructor(initial: { path: string; content: string }[]) {
    for (const f of initial) this.files.set(f.path, f.content);
  }

  list(): string[] {
    return [...this.files.keys()].sort();
  }

  read(path: string): string | null {
    return this.files.has(path) ? this.files.get(path)! : null;
  }

  write(path: string, content: string): void {
    this.files.set(path, content);
    this.touched.add(path);
    this.removed.delete(path);
  }

  delete(path: string): void {
    this.files.delete(path);
    this.touched.delete(path);
    this.removed.add(path);
  }

  /** The net changes to persist: final content of touched files + deletions. */
  finalize(): {
    writes: { path: string; content: string }[];
    deletes: string[];
  } {
    const writes = [...this.touched].map((p) => ({
      path: p,
      content: this.files.get(p)!,
    }));
    const deletes = [...this.removed];
    return { writes, deletes };
  }
}

// The structured result every tool returns. `action` drives the agent's
// file-write / file-delete events; the whole object is also shown to the model.
type ToolResult = {
  action: "list" | "read" | "write" | "delete" | "noop" | "error";
  path?: string;
  message?: string;
  [k: string]: unknown;
};

function lineCount(s: string): number {
  return s.length === 0 ? 0 : s.split("\n").length;
}

/**
 * The file tools the model can call. All operate on the shared `FileStore`.
 * `write` and `edit` can both create files; emptying a file (via `write` with
 * blank content, or `edit`ing all of its text away) deletes it.
 */
export function createFileTools(store: FileStore) {
  return {
    list: tool({
      description:
        "List every file path currently in the project. Call this to see what exists before reading or editing.",
      inputSchema: z.object({}),
      execute: async (): Promise<ToolResult> => {
        const files = store.list();
        return { action: "list", files, count: files.length };
      },
    }),

    read: tool({
      description:
        "Read the full current contents of a file. Always read a file before editing it so your oldString matches exactly.",
      inputSchema: z.object({
        path: z
          .string()
          .describe("File path relative to the project root, e.g. App.js"),
      }),
      execute: async ({ path }): Promise<ToolResult> => {
        const content = store.read(path);
        if (content === null) {
          return {
            action: "read",
            path,
            exists: false,
            content: "",
            message: `${path} does not exist yet.`,
          };
        }
        return { action: "read", path, exists: true, content };
      },
    }),

    write: tool({
      description:
        "Create a new file or completely overwrite an existing one with the given contents. Always pass the COMPLETE file. Writing empty/blank content deletes the file.",
      inputSchema: z.object({
        path: z
          .string()
          .describe(
            "File path relative to the project root, e.g. App.js or components/Foo.js",
          ),
        content: z.string().describe("The COMPLETE contents of the file."),
      }),
      execute: async ({ path, content }): Promise<ToolResult> => {
        if (content.trim().length === 0) {
          // Blank content deletes an existing file; for a file that never
          // existed there's nothing to delete (avoid a spurious delete op).
          if (store.read(path) === null) {
            return {
              action: "noop",
              path,
              message: `Nothing to write/delete for ${path}.`,
            };
          }
          store.delete(path);
          return {
            action: "delete",
            path,
            message: `Deleted ${path} (empty content).`,
          };
        }
        store.write(path, content);
        return {
          action: "write",
          path,
          message: `Wrote ${path} (${lineCount(content)} lines).`,
        };
      },
    }),

    edit: tool({
      description:
        "Edit a file by replacing an exact substring with new text (replaces the first occurrence). " +
        "Pass an empty oldString to create a new file (or prepend to an existing one). " +
        "To DELETE a file, replace all of its content with an empty newString so nothing is left.",
      inputSchema: z.object({
        path: z.string().describe("File path relative to the project root."),
        oldString: z
          .string()
          .describe(
            "Exact text to find. Empty string creates a new file (or prepends to an existing one).",
          ),
        newString: z
          .string()
          .describe(
            "Replacement text. Empty removes the matched text; emptying the whole file deletes it.",
          ),
      }),
      execute: async ({ path, oldString, newString }): Promise<ToolResult> => {
        const current = store.read(path);

        // File does not exist yet.
        if (current === null) {
          if (oldString.length !== 0) {
            return {
              action: "error",
              path,
              message: `Cannot edit ${path}: it does not exist. Use write to create it, or pass an empty oldString.`,
            };
          }
          if (newString.trim().length === 0) {
            return {
              action: "noop",
              path,
              message: `Nothing to create for ${path}.`,
            };
          }
          store.write(path, newString);
          return { action: "write", path, message: `Created ${path}.` };
        }

        // Existing file.
        let next: string;
        if (oldString.length === 0) {
          next = newString + current; // prepend
        } else {
          if (!current.includes(oldString)) {
            return {
              action: "error",
              path,
              message: `oldString not found in ${path}. Read the file and copy the exact text (including whitespace).`,
            };
          }
          // Function replacement avoids `$&`-style special patterns in code.
          next = current.replace(oldString, () => newString);
        }

        if (next.trim().length === 0) {
          store.delete(path);
          return {
            action: "delete",
            path,
            message: `Deleted ${path} (edited to empty).`,
          };
        }
        store.write(path, next);
        return { action: "write", path, message: `Edited ${path}.` };
      },
    }),
  };
}
