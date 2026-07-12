import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The whole app is three tables. Convex is the source of truth; the E2B
// sandbox is just a live mirror of `files` that we can run Expo against.
export default defineSchema({
  projects: defineTable({
    name: v.string(),
    // Freeform one-line summary of what the app is, updated by the AI.
    description: v.optional(v.string()),
    createdAt: v.number(),
    // E2B sandbox lifecycle. `sandboxId` lets us reconnect to a running box.
    sandboxId: v.optional(v.string()),
    sandboxStatus: v.union(
      v.literal("none"),
      v.literal("starting"),
      v.literal("running"),
      v.literal("stopped"),
      v.literal("error"),
    ),
    // Public URL of the Expo web preview served from the sandbox.
    previewUrl: v.optional(v.string()),
    // exp://…exp.direct tunnel URL for opening the app in Expo Go on a phone.
    deviceUrl: v.optional(v.string()),
  }),

  messages: defineTable({
    projectId: v.id("projects"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
    ),
    content: v.string(),
    // Ordered, structured parts of an assistant message so the UI can render
    // prose interleaved with tool-call chips in the exact order they happened
    // (text → tool → text → tool …). Absent on old messages; `content` is the
    // plain-text fallback.
    parts: v.optional(
      v.array(
        v.union(
          v.object({ type: v.literal("text"), text: v.string() }),
          v.object({
            type: v.literal("tool"),
            tool: v.string(),
            path: v.optional(v.string()),
          }),
        ),
      ),
    ),
    createdAt: v.number(),
    // While the assistant is still streaming we flip this off when done.
    streaming: v.optional(v.boolean()),
  }).index("by_project", ["projectId", "createdAt"]),

  files: defineTable({
    projectId: v.id("projects"),
    // Path relative to the Expo project root, e.g. "App.js" or "app/index.tsx".
    path: v.string(),
    content: v.string(),
    updatedAt: v.number(),
  }).index("by_project", ["projectId", "path"]),
});
