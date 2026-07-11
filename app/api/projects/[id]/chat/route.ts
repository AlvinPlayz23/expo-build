import { NextRequest } from "next/server";
import { convexServer, api } from "@/lib/convex/server";
import { runAgent, ChatTurn, ProjectFile } from "@/lib/ai/agent";
import { syncSandbox } from "@/lib/sandbox/manager";
import { log, logErr } from "@/lib/log";

// E2B + AI SDKs need the Node runtime, and sandbox boot can be slow.
export const runtime = "nodejs";
export const maxDuration = 300;

// Flush streamed prose into Convex at most this often (ms) so the UI updates
// live via reactivity without hammering the DB on every token.
const FLUSH_MS = 500;

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/projects/[id]/chat">,
) {
  const t0 = Date.now();
  const { id } = await ctx.params;
  const projectId = id as unknown as string;

  let message: string;
  try {
    const body = await req.json();
    message = String(body.message ?? "").trim();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!message) {
    return Response.json({ error: "Message is required." }, { status: 400 });
  }

  log("chat", `▶ project=${projectId} message="${message.slice(0, 60)}"`);

  let convex;
  try {
    convex = convexServer();
  } catch (err) {
    logErr("chat", "Convex not configured", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Convex not configured." },
      { status: 500 },
    );
  }

  // Persist the user's message, then load conversation + current files.
  await convex.mutation(api.messages.add, {
    projectId,
    role: "user",
    content: message,
  });

  const [rawMessages, rawFiles, project] = await Promise.all([
    convex.query(api.messages.list, { projectId }),
    convex.query(api.files.list, { projectId }),
    convex.query(api.projects.get, { id: projectId }),
  ]);

  const history: ChatTurn[] = (rawMessages as any[])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content }));
  const files: ProjectFile[] = (rawFiles as any[]).map((f) => ({
    path: f.path,
    content: f.content,
  }));
  log("chat", `loaded history=${history.length} msgs, files=${files.length}`);

  // Create the assistant message we'll stream into.
  const assistantId = await convex.mutation(api.messages.add, {
    projectId,
    role: "assistant",
    content: "",
    streaming: true,
  });

  let prose = "";
  let lastFlush = 0;
  let finalized = false;
  const writes: ProjectFile[] = [];
  const deletes: string[] = [];
  const changed: string[] = [];
  let sandboxError: string | undefined;
  let previewUrl: string | undefined;

  const flush = async (force: boolean) => {
    const now = Date.now();
    if (!force && now - lastFlush < FLUSH_MS) return;
    lastFlush = now;
    await convex
      .mutation(api.messages.update, {
        id: assistantId,
        content: prose,
        streaming: true,
      })
      .catch((e) => logErr("chat", "flush failed", e));
  };

  // Guarantee the assistant message is closed out no matter what happens, so
  // the UI never gets stuck on a forever-streaming bubble.
  const finalize = async () => {
    if (finalized) return;
    finalized = true;
    await convex
      .mutation(api.messages.update, {
        id: assistantId,
        content: prose.trim() || "(no changes)",
        streaming: false,
      })
      .catch((e) => logErr("chat", "finalize failed", e));
  };

  try {
    let charCount = 0;
    for await (const ev of runAgent({ history, files })) {
      switch (ev.type) {
        case "text":
          prose += ev.delta;
          charCount += ev.delta.length;
          await flush(false);
          break;
        case "file-open":
          log("chat", `AI writing file: ${ev.path}`);
          prose += `\n\n\`${ev.path}\`…`;
          await flush(true);
          break;
        case "file-close":
          writes.push({ path: ev.path, content: ev.content });
          changed.push(ev.path);
          prose = prose.replace(`\n\n\`${ev.path}\`…`, `\n\n✓ \`${ev.path}\``);
          await flush(true);
          break;
        case "delete":
          deletes.push(ev.path);
          changed.push(ev.path);
          prose += `\n\n🗑️ \`${ev.path}\``;
          await flush(true);
          break;
        case "error":
          logErr("chat", "AI error event", ev.message);
          prose += `\n\n⚠️ ${ev.message}`;
          break;
      }
    }
    log(
      "chat",
      `AI finished: ${charCount} chars, ${writes.length} file(s), ${deletes.length} delete(s)`,
    );

    // Persist generated files to the source of truth (Convex).
    if (writes.length > 0) {
      await convex.mutation(api.files.upsertMany, { projectId, files: writes });
    }
    for (const path of deletes) {
      await convex.mutation(api.files.remove, { projectId, path });
    }

    await finalize();

    // Push changes into the live Expo sandbox (create it if needed).
    const needsSandbox =
      writes.length > 0 || deletes.length > 0 || !(project as any)?.sandboxId;
    if (needsSandbox) {
      try {
        await convex.mutation(api.projects.setSandbox, {
          id: projectId,
          sandboxStatus: "starting",
          sandboxId: (project as any)?.sandboxId,
        });
        log("chat", "syncing sandbox…");
        const result = await syncSandbox({
          sandboxId: (project as any)?.sandboxId,
          writes,
          deletes,
        });
        previewUrl = result.previewUrl;
        await convex.mutation(api.projects.setSandbox, {
          id: projectId,
          sandboxId: result.sandboxId,
          sandboxStatus: "running",
          previewUrl: result.previewUrl,
        });
      } catch (err) {
        sandboxError =
          err instanceof Error ? err.message : "Sandbox failed to start.";
        logErr("chat", "sandbox sync failed", err);
        await convex.mutation(api.projects.setSandbox, {
          id: projectId,
          sandboxStatus: "error",
          sandboxId: (project as any)?.sandboxId,
        });
      }
    }
  } catch (err) {
    logErr("chat", "unexpected failure", err);
    prose += `\n\n⚠️ ${err instanceof Error ? err.message : "Something went wrong."}`;
  } finally {
    await finalize();
    log("chat", `■ done in ${Date.now() - t0}ms`);
  }

  return Response.json({ ok: !sandboxError, changed, previewUrl, sandboxError });
}
