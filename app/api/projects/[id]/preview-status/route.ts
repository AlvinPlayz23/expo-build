import { NextRequest } from "next/server";
import { convexServer, api } from "@/lib/convex/server";
import { isPreviewReady } from "@/lib/sandbox/manager";

export const runtime = "nodejs";
// First web compile can take 15–60s; the probe holds curl open for that long
// on purpose (short timeouts abort Metro mid-bundle).
export const maxDuration = 120;

/**
 * Readiness probe for the web preview iframe.
 * Chat/preview return a host URL as soon as Metro is listening; the client
 * calls this until the web bundle is actually compileable (or failed), then
 * mounts the iframe.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const projectId = id;

  let convex;
  try {
    convex = convexServer();
  } catch (err) {
    return Response.json(
      {
        ready: false,
        reason: err instanceof Error ? err.message : "Convex not configured.",
      },
      { status: 500 },
    );
  }

  const project = (await convex.query(api.projects.get, {
    id: projectId,
  })) as {
    sandboxId?: string;
    sandboxStatus?: string;
    previewUrl?: string;
  } | null;

  if (!project) {
    return Response.json({ ready: false, reason: "not_found" }, { status: 404 });
  }

  if (!project.sandboxId || !project.previewUrl) {
    return Response.json({
      ready: false,
      reason: "no_sandbox",
      status: project.sandboxStatus ?? "none",
    });
  }

  const result = await isPreviewReady(project.sandboxId);
  return Response.json({
    ready: result.ready,
    reason: result.ready ? result.detail ?? "ok" : result.detail ?? "compiling",
    code: result.code,
    status: project.sandboxStatus ?? "none",
    previewUrl: project.previewUrl,
  });
}
