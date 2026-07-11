import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
  },
});

const fileValidator = v.object({
  path: v.string(),
  content: v.string(),
});

// Insert-or-replace a batch of files by path. This is how the AI's generated
// output lands in the source of truth.
export const upsertMany = mutation({
  args: {
    projectId: v.id("projects"),
    files: v.array(fileValidator),
  },
  handler: async (ctx, { projectId, files }) => {
    for (const file of files) {
      const existing = await ctx.db
        .query("files")
        .withIndex("by_project", (q) =>
          q.eq("projectId", projectId).eq("path", file.path),
        )
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          content: file.content,
          updatedAt: Date.now(),
        });
      } else {
        await ctx.db.insert("files", {
          projectId,
          path: file.path,
          content: file.content,
          updatedAt: Date.now(),
        });
      }
    }
  },
});

export const remove = mutation({
  args: { projectId: v.id("projects"), path: v.string() },
  handler: async (ctx, { projectId, path }) => {
    const existing = await ctx.db
      .query("files")
      .withIndex("by_project", (q) =>
        q.eq("projectId", projectId).eq("path", path),
      )
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});
