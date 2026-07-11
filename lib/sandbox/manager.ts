import "server-only";
import { Sandbox } from "e2b";
import { log, logErr } from "../log";

// ---------------------------------------------------------------------------
// E2B sandbox manager: one live Expo dev server per project.
//
// The sandbox is a mirror of Convex `files`. We write generated files into the
// Expo project dir, Metro hot-reloads, and we hand back a public preview URL.
// See https://e2b.dev/docs/template/examples/expo for the template itself.
// ---------------------------------------------------------------------------

const API_KEY = process.env.E2B_API_KEY;
const TEMPLATE = process.env.E2B_TEMPLATE || "expo-builder";

// Where the Expo project lives inside the sandbox (set by the template).
export const APP_DIR = "/home/user/app";
// Port Expo/Metro serves the web build on.
export const PREVIEW_PORT = 8081;
// Keep the box alive this long between requests (ms). Bumped on every access.
const SANDBOX_TIMEOUT_MS = 15 * 60 * 1000;

export type ProjectFile = { path: string; content: string };

// Reuse connected Sandbox instances within a single server process so we don't
// pay a reconnect on every request. Serverless cold starts just rebuild it.
const cache = new Map<string, Sandbox>();

function requireKey(): string {
  if (!API_KEY) {
    throw new Error(
      "E2B_API_KEY is not set. Add it to .env.local (see .env.example).",
    );
  }
  return API_KEY;
}

export function previewUrl(sandbox: Sandbox): string {
  // getHost returns a bare host like "8081-<id>.e2b.app"; make it a URL.
  return `https://${sandbox.getHost(PREVIEW_PORT)}`;
}

