import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// One entry in an assistant message's ordered part list: either streamed prose
// or a tool-call chip. Kept in sync with the shape in schema.ts.
const messagePart = v.union(
  v.object({ type: v.literal("text"), text: v.string() }),
  v.object({
    type: v.literal("tool"),
    tool: v.string(),
    path: v.optional(v.string()),
  }),
);

export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
  },
});

export const add = mutation({
  args: {
    projectId: v.id("projects"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
    ),
    content: v.string(),
    streaming: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

// Used to push streamed tokens (and the ordered parts) into an in-flight
// assistant message so the UI updates live through Convex reactivity.
export const update = mutation({
  args: {
    id: v.id("messages"),
    content: v.string(),
    parts: v.optional(v.array(messagePart)),
    streaming: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, content, parts, streaming }) => {
    const patch: Record<string, unknown> = { content, streaming };
    if (parts !== undefined) patch.parts = parts;
    await ctx.db.patch(id, patch);
  },
});
