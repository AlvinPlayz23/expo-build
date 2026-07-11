import { NextRequest } from "next/server";
import { convexServer, api } from "@/lib/convex/server";
import { syncSandbox } from "@/lib/sandbox/manager";
import { ProjectFile } from "@/lib/sandbox/manager";
import { log, logErr } from "@/lib/log";

export const runtime = "nodejs";
export const maxDuration = 300;

// Ensure the project's Expo sandbox is running with the latest files applied,
// and return its preview URL. Used to (re)start a preview on demand.
export async function POST(
  _req: NextRequest,
  ctx: RouteContext<"/api/projects/[id]/preview">,
) {
  const { id } = await ctx.params;
  const projectId = id as unknown as string;
  const convex = convexServer();

  const [project, rawFiles] = await Promise.all([
    convex.query(api.projects.get, { id: projectId }),
    convex.query(api.files.list, { projectId }),
  ]);
  if (!project) {
    return Response.json({ error: "Project not found." }, { status: 404 });
  }

  const files: ProjectFile[] = (rawFiles as any[]).map((f) => ({
    path: f.path,
    content: f.content,
  }));

  await convex.mutation(api.projects.setSandbox, {
    id: projectId,
    sandboxStatus: "starting",
    sandboxId: (project as any).sandboxId,
  });

  try {
    log("preview", `▶ project=${projectId}, syncing ${files.length} file(s)…`);
    const result = await syncSandbox({
      sandboxId: (project as any).sandboxId,
      writes: files,
    });
    log("preview", `■ ready ${result.previewUrl}`);
    await convex.mutation(api.projects.setSandbox, {
      id: projectId,
      sandboxId: result.sandboxId,
      sandboxStatus: "running",
      previewUrl: result.previewUrl,
    });
    return Response.json({ ok: true, previewUrl: result.previewUrl });
  } catch (err) {
    logErr("preview", "sandbox sync failed", err);
    await convex.mutation(api.projects.setSandbox, {
      id: projectId,
      sandboxStatus: "error",
      sandboxId: (project as any).sandboxId,
    });
    return Response.json(
      { error: err instanceof Error ? err.message : "Sandbox failed." },
      { status: 500 },
    );
  }
}
