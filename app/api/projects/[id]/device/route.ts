import { NextRequest } from "next/server";
import { convexServer, api } from "@/lib/convex/server";
import { getDeviceUrl } from "@/lib/sandbox/manager";
import { log, logErr } from "@/lib/log";

export const runtime = "nodejs";
export const maxDuration = 300;

// Ensure the project's sandbox is running and return its Expo Go tunnel URL
// (exp://…exp.direct). The Device tab calls this to render the QR code.
export async function POST(
  _req: NextRequest,
  ctx: RouteContext<"/api/projects/[id]/device">,
) {
  const { id } = await ctx.params;
  const projectId = id as unknown as string;
  const convex = convexServer();

  const project = await convex.query(api.projects.get, { id: projectId });
  if (!project) {
    return Response.json({ error: "Project not found." }, { status: 404 });
  }

  try {
    log("device", `▶ project=${projectId}, resolving tunnel URL…`);
    const result = await getDeviceUrl({
      sandboxId: (project as any).sandboxId,
    });

    await convex.mutation(api.projects.setSandbox, {
      id: projectId,
      sandboxId: result.sandboxId,
      sandboxStatus: "running",
      previewUrl: result.previewUrl,
      deviceUrl: result.deviceUrl,
    });

    if (!result.deviceUrl) {
      return Response.json({
        ok: false,
        error:
          result.reason ||
          "Tunnel not ready yet. Give it a few seconds, then try again.",
        previewUrl: result.previewUrl,
      });
    }

    log("device", `■ tunnel ${result.deviceUrl}`);
    return Response.json({
      ok: true,
      deviceUrl: result.deviceUrl,
      previewUrl: result.previewUrl,
    });
  } catch (err) {
    logErr("device", "failed to get tunnel URL", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to start tunnel." },
      { status: 500 },
    );
  }
}