// Older Expo CLIs printed the tunnel address into expo.log. Current versions
// only print "Tunnel ready", so log scraping is retained as a fallback.
const EXP_URL_RE = /exp:\/\/[^\s"']+/;

async function readLog(sandbox: Sandbox): Promise<string> {
  const res = await sandbox.commands
    .run("cat /home/user/expo.log 2>/dev/null || true")
    .catch(() => null);
  return res?.stdout ?? "";
}

/** Ask Metro for the Expo Go deep link it is currently advertising. */
async function readDeviceUrl(sandbox: Sandbox): Promise<string | undefined> {
  const res = await sandbox.commands
    .run(
      `curl -fsS --max-time 5 "http://localhost:${PREVIEW_PORT}/_expo/open?platform=ios&runtime=expo" 2>/dev/null || true`,
    )
    .catch(() => null);
  const body = (res?.stdout ?? "").trim();
  if (body) {
    try {
      const data = JSON.parse(body) as { url?: unknown };
      if (typeof data.url === "string" && data.url.startsWith("exp://")) {
        return data.url;
      }
    } catch {
      // Fall through to the legacy endpoint used by older Expo CLI versions.
    }
  }

  const legacy = await sandbox.commands
    .run(
      `curl -sS --max-time 5 -o /dev/null -D - "http://localhost:${PREVIEW_PORT}/_expo/link?platform=ios" 2>/dev/null || true`,
    )
    .catch(() => null);
  return legacy?.stdout.match(/^location:\s*(exp:\/\/\S+)/im)?.[1];
}

/**
 * Metro opens port 8081 *before* it finishes the first web compile. Loading the
 * iframe too early shows a "still bundling" 500.
 *
 * IMPORTANT: do NOT use a short curl timeout here. The first request *is* the
 * compile — if we abort it after a few seconds, Metro cancels the in-flight
 * bundle and the next poll starts over. That produced an infinite "compiling"
 * spinner while polls returned not-ready every ~1–2s. Hold the connection long
 * enough for a cold compile (same idea as the old waitForWebBundle).
 */
export type PreviewReady = {
  ready: boolean;
  /** HTTP status from the bundle probe, or a synthetic reason. */
  code: string;
  detail?: string;
};

async function probeBundle(sandbox: Sandbox): Promise<PreviewReady> {
  // Fast path: Metro already logged a successful web bundle (no need to re-fetch).
  const logText = await readLog(sandbox);
  if (/Web Bundled\b/i.test(logText) || /Bundled \d+ms\b/i.test(logText)) {
    // Still confirm the server answers — a prior "Bundled" can be stale after a crash.
    const quick = await curlHttpCode(
      sandbox,
      `http://localhost:${PREVIEW_PORT}/`,
      5,
    );
    if (quick === "200" || quick === "304") {
      return { ready: true, code: quick, detail: "log+host" };
    }
  }

  // Cold path: request the real web bundle and wait for Metro to finish compiling.
  const bundleUrl =
    `http://localhost:${PREVIEW_PORT}/index.bundle?platform=web&dev=true&minify=false`;
  const code = await curlHttpCode(sandbox, bundleUrl, 90);
  log("sandbox", `bundle probe → HTTP ${code}`);

  if (code === "200") {
    log("sandbox", "web bundle compiled (200)");
    return { ready: true, code };
  }

  // App-level compile errors also finish the request (usually 500). Surface the
  // iframe so the user sees Metro's redbox instead of spinning forever.
  if (code === "500" || code === "503") {
    const failed = /Unable to resolve|SyntaxError|TransformError|Bundling failed/i.test(
      logText,
    );
    if (failed) {
      logErr("sandbox", "bundle finished with errors — showing preview anyway");
      return { ready: true, code, detail: "bundle_error" };
    }
    // "Still bundling" / transient — not ready yet.
    return { ready: false, code, detail: "still_bundling" };
  }

  return { ready: false, code, detail: "not_ready" };
}

async function curlHttpCode(
  sandbox: Sandbox,
  url: string,
  maxTimeSec: number,
): Promise<string> {
  const res = await sandbox.commands
    .run(
      // Only print the status code; ignore body. On total failure emit 000.
      `curl -sS -o /dev/null -w "%{http_code}" --max-time ${maxTimeSec} "${url}" 2>/dev/null || echo 000`,
    )
    .catch(() => null);
  // Take the last non-empty token in case the shell mixed anything else in.
  const raw = (res?.stdout ?? "").trim();
  const m = raw.match(/(\d{3}|000)\s*$/);
  return m?.[1] ?? "000";
}

/**
 * Connect to an *existing* sandbox without creating a new one. Used by the
 * readiness probe so a status check never spins up a fresh box.
 */
async function connectExisting(sandboxId: string): Promise<Sandbox | null> {
  const apiKey = requireKey();
  const cached = cache.get(sandboxId);
  if (cached && (await cached.isRunning().catch(() => false))) {
    await cached.setTimeout(SANDBOX_TIMEOUT_MS).catch(() => {});
    return cached;
  }
  try {
    const sandbox = await Sandbox.connect(sandboxId, { apiKey });
    await sandbox.setTimeout(SANDBOX_TIMEOUT_MS).catch(() => {});
    cache.set(sandbox.sandboxId, sandbox);
    return sandbox;
  } catch {
    return null;
  }
}

// Coalesce concurrent probes for the same sandbox (React Strict Mode double-mount,
// multiple tabs). Two parallel curls can abort each other's first compile.
const probeInflight = new Map<string, Promise<PreviewReady>>();

/** Probe whether the web bundle is ready. Never creates a box. */
export async function isPreviewReady(sandboxId: string): Promise<PreviewReady> {
  const existing = probeInflight.get(sandboxId);
  if (existing) return existing;

  const work = (async (): Promise<PreviewReady> => {
    try {
      const sandbox = await connectExisting(sandboxId);
      if (!sandbox) {
        return { ready: false, code: "000", detail: "connect_failed" };
      }
      return await probeBundle(sandbox);
    } catch (err) {
      logErr("sandbox", "isPreviewReady failed", err);
      return { ready: false, code: "000", detail: "error" };
    }
  })();

  probeInflight.set(sandboxId, work);
  try {
    return await work;
  } finally {
    if (probeInflight.get(sandboxId) === work) probeInflight.delete(sandboxId);
  }
}

/** Poll Metro until it advertises an Expo Go URL, with logs as a fallback. */
export type DeviceResult =
  | { deviceUrl: string }
  | { deviceUrl: undefined; reason: string };

export async function waitForDeviceUrl(
  sandbox: Sandbox,
  timeoutMs = 120_000,
): Promise<DeviceResult> {
  const deadline = Date.now() + timeoutMs;
  let sawTunnelMode = false;
  let lastLog = "";
  while (Date.now() < deadline) {
    const advertisedUrl = await readDeviceUrl(sandbox);
    if (advertisedUrl) {
      log("sandbox", `tunnel ready - ${advertisedUrl}`);
      return { deviceUrl: advertisedUrl };
    }

    const logText = await readLog(sandbox);
    lastLog = logText;
    const match = logText.match(EXP_URL_RE);
    if (match) {
      log("sandbox", `tunnel ready — ${match[0]}`);
      return { deviceUrl: match[0] };
    }
    // Detect whether Metro was even started in tunnel mode. If the log shows
    // it's up but there's no sign of a tunnel, the template is likely the old
    // (web-only) build and needs rebuilding.
    if (/Tunnel ready|ngrok|starting.*tunnel|exp\.direct|Waiting on|Tunnel connected/i.test(logText)) {
      sawTunnelMode = true;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  // On timeout, surface the tunnel-related lines from the log so we can see the
  // real ngrok error instead of guessing.
  const tunnelLines = lastLog
    .split("\n")
    .filter((l) => /tunnel|ngrok|exp\.direct|error/i.test(l))
    .slice(-8)
    .join("\n");
  if (tunnelLines) {
    logErr("sandbox", `tunnel log tail:\n${tunnelLines}`);
  }

  const reason = sawTunnelMode
    ? "The tunnel is taking too long to come up (ngrok is slow or rate-limited). Check the dev terminal for the ngrok error, then try again."
    : "This sandbox isn't running in tunnel mode — rebuild the E2B template (node e2b/build-template.mjs) so `expo start --tunnel` is baked in, then start a fresh preview.";
  logErr("sandbox", `no tunnel URL — ${reason}`);
  return { deviceUrl: undefined, reason };
}

async function connectOrCreate(sandboxId?: string): Promise<{
  sandbox: Sandbox;
  created: boolean;
}> {
  const apiKey = requireKey();

  if (sandboxId) {
    const cached = cache.get(sandboxId);
    if (cached && (await cached.isRunning().catch(() => false))) {
      await cached.setTimeout(SANDBOX_TIMEOUT_MS).catch(() => {});
      log("sandbox", `reusing cached sandbox ${sandboxId}`);
      return { sandbox: cached, created: false };
    }
    try {
      log("sandbox", `connecting to existing sandbox ${sandboxId}…`);
      const sandbox = await Sandbox.connect(sandboxId, { apiKey });
      await sandbox.setTimeout(SANDBOX_TIMEOUT_MS).catch(() => {});
      cache.set(sandbox.sandboxId, sandbox);
      log("sandbox", `connected ${sandbox.sandboxId}`);
      return { sandbox, created: false };
    } catch (err) {
      // Fall through: the old sandbox expired, make a fresh one.
      logErr("sandbox", `connect failed, creating a new one`, err);
    }
  }

  log("sandbox", `creating new sandbox from template "${TEMPLATE}" (this can take ~30s)…`);
  const sandbox = await Sandbox.create(TEMPLATE, {
    apiKey,
    timeoutMs: SANDBOX_TIMEOUT_MS,
  });
  cache.set(sandbox.sandboxId, sandbox);
  log("sandbox", `created ${sandbox.sandboxId}`);
  return { sandbox, created: true };
}

export type SandboxSync = {
  sandboxId: string;
  previewUrl: string;
  deviceUrl?: string;
  created: boolean;
};

/**
 * Connect to (or create) the project's sandbox and apply file changes to it.
 * The template's baked start command boots Expo on the web port, so a freshly
 * created (or resumed) sandbox is already serving — we just mirror files onto
 * it and Metro hot-reloads. Returns ids to persist back to Convex.
 *
 * Pass `withDevice: true` to also wait for the Expo Go tunnel URL. This is
 * skipped by default so the common chat path stays fast; the Device tab asks
 * for it on demand.
 */
export async function syncSandbox(opts: {
  sandboxId?: string;
  writes?: ProjectFile[];
  deletes?: string[];
  withDevice?: boolean;
}): Promise<SandboxSync> {
  const { sandbox, created } = await connectOrCreate(opts.sandboxId);

  const writes = opts.writes ?? [];
  const entryWrites = writes.filter(
    (file) => file.path.replace(/^\/+/, "") === "App.js",
  );
  const dependencyWrites = writes.filter(
    (file) => file.path.replace(/^\/+/, "") !== "App.js",
  );

  if (writes.length > 0) {
    log("sandbox", `writing ${writes.length} file(s): ${writes.map((f) => f.path).join(", ")}`);
  }

  // Write imported modules before App.js. Updating App.js first makes Metro
  // resolve imports while E2B is still creating their files; Metro then caches
  // the missing-module result and keeps returning a JSON 500 bundle response.
  if (dependencyWrites.length > 0) {
    await sandbox.files.write(
      dependencyWrites.map((f) => ({
        path: `${APP_DIR}/${f.path.replace(/^\/+/, "")}`,
        data: f.content,
      })),
    );
  }

  for (const path of opts.deletes ?? []) {
    const safe = path.replace(/^\/+/, "");
    await sandbox.commands
      .run(`rm -f ${APP_DIR}/${JSON.stringify(safe)}`)
      .catch(() => {});
  }

  if (entryWrites.length > 0) {
    await sandbox.files.write(
      entryWrites.map((f) => ({
        path: `${APP_DIR}/${f.path.replace(/^\/+/, "")}`,
        data: f.content,
      })),
    );
  }

  // Note: we do NOT block on the web bundle compiling here — that can take
  // 10-30s and would stall the chat response. Instead the client polls
  // /preview-status and shows a "compiling…" spinner until the bundle is ready.
  const url = previewUrl(sandbox);
  log("sandbox", `preview host ${url} (bundle may still be compiling)`);

  let deviceUrl: string | undefined;
  if (opts.withDevice) {
    deviceUrl = (await waitForDeviceUrl(sandbox)).deviceUrl;
  }

  return {
    sandboxId: sandbox.sandboxId,
    previewUrl: url,
    deviceUrl,
    created,
  };
}

/**
 * Ensure the sandbox is up (creating it if needed) and return the Expo Go
 * tunnel URL. Used by the Device tab / QR code.
 */
export async function getDeviceUrl(opts: {
  sandboxId?: string;
}): Promise<{
  sandboxId: string;
  previewUrl: string;
  deviceUrl?: string;
  reason?: string;
}> {
  const { sandbox } = await connectOrCreate(opts.sandboxId);
  const result = await waitForDeviceUrl(sandbox);
  return {
    sandboxId: sandbox.sandboxId,
    previewUrl: previewUrl(sandbox),
    deviceUrl: result.deviceUrl,
    reason: "reason" in result ? result.reason : undefined,
  };
}

/** Fetch the tail of the Expo/Metro log for surfacing build errors. */
export async function readExpoLog(sandboxId: string): Promise<string> {
  const { sandbox } = await connectOrCreate(sandboxId);
  const res = await sandbox.commands
    .run("tail -n 60 /home/user/expo.log 2>/dev/null || true")
    .catch(() => null);
  return res?.stdout ?? "";
}
