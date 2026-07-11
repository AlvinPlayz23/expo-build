"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex/api";
import { SetupGate } from "@/components/SetupGate";

export default function ProjectPage() {
  return (
    <SetupGate>
      {/* useSearchParams (inside Workspace) must sit under a Suspense boundary. */}
      <Suspense fallback={null}>
        <Workspace />
      </Suspense>
    </SetupGate>
  );
}

type Msg = { _id: string; role: string; content: string; streaming?: boolean };
type FileDoc = { _id: string; path: string; content: string };

function Workspace() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const search = useSearchParams();

  const project = useQuery(api.projects.get, { id }) as any;
  const messages = useQuery(api.messages.list, { projectId: id }) as
    | Msg[]
    | undefined;
  const files = useQuery(api.files.list, { projectId: id }) as
    | FileDoc[]
    | undefined;

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState<"preview" | "files" | "device">("preview");
  const [selected, setSelected] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  const autoSent = useRef(false);

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setBanner(null);
    setInput("");
    try {
      const res = await fetch(`/api/projects/${id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        setBanner(data.error || `Request failed (${res.status}).`);
      } else if (data.sandboxError) {
        setBanner(`Sandbox: ${data.sandboxError}`);
      }
      setReloadKey((k) => k + 1); // nudge the preview to reload
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Network error.");
    } finally {
      setSending(false);
    }
  }

  // Auto-send the prompt passed from the home screen, exactly once.
  useEffect(() => {
    if (autoSent.current) return;
    const prompt = search.get("prompt");
    if (prompt && messages && messages.length === 0) {
      autoSent.current = true;
      router.replace(`/project/${id}`); // strip the query param
      send(prompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  async function restartPreview() {
    setSending(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/projects/${id}/preview`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        setBanner(data.error || `Preview failed (${res.status}).`);
      }
      setReloadKey((k) => k + 1);
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Network error.");
    } finally {
      setSending(false);
    }
  }

  const selectedFile = files?.find((f) => f.path === selected);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* top bar */}
      <header className="flex h-14 items-center gap-3 border-b border-border bg-sidebar px-4">
        <Link href="/" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted hover:text-accent transition-colors">
          ← Apps
        </Link>
        <span className="h-4 w-[1px] bg-border" />
        <span className="truncate font-display text-[15px] font-normal tracking-[-0.01em]">
          {project?.name ?? "…"}
        </span>
        <span className="ml-auto flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted">
          {project?.sandboxStatus === "running" ? (
            <>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-status-pulse" />
              <span>preview live</span>
            </>
          ) : project?.sandboxStatus === "starting" ? (
            <>
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span>booting…</span>
            </>
          ) : (
            <span>{project?.sandboxStatus ?? ""}</span>
          )}
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* chat pane */}
        <section className="flex w-[40%] min-w-[320px] max-w-[500px] flex-col border-r border-border bg-background">
          <ChatLog messages={messages} sending={sending} />
          {banner && (
            <div className="mx-3 mb-3 rounded-xl border border-[#3d1515] bg-[#1a0f0f] px-3.5 py-2.5 text-xs text-red-400 animate-fade-in">
              {banner}
            </div>
          )}
          <div className="border-t border-border bg-surface/50 p-4">
            <div className="flex items-end gap-2.5">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter")
                    send(input);
                }}
                rows={2}
                placeholder={
                  sending ? "Working…" : "Describe a change…"
                }
                disabled={sending}
                className="w-full resize-none rounded-xl border border-input-border bg-input-bg p-3 text-sm outline-none transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_2px_var(--accent-glow)] disabled:opacity-50 placeholder:text-muted/50"
              />
              <button
                onClick={() => send(input)}
                disabled={sending || !input.trim()}
                className="flex h-10 items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground shadow-[0_2px_8px_rgba(232,116,74,0.35)] transition-all hover:bg-accent-hover hover:shadow-[0_2px_14px_rgba(232,116,74,0.5)] active:scale-[0.96] disabled:opacity-30 disabled:shadow-none"
              >
                Send
              </button>
            </div>
          </div>
        </section>

        {/* preview / files pane */}
        <section className="flex min-w-0 flex-1 flex-col bg-background">
          <div className="flex h-11 items-center gap-1 border-b border-border bg-sidebar/50 px-3">
            <Tab active={tab === "preview"} onClick={() => setTab("preview")}>
              Preview
            </Tab>
            <Tab active={tab === "files"} onClick={() => setTab("files")}>
              Files {files ? `(${files.length})` : ""}
            </Tab>
            <Tab active={tab === "device"} onClick={() => setTab("device")}>
              📱 Device
            </Tab>
            <div className="ml-auto flex items-center gap-3">
              <button
                onClick={() => setReloadKey((k) => k + 1)}
                className="text-xs text-muted hover:text-accent transition-colors"
              >
                reload
              </button>
              <button
                onClick={restartPreview}
                disabled={sending}
                className="text-xs text-muted hover:text-accent transition-colors disabled:opacity-40"
              >
                restart
              </button>
              {project?.previewUrl && (
                <a
                  href={project.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted hover:text-accent transition-colors"
                >
                  open ↗
                </a>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-1">
            {tab === "preview" ? (
              <PreviewPane
                projectId={id}
                url={project?.previewUrl}
                status={project?.sandboxStatus}
                reloadKey={reloadKey}
              />
            ) : tab === "files" ? (
              <FilesPane
                files={files}
                selected={selected}
                onSelect={setSelected}
                selectedFile={selectedFile}
              />
            ) : (
              <DevicePane
                projectId={id}
                deviceUrl={project?.deviceUrl}
                hasFiles={!!files && files.length > 0}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function ChatLog({
  messages,
  sending,
}: {
  messages: Msg[] | undefined;
  sending: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto p-4">
      {messages === undefined ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : messages.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted">
          Describe the app you want. The AI will write the Expo code and it’ll
          appear in the preview.
        </p>
      ) : (
        messages.map((m) => (
          <div
            key={m._id}
            className={`animate-message-in flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`inline-block max-w-[92%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "user"
                  ? "bg-accent text-accent-foreground shadow-[0_2px_8px_rgba(232,116,74,0.2)]"
                  : "bg-surface-raised text-foreground border border-border/40"
              }`}
            >
              {m.content || (m.streaming ? "…" : "")}
              {m.streaming && (
                <span className="ml-1 inline-block animate-pulse text-accent">▍</span>
              )}
            </div>
          </div>
        ))
      )}
      {sending && messages && messages[messages.length - 1]?.role === "user" && (
        <p className="text-xs text-muted animate-pulse">Thinking…</p>
      )}
      <div ref={endRef} />
    </div>
  );
}

function PreviewPane({
  projectId,
  url,
  status,
  reloadKey,
}: {
  projectId: string;
  url?: string;
  status?: string;
  reloadKey: number;
}) {
  // Don't mount the iframe until Metro has actually compiled the web bundle —
  // otherwise it 500s with "still bundling". Poll /preview-status instead.
  const [bundleReady, setBundleReady] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const waitingForBundle = Boolean(url) && !bundleReady;
  const booting = !url && (status === "starting" || status === "running");
  const showWait = waitingForBundle || booting;

  // Any new host URL or explicit reload means we need a fresh readiness check.
  useEffect(() => {
    setBundleReady(false);
    setElapsedSec(0);
  }, [url, reloadKey]);

  // Tick a wall-clock counter while booting/compiling so the wait feels intentional.
  useEffect(() => {
    if (!showWait) return;
    const t0 = Date.now();
    const id = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - t0) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [showWait, url, reloadKey, status]);

  useEffect(() => {
    if (!url || bundleReady) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    // Hard fallback: never leave the user on the spinner forever. If the probe
    // is stuck, show the iframe anyway (Metro error overlay is better than nothing).
    const forceTimer = setTimeout(() => {
      if (!cancelled) setBundleReady(true);
    }, 90_000);

    async function poll() {
      try {
        // Server holds the bundle request open for up to ~90s so Metro can finish
        // the first compile. Do not stack parallel probes — they cancel each other.
        const res = await fetch(`/api/projects/${projectId}/preview-status`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (data.ready) {
          setBundleReady(true);
          return;
        }
      } catch {
        // Keep polling through transient network / sandbox hiccups.
      }
      // Brief pause then retry only if still compiling (e.g. connect failed).
      if (!cancelled) timer = setTimeout(poll, 1500);
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(forceTimer);
    };
  }, [url, bundleReady, projectId, reloadKey]);

  if (!url) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center bg-[#17171a]">
        {booting ? (
          <CompilingState
            title="Booting Expo sandbox"
            detail="Provisioning the cloud box and starting Metro. First start takes ~30s."
            elapsedSec={elapsedSec}
          />
        ) : status === "error" ? (
          <p className="max-w-sm text-sm text-muted">
            The sandbox failed to start. Check your E2B key / template, then hit
            restart.
          </p>
        ) : (
          <p className="max-w-sm text-sm text-muted">
            No preview yet. Send a message to build the app.
          </p>
        )}
      </div>
    );
  }

  if (!bundleReady) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center bg-[#17171a]">
        <CompilingState
          title="Compiling web bundle"
          detail="Metro is bundling your Expo app for the browser preview."
          elapsedSec={elapsedSec}
        />
      </div>
    );
  }

  return (
    <iframe
      key={`${reloadKey}-${url}`}
      src={url}
      className="flex-1 bg-white border-l border-border"
      title="Expo preview"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    />
  );
}

function CompilingState({
  title,
  detail,
  elapsedSec,
}: {
  title: string;
  detail: string;
  elapsedSec?: number;
}) {
  return (
    <div className="flex max-w-sm flex-col items-center gap-4">
      <div
        className="h-9 w-9 animate-spin rounded-full border-2 border-border border-t-accent"
        aria-hidden
      />
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-foreground">
          {title}
        </p>
        <p className="text-xs leading-relaxed text-muted">{detail}</p>
        {typeof elapsedSec === "number" && (
          <p className="font-mono text-xs tabular-nums text-muted">
            {elapsedSec}s
          </p>
        )}
      </div>
    </div>
  );
}

function DevicePane({
  projectId,
  deviceUrl,
  hasFiles,
}: {
  projectId: string;
  deviceUrl?: string;
  hasFiles: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!loading) {
      setElapsedSec(0);
      return;
    }
    const t0 = Date.now();
    const id = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - t0) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [loading]);

  async function fetchTunnel() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/device`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        setError(data.error || `Failed (${res.status}).`);
      }
      // On success, deviceUrl arrives via Convex reactivity (project.deviceUrl).
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!deviceUrl) return;
    await navigator.clipboard.writeText(deviceUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 overflow-y-auto p-8 text-center bg-[#0e0e10]">
      {loading && !deviceUrl ? (
        <CompilingState
          title="Starting Expo Go tunnel"
          detail="ngrok is publishing a public exp:// URL so your phone can reach the remote sandbox. Anonymous tunnels can take up to ~2 minutes."
          elapsedSec={elapsedSec}
        />
      ) : deviceUrl ? (
        <>
          <div className="rounded-2xl border border-border bg-white p-4 shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/qr?data=${encodeURIComponent(deviceUrl)}`}
              alt="Expo Go QR code"
              width={240}
              height={240}
              className="block"
            />
          </div>
          <div className="max-w-sm space-y-1">
            <p className="text-sm font-medium text-foreground">
              Scan with Expo Go
            </p>
            <p className="text-xs leading-relaxed text-muted text-pretty">
              Install <b>Expo Go</b> from the App Store / Play Store, open it,
              and scan this code (or use Camera on iOS). Hot reload works as you
              chat — same as a local <code className="font-mono text-accent">npx expo start</code>, but via a tunnel because the sandbox isn’t on your LAN.
            </p>
          </div>
          <div className="flex w-full max-w-sm items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-surface border border-border px-3 py-2 text-left font-mono text-xs text-muted">
              {deviceUrl}
            </code>
            <button
              onClick={copy}
              className="rounded-lg border border-border px-3.5 py-2 text-xs transition-all active:scale-[0.96] hover:bg-surface-raised text-foreground"
            >
              {copied ? "✓" : "copy"}
            </button>
          </div>
          <button
            onClick={fetchTunnel}
            disabled={loading}
            className="min-h-10 text-xs text-muted hover:text-accent transition-colors disabled:opacity-40"
          >
            {loading ? `refreshing… ${elapsedSec}s` : "refresh tunnel"}
          </button>
        </>
      ) : (
        <>
          <div className="text-4xl filter drop-shadow-md animate-bounce" aria-hidden>
            📱
          </div>
          <div className="max-w-sm space-y-2">
            <p className="text-sm font-medium text-foreground">
              Preview on your phone
            </p>
            <p className="text-xs leading-relaxed text-muted text-pretty">
              Get a QR code to open this app live in <b>Expo Go</b>. Local{" "}
              <code className="font-mono text-accent/80">npx expo start</code> QR codes use your
              LAN IP — that can’t reach an E2B sandbox, so we start{" "}
              <code className="font-mono text-accent/80">expo start --tunnel</code> and scrape
              the public <code className="font-mono text-accent/80">exp://…exp.direct</code> URL.
            </p>
          </div>
          <button
            onClick={fetchTunnel}
            disabled={loading || !hasFiles}
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground shadow-[0_2px_8px_rgba(232,116,74,0.35)] transition-all active:scale-[0.96] hover:bg-accent-hover disabled:opacity-40"
          >
            {hasFiles ? "Get QR code" : "Build the app first"}
          </button>
        </>
      )}
      {error && (
        <p className="max-w-sm text-xs leading-relaxed text-danger">{error}</p>
      )}
    </div>
  );
}

function FilesPane({
  files,
  selected,
  onSelect,
  selectedFile,
}: {
  files: FileDoc[] | undefined;
  selected: string | null;
  onSelect: (p: string) => void;
  selectedFile?: FileDoc;
}) {
  return (
    <div className="flex min-h-0 flex-1">
      <ul className="scrollbar-thin w-56 shrink-0 overflow-y-auto border-r border-border bg-sidebar p-2 text-sm">
        {files === undefined ? (
          <li className="p-2 text-muted">Loading…</li>
        ) : files.length === 0 ? (
          <li className="p-2 text-muted">No files yet.</li>
        ) : (
          files
            .slice()
            .sort((a, b) => a.path.localeCompare(b.path))
            .map((f) => (
              <li key={f._id} className="mb-0.5">
                <button
                  onClick={() => onSelect(f.path)}
                  className={`w-full truncate rounded px-2.5 py-1.5 text-left font-mono text-xs transition-colors ${
                    selected === f.path
                      ? "bg-surface-raised text-foreground border border-border/50"
                      : "text-muted hover:bg-sidebar-hover hover:text-foreground"
                  }`}
                >
                  {f.path}
                </button>
              </li>
            ))
        )}
      </ul>
      <pre className="scrollbar-thin flex-1 overflow-auto bg-[#09090b] p-5 font-mono text-xs leading-relaxed text-foreground select-text">
        {selectedFile?.content ?? (
          <span className="text-muted/50 italic">Select a file to view its contents.</span>
        )}
      </pre>
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative h-11 px-4 text-xs font-semibold uppercase tracking-[0.05em] transition-all ${
        active
          ? "text-accent border-b-2 border-accent bg-background"
          : "text-muted hover:text-foreground hover:bg-sidebar-hover"
      }`}
    >
      {children}
    </button>
  );
}
