"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/lib/convex/api";
import { SetupGate } from "@/components/SetupGate";
import Link from "next/link";
import { 
  Plus, 
  ArrowUp, 
  Trash2, 
  Menu, 
  CheckSquare, 
  CloudSun, 
  Flame, 
  UtensilsCrossed, 
  Sparkles,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react";

const SUGGESTIONS = [
  {
    color: "text-sky-400",
    icon: CheckSquare,
    label: "Todo app with categories",
    prompt: "A todo app with categories, priorities, and a dark theme",
  },
  {
    color: "text-amber-400",
    icon: CloudSun,
    label: "Weather app with location",
    prompt:
      "A weather app that uses geolocation to show current conditions and a 5-day forecast",
  },
  {
    color: "text-emerald-400",
    icon: Flame,
    label: "Habit tracker with streaks",
    prompt: "A habit tracker app with daily streaks, reminders, and a weekly progress chart",
  },
  {
    color: "text-brand",
    icon: UtensilsCrossed,
    label: "Recipe app with search",
    prompt:
      "A recipe app with search by ingredient, favorites, and step-by-step cooking instructions",
  },
] as const;

export default function Home() {
  return (
    <SetupGate>
      <HomeInner />
    </SetupGate>
  );
}

function HomeInner() {
  const router = useRouter();
  const projects = useQuery(api.projects.list) as
    | { _id: string; name: string; sandboxStatus: string }[]
    | undefined;
  const createProject = useMutation(api.projects.create);
  const removeProject = useMutation(api.projects.remove);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, []);

  async function start() {
    const text = prompt.trim();
    if (!text || busy) return;
    setBusy(true);
    const name = text.length > 40 ? text.slice(0, 40) + "\u2026" : text;
    const id = await createProject({ name });
    router.push(`/project/${id}?prompt=${encodeURIComponent(text)}`);
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      {/* Sidebar overlay - mobile only */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`sidebar-glow fixed z-40 h-dvh shrink-0 border-r border-border bg-sidebar transition-all duration-200 ease-out md:static ${
          sidebarOpen 
            ? "translate-x-0 w-[260px] opacity-100" 
            : "-translate-x-full w-[260px] opacity-0 md:translate-x-0 md:w-0 md:border-r-0 md:overflow-hidden"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex items-center gap-3.5 px-4 py-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-accent shrink-0 select-none">
              <path d="M12 2L2 9.5l3.5 2.6L12 7.2l6.5 4.9 3.5-2.6L12 2zM12 22l10-7.5-3.5-2.6L12 16.8l-6.5-4.9L2 14.5 12 22z" fill="currentColor" />
            </svg>
            <div>
              <span className="block font-display text-[15px] font-normal leading-none tracking-[-0.01em]">Expo Builder</span>
              <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.16em] text-muted">Mobile workbench</span>
            </div>
          </div>

          {/* New app */}
          <div className="px-4 pb-3">
            <button
              onClick={() => {
                setSidebarOpen(false);
                setPrompt("");
                textareaRef.current?.focus();
              }}
              className="group flex items-center gap-3 w-full text-left"
            >
              <div className="btn-clay-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform group-hover:scale-105 active:scale-95" style={{ borderRadius: "9999px !important" }}>
                <Plus size={14} />
              </div>
              <span className="text-[13px] font-medium text-muted transition-colors group-hover:text-foreground">
                New app
              </span>
            </button>
          </div>

          {/* Projects list */}
          <div className="scrollbar-thin flex-1 overflow-y-auto px-2">
            <div className="px-2 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted">Your apps</div>
            {projects === undefined ? (
              <div className="px-2 py-2 text-[13px] font-light text-muted">{"\u2026"}</div>
            ) : projects.length === 0 ? (
              <div className="px-2 py-2 text-[13px] font-light text-muted">
                No apps yet. Start building above.
              </div>
            ) : (
              <div className="space-y-0.5">
                {projects.map((p) => (
                  <ProjectItem
                    key={p._id}
                    project={p}
                    onDelete={() => removeProject({ id: p._id })}
                    onNavigate={() => setSidebarOpen(false)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col">
        {/* Header bar */}
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4 bg-surface/20">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="btn-clay flex h-7 w-7 items-center justify-center text-muted hover:text-foreground"
            aria-label="Toggle Sidebar"
          >
            {sidebarOpen ? <PanelLeftClose size={13} /> : <PanelLeftOpen size={13} />}
          </button>
          <span className="h-4 w-[1px] bg-border" />
          <span className="font-display text-sm font-semibold tracking-tight">Expo Builder</span>
        </div>

        {/* Centered content */}
        <div className="ambient-glow flex flex-1 flex-col items-center justify-center px-6 py-8">
          {/* Greeting */}
          <div className="animate-fade-in-up text-center" style={{ animationDelay: "0ms" }}>
            <div className="mx-auto mb-5 flex w-fit items-center gap-2 rounded-full bg-surface-raised/60 px-3.5 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted shadow-[inset_0_0_0_1px_var(--border)]">
              <Sparkles size={10} className="text-emerald-400" />
              Expo workspace ready
            </div>
            <h1
              className="font-display text-4xl font-normal tracking-[-0.03em] md:text-6xl"
              style={{
                background: "linear-gradient(135deg, #f0eee8 0%, #e8e6e1 25%, #e8744a 50%, #f0eee8 75%, #c8a080 100%)",
                backgroundSize: "300% 100%",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                animation: "textShine 6s ease-in-out infinite",
              }}
            >
              Build the app you wish existed.
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-[15px] font-light leading-7 tracking-[0.01em] text-muted md:text-base">
              Describe the product and get a working Expo app — code, preview, and device testing in one place.
            </p>
          </div>

          {/* Input */}
          <div className="animate-fade-in-up mt-10 w-full max-w-2xl" style={{ animationDelay: "100ms" }}>
            <div className="relative rounded-3xl bg-surface border border-border transition-all shadow-[0_10px_35px_rgba(0,0,0,0.3)] focus-within:border-accent/40 focus-within:shadow-[0_0_20px_var(--accent-glow),0_10px_35px_rgba(0,0,0,0.3)]">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") start();
                }}
                rows={3}
                placeholder={"Describe the app you want to build\u2026"}
                className="w-full resize-none bg-transparent px-5 pt-5 pb-16 text-sm outline-none placeholder:text-muted/60"
              />
              <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between rounded-b-3xl border-t border-border-subtle px-4 py-2.5">
                <span className="hidden items-center gap-1 text-[10px] text-muted/50 sm:flex">
                  <kbd className="rounded border border-border bg-surface-raised px-1.5 py-0.5 font-mono text-[9px] text-muted/60">⌘</kbd>
                  <kbd className="rounded border border-border bg-surface-raised px-1.5 py-0.5 font-mono text-[9px] text-muted/60">↵</kbd>
                  <span className="ml-1">to send</span>
                </span>
                <button
                  onClick={() => start()}
                  disabled={busy || !prompt.trim()}
                  className="btn-clay-accent ml-auto flex h-9 w-9 items-center justify-center rounded-xl"
                  aria-label="Send"
                >
                  {busy ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="animate-spin">
                      <path
                        d="M7 1.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        opacity="0.3"
                      />
                      <path d="M7 1.5a5.5 5.5 0 015.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <ArrowUp size={16} />
                  )}
                </button>
              </div>
            </div>

            {/* Prompt suggestions */}
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s, i) => {
                const SuggestionIcon = s.icon;
                return (
                  <button
                    key={s.label}
                    onClick={() => {
                      setPrompt(s.prompt);
                      textareaRef.current?.focus();
                    }}
                    className="animate-fade-in-up glass group flex min-h-10 items-center gap-2 rounded-full bg-suggestion-bg px-4 py-2 text-left shadow-[0_0_0_1px_var(--suggestion-border),0_1px_3px_rgba(0,0,0,0.2)] transition-all hover:text-foreground hover:shadow-[0_0_0_1px_var(--accent),0_4px_16px_rgba(232,116,74,0.08)] active:scale-[0.96]"
                    style={{ animationDelay: `${200 + i * 60}ms` }}
                  >
                    <span className={`shrink-0 ${s.color}`}>
                      <SuggestionIcon size={16} />
                    </span>
                    <span className="text-[13px] font-light text-muted transition-colors group-hover:text-foreground">
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="mt-4 text-center text-[11px] font-light text-muted/40">
              Expo Builder can make mistakes. Check important code.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectItem({
  project,
  onDelete,
  onNavigate,
}: {
  project: {
    _id: string;
    name: string;
    sandboxStatus: string;
  };
  onDelete: () => void;
  onNavigate: () => void;
}) {
  const isRunning = project.sandboxStatus === "running";

  return (
    <div className="group relative flex min-h-10 items-center rounded-lg px-2 py-2">
      <Link
        href={`/project/${project._id}`}
        onClick={onNavigate}
        className="flex flex-1 items-center gap-2 truncate text-sm"
      >
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            isRunning ? "bg-emerald-400 shadow-[0_0_6px_rgba(74,222,128,0.4)]" : "bg-muted/40"
          }`}
        />
        <span className="truncate text-muted transition-colors group-hover:text-foreground">{project.name}</span>
      </Link>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete();
        }}
        className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted opacity-0 transition-all hover:text-danger group-hover:opacity-100 focus:opacity-100"
        aria-label="Delete project"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
