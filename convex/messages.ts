import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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

// Used to push streamed tokens into an in-flight assistant message so the UI
// updates live through Convex reactivity.
export const update = mutation({
  args: {
    id: v.id("messages"),
    content: v.string(),
    streaming: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, content, streaming }) => {
    await ctx.db.patch(id, { content, streaming });
  },
});
