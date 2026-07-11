import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("projects").order("desc").collect();
  },
});

export const get = query({
  args: { id: v.id("projects") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const create = mutation({
  args: { name: v.string(), description: v.optional(v.string()) },
  handler: async (ctx, { name, description }) => {
    return await ctx.db.insert("projects", {
      name,
      description,
      createdAt: Date.now(),
      sandboxStatus: "none",
    });
  },
});

// Called by the server as the E2B sandbox moves through its lifecycle.
export const setSandbox = mutation({
  args: {
    id: v.id("projects"),
    sandboxId: v.optional(v.string()),
    sandboxStatus: v.union(
      v.literal("none"),
      v.literal("starting"),
      v.literal("running"),
      v.literal("stopped"),
      v.literal("error"),
    ),
    previewUrl: v.optional(v.string()),
    deviceUrl: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...patch }) => {
    await ctx.db.patch(id, patch);
  },
});

export const setDescription = mutation({
  args: { id: v.id("projects"), description: v.string() },
  handler: async (ctx, { id, description }) => {
    await ctx.db.patch(id, { description });
  },
});

export const remove = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, { id }) => {
    for (const m of await ctx.db
      .query("messages")
      .withIndex("by_project", (q) => q.eq("projectId", id))
      .collect()) {
      await ctx.db.delete(m._id);
    }
    for (const f of await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", id))
      .collect()) {
      await ctx.db.delete(f._id);
    }
    await ctx.db.delete(id);
  },
});
