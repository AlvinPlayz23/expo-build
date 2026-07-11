"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex/api";
import { SetupGate } from "@/components/SetupGate";
import { 
  PanelLeftClose, 
  PanelLeftOpen, 
  RefreshCw, 
  Play, 
  ExternalLink, 
  Folder, 
  Terminal, 
  Copy, 
  Check, 
  Send, 
  MessageSquare, 
  Code2, 
  Smartphone,
  ChevronLeft,
  AlertCircle
} from "lucide-react";

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
  const [chatExpanded, setChatExpanded] = useState(true);
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
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
        <Link href="/" className="group flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted transition-colors hover:text-accent">
          <ChevronLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
          Apps
        </Link>
        <span className="h-4 w-[1px] bg-border" />
        
        {/* Toggle Chat Sidebar */}
        <button
          onClick={() => setChatExpanded(!chatExpanded)}
          className="btn-clay flex h-7 w-7 items-center justify-center text-muted hover:text-foreground"
          title={chatExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
        >
          {chatExpanded ? <PanelLeftClose size={13} /> : <PanelLeftOpen size={13} />}
        </button>
        <span className="h-4 w-[1px] bg-border" />

        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-accent shrink-0 select-none">
            <path d="M12 2L2 9.5l3.5 2.6L12 7.2l6.5 4.9 3.5-2.6L12 2zM12 22l10-7.5-3.5-2.6L12 16.8l-6.5-4.9L2 14.5 12 22z" fill="currentColor" />
          </svg>
          <span className="truncate text-sm font-medium tracking-[-0.01em]">
            {project?.name ?? "\u2026"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {project?.sandboxStatus === "running" ? (
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-status-pulse" />
              <span className="font-mono text-[9px] font-medium uppercase tracking-wider text-emerald-400">Live</span>
            </div>
          ) : project?.sandboxStatus === "starting" ? (
            <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="font-mono text-[9px] font-medium uppercase tracking-wider text-amber-400">Booting</span>
            </div>
          ) : project?.sandboxStatus ? (
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted">{project.sandboxStatus}</span>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* chat pane */}
        <section 
          className={`flex flex-col border-r border-border transition-all duration-200 bg-background ${
            chatExpanded ? "w-[38%] min-w-[320px] max-w-[480px]" : "w-0 min-w-0 opacity-0 overflow-hidden border-r-0"
          }`}
        >
          {/* chat header */}
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-border-subtle bg-surface/40 px-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Chat</span>
            <span className="font-mono text-[9px] text-muted/50">
              {messages ? `${messages.length} message${messages.length !== 1 ? "s" : ""}` : ""}
            </span>
          </div>

          <ChatLog messages={messages} sending={sending} />

          {banner && (
            <div className="mx-3 mb-3 flex items-start gap-2 rounded-xl border border-[#3d1515] bg-[#1a0f0f] px-3.5 py-2.5 text-xs text-red-400 animate-fade-in">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{banner}</span>
            </div>
          )}

          {/* input area */}
          <div className="border-t border-border bg-surface p-3">
            <div className="relative rounded-2xl border border-input-border bg-input-bg transition-[border-color,box-shadow] shadow-[0_2px_12px_rgba(0,0,0,0.2)] focus-within:border-accent/40 focus-within:shadow-[0_0_15px_var(--accent-glow),0_2px_12px_rgba(0,0,0,0.2)]">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter")
                    send(input);
                }}
                rows={2}
                placeholder={
                  sending ? "Working\u2026" : "Describe a change\u2026"
                }
                disabled={sending}
                className="w-full resize-none bg-transparent px-4 pt-3 pb-10 text-sm outline-none disabled:opacity-50 placeholder:text-muted/40"
              />
              <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2">
                <span className="hidden items-center gap-1 text-[9px] text-muted/40 sm:flex">
                  <kbd className="rounded border border-border-subtle bg-surface-raised px-1 py-0.5 font-mono text-[8px]">{"\u2318"}</kbd>
                  <kbd className="rounded border border-border-subtle bg-surface-raised px-1 py-0.5 font-mono text-[8px]">{"\u21b5"}</kbd>
                </span>
                <button
                  onClick={() => send(input)}
                  disabled={sending || !input.trim()}
                  className="btn-clay-accent flex h-7 items-center gap-1.5 px-3 text-[11px] font-semibold"
                >
                  <Send size={11} />
                  Send
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* preview / files pane */}
        <section className="flex min-w-0 flex-1 flex-col">
          {/* tab bar */}
          <div className="flex h-11 shrink-0 items-center border-b border-border bg-surface/40">
            <div className="flex h-full items-center gap-1 pl-2">
              <Tab active={tab === "preview"} onClick={() => setTab("preview")}>
                <Smartphone size={13} />
                Preview
              </Tab>
              <Tab active={tab === "files"} onClick={() => setTab("files")}>
                <Code2 size={13} />
                Files{files ? ` (${files.length})` : ""}
              </Tab>
              <Tab active={tab === "device"} onClick={() => setTab("device")}>
                <Terminal size={13} />
                Device
              </Tab>
            </div>
            <div className="ml-auto flex items-center gap-1.5 pr-3">
              <ActionButton onClick={() => setReloadKey((k) => k + 1)} icon={<RefreshCw size={11} />}>
                Reload
              </ActionButton>
              <ActionButton onClick={restartPreview} disabled={sending} icon={<Play size={11} />}>
                Restart
              </ActionButton>
              {project?.previewUrl && (
                <a
                  href={project.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-clay flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-medium text-muted transition-colors hover:text-foreground"
                >
                  <ExternalLink size={10} />
                  Open
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

/* ─── Chat Log ─── */

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
    <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-4 py-5">
      {messages === undefined ? (
        <div className="flex items-center gap-2 text-sm text-muted">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="animate-spin"><path d="M7 1.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11z" stroke="currentColor" strokeWidth="1.5" opacity="0.3"/><path d="M7 1.5a5.5 5.5 0 015.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          Loading{"\u2026"}
        </div>
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="relative mb-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-surface-raised to-surface border border-border/60">
              <MessageSquare size={32} className="text-muted" opacity={0.4} />
            </div>
            <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-accent/20 blur-md" />
          </div>
          <p className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">Start building</p>
          <p className="mt-2 max-w-[260px] text-[13px] font-light leading-relaxed text-muted">
            Describe the app you want. The AI will write the Expo code and it{"\u2019"}ll appear in the preview.
          </p>
        </div>
      ) : (
        messages.map((m) => (
          <div
            key={m._id}
            className={`animate-message-in flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
          >
            <span className={`role-label mb-1 ${m.role === "user" ? "text-accent/60" : "text-muted/50"}`}>
              {m.role === "user" ? "You" : "AI"}
            </span>
            <div
              className={`inline-block max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                m.role === "user"
                  ? "rounded-br-md bg-accent text-accent-foreground shadow-[0_2px_8px_rgba(232,116,74,0.2)]"
                  : "rounded-bl-md bg-surface-raised text-foreground shadow-[inset_0_0_0_1px_var(--border-subtle)]"
              }`}
            >
              {m.content || (m.streaming ? "\u2026" : "")}
              {m.streaming && (
                <span className="ml-1 inline-block animate-pulse text-accent">{"\u258d"}</span>
              )}
            </div>
          </div>
        ))
      )}
      {sending && messages && messages[messages.length - 1]?.role === "user" && (
        <div className="animate-message-in flex flex-col items-start">
          <span className="role-label mb-1 text-muted/50">AI</span>
          <div className="inline-flex items-center gap-2.5 rounded-2xl rounded-bl-md bg-surface-raised px-4 py-3 text-[13px] text-muted shadow-[inset_0_0_0_1px_var(--border-subtle)]">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
            Thinking{"\u2026"}
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}

/* ─── Preview Pane ─── */

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
  const [bundleReady, setBundleReady] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const waitingForBundle = Boolean(url) && !bundleReady;
  const booting = !url && (status === "starting" || status === "running");
  const showWait = waitingForBundle || booting;

  useEffect(() => {
    setBundleReady(false);
    setElapsedSec(0);
  }, [url, reloadKey]);

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

    const forceTimer = setTimeout(() => {
      if (!cancelled) setBundleReady(true);
    }, 90_000);

    async function poll() {
      try {
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
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center bg-[#0e0e11]">
        {booting ? (
          <CompilingState
            title="Booting Expo sandbox"
            detail="Provisioning the cloud box and starting Metro. First start takes ~30s."
            elapsedSec={elapsedSec}
          />
        ) : status === "error" ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20">
              <AlertCircle size={20} className="text-red-500" />
            </div>
            <p className="max-w-xs text-sm font-light text-muted">
              The sandbox failed to start. Check your E2B key / template, then hit restart.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-raised border border-border">
              <Code2 size={20} className="text-muted" opacity={0.5} />
            </div>
            <p className="max-w-xs text-sm font-light text-muted">
              No preview yet. Send a message to build the app.
            </p>
          </div>
        )}
      </div>
    );
  }

  if (!bundleReady) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center bg-[#0e0e11]">
        <CompilingState
          title="Compiling web bundle"
          detail="Metro is bundling your Expo app for the browser preview."
          elapsedSec={elapsedSec}
        />
      </div>
    );
  }

  return (
    <div className="relative flex-1">
      <iframe
        key={`${reloadKey}-${url}`}
        src={url}
        className="absolute inset-0 h-full w-full bg-white"
        title="Expo preview"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
}

/* ─── Compiling State ─── */

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
    <div className="flex max-w-sm flex-col items-center gap-5">
      <div className="relative">
        <div
          className="h-11 w-11 animate-spin rounded-full border-2 border-border border-t-accent"
          aria-hidden
        />
        <div className="absolute inset-0 rounded-full" style={{ boxShadow: "0 0 24px rgba(232, 116, 74, 0.15)" }} />
      </div>
      <div className="w-48 h-1 bg-border rounded-full progress-indeterminate" />
      <div className="space-y-2 text-center">
        <p className="text-sm font-semibold tracking-[-0.01em] text-foreground">
          {title}
        </p>
        <p className="text-xs font-light leading-relaxed text-muted">{detail}</p>
        {typeof elapsedSec === "number" && (
          <p className="font-mono text-[11px] tabular-nums text-muted/60">
            {elapsedSec}s elapsed
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Device Pane ─── */

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
    <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto p-8 text-center bg-[#0b0b0d]">
      {loading && !deviceUrl ? (
        <CompilingState
          title="Starting Expo Go tunnel"
          detail="ngrok is publishing a public exp:// URL so your phone can reach the remote sandbox. Anonymous tunnels can take up to ~2 minutes."
          elapsedSec={elapsedSec}
        />
      ) : deviceUrl ? (
        <>
          <div className="rounded-3xl border border-border bg-white p-5 shadow-[0_8px_40px_rgba(0,0,0,0.3)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/qr?data=${encodeURIComponent(deviceUrl)}`}
              alt="Expo Go QR code"
              width={220}
              height={220}
              className="block rounded-lg"
            />
          </div>
          <div className="max-w-sm space-y-1.5">
            <p className="text-[15px] font-semibold text-foreground">
              Scan with Expo Go
            </p>
            <p className="text-xs font-light leading-relaxed text-muted text-pretty">
              Install <b className="font-medium text-foreground/70">Expo Go</b> from the App Store / Play Store, open it,
              and scan this code. Hot reload works as you chat.
            </p>
          </div>
          <div className="flex w-full max-w-sm items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-surface border border-border px-3 py-2 text-left font-mono text-[11px] text-muted">
              {deviceUrl}
            </code>
            <button
              onClick={copy}
              className="btn-clay flex h-8 items-center gap-1 rounded-xl px-3 text-[11px] font-medium text-muted hover:text-foreground"
            >
              {copied ? (
                <>
                  <Check size={12} className="text-emerald-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy size={12} />
                  Copy
                </>
              )}
            </button>
          </div>
          <button
            onClick={fetchTunnel}
            disabled={loading}
            className="text-[11px] font-medium text-muted hover:text-accent transition-colors disabled:opacity-40"
          >
            {loading ? `refreshing\u2026 ${elapsedSec}s` : "Refresh tunnel"}
          </button>
        </>
      ) : (
        <>
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-surface-raised to-surface border border-border/60">
              <Smartphone size={32} className="text-muted" opacity={0.4} />
            </div>
            <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-accent/15 blur-lg" />
          </div>
          <div className="max-w-sm space-y-2">
            <p className="text-[15px] font-semibold text-foreground">
              Preview on your phone
            </p>
            <p className="text-xs font-light leading-relaxed text-muted text-pretty">
              Get a QR code to open this app live in <b className="font-medium text-foreground/70">Expo Go</b>. We start a tunnel so your phone can reach the cloud sandbox.
            </p>
          </div>
          <button
            onClick={fetchTunnel}
            disabled={loading || !hasFiles}
            className="btn-clay-accent rounded-full px-6 py-2.5 text-sm font-semibold"
          >
            {hasFiles ? "Get QR code" : "Build the app first"}
          </button>
        </>
      )}
      {error && (
        <div className="flex items-start gap-2 max-w-sm rounded-xl border border-[#3d1515] bg-[#1a0f0f] px-3.5 py-2.5 text-left text-xs text-red-400">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

/* ─── Files Pane ─── */

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
  const lines = selectedFile?.content?.split("\n") ?? [];

  return (
    <div className="flex min-h-0 flex-1">
      {/* file tree sidebar */}
      <div className="scrollbar-thin flex w-56 shrink-0 flex-col border-r border-border bg-sidebar">
        <div className="flex h-8 shrink-0 items-center px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted/50 border-b border-border-subtle">
          Explorer
        </div>
        <ul className="flex-1 overflow-y-auto p-1.5 text-sm">
          {files === undefined ? (
            <li className="flex items-center gap-2 p-2 text-xs text-muted">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="animate-spin"><path d="M6 1a5 5 0 100 10 5 5 0 000-10z" stroke="currentColor" strokeWidth="1.2" opacity="0.3"/><path d="M6 1a5 5 0 015 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
              Loading{"\u2026"}
            </li>
          ) : files.length === 0 ? (
            <li className="flex flex-col items-center gap-2 p-8 text-center">
              <Folder size={24} className="text-muted" opacity={0.3} />
              <span className="text-[11px] font-light text-muted">No files yet</span>
            </li>
          ) : (
            files
              .slice()
              .sort((a, b) => a.path.localeCompare(b.path))
              .map((f) => (
                <li key={f._id} className="mb-px">
                  <button
                    onClick={() => onSelect(f.path)}
                    className={`flex w-full items-center gap-2 truncate rounded-lg px-2 py-[5px] text-left font-mono text-[11px] transition-colors ${
                      selected === f.path
                        ? "bg-surface-raised text-foreground shadow-[inset_0_0_0_1px_var(--border)]"
                        : "text-muted hover:bg-sidebar-hover hover:text-foreground"
                    }`}
                  >
                    <FileIcon path={f.path} />
                    <span className="truncate">{f.path}</span>
                  </button>
                </li>
              ))
          )}
        </ul>
      </div>

      {/* code viewer */}
      <div className="flex flex-1 flex-col overflow-hidden bg-[#09090b]">
        {selectedFile ? (
          <>
            <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border-subtle bg-[#0d0d0f] px-4">
              <FileIcon path={selectedFile.path} />
              <span className="font-mono text-[11px] text-muted">{selectedFile.path}</span>
            </div>
            <pre className="scrollbar-thin flex-1 overflow-auto code-line-numbers p-4 font-mono text-[12px] leading-[1.7] text-foreground/90 select-text">
              {lines.map((line, i) => (
                <div key={i} className="code-line">{line || " "}</div>
              ))}
            </pre>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <Code2 size={24} className="text-muted" opacity={0.25} />
            <p className="text-[11px] font-light text-muted/40">Select a file to view</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Shared UI Components ─── */

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
      className={`relative flex h-8 items-center justify-center gap-1.5 rounded-xl px-3.5 text-[11px] font-semibold tracking-[0.03em] leading-none transition-all ${
        active
          ? "tab-clay-active text-foreground"
          : "text-muted hover:text-foreground hover:bg-sidebar-hover"
      }`}
    >
      {children}
    </button>
  );
}

function ActionButton({
  onClick,
  disabled,
  icon,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="btn-clay flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-medium text-muted hover:text-foreground disabled:opacity-40"
    >
      {icon}
      {children}
    </button>
  );
}

function FileIcon({ path }: { path: string }) {
  const ext = path.split(".").pop()?.toLowerCase();
  let color = "text-muted/40";
  if (ext === "tsx" || ext === "ts") color = "text-sky-400/80";
  else if (ext === "json") color = "text-amber-400/80";
  else if (ext === "css") color = "text-violet-400/80";
  else if (ext === "js" || ext === "jsx") color = "text-yellow-400/80";
  else if (ext === "md") color = "text-blue-400/60";

  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className={`shrink-0 ${color}`}>
      <path d="M3.5 1.5h4l3 3v6.5a1 1 0 01-1 1h-6a1 1 0 01-1-1v-8.5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1" />
      <path d="M7.5 1.5v3h3" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}
