"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/lib/convex/api";
import { SetupGate } from "@/components/SetupGate";

const SUGGESTIONS = [
  {
    color: "text-sky-400",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="3" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6.5 10l2 2 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    label: "Todo app with categories",
    prompt: "A todo app with categories, priorities, and a dark theme",
  },
  {
    color: "text-amber-400",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="12.5" cy="7.5" r="3.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5 13a4 4 0 014-4h4a4 4 0 014 4v2a1 1 0 01-1 1H6a1 1 0 01-1-1v-2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
    label: "Weather app with location",
    prompt:
      "A weather app that uses geolocation to show current conditions and a 5-day forecast",
  },
  {
    color: "text-emerald-400",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M10 3c1 3 3 4 3 7a3 3 0 11-6 0c0-1 .5-2 1-3 .5 1 1.5 1.5 2-4z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
    label: "Habit tracker with streaks",
    prompt: "A habit tracker app with daily streaks, reminders, and a weekly progress chart",
  },
  {
    color: "text-brand",
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M6 3v6a2 2 0 002 2v6M6 3v3M6 6v3M14 3v14M14 3a2 2 0 010 6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        className={`fixed z-40 h-dvh w-[260px] shrink-0 border-r border-border bg-sidebar transition-transform duration-200 ease-out md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex items-center gap-3 px-4 py-4">
            <div className="animate-shimmer flex h-8 w-8 items-center justify-center rounded-[10px] text-xs font-semibold text-accent-foreground shadow-[0_1px_2px_rgba(0,0,0,0.3),0_4px_14px_rgba(232,116,74,0.25)]">
              E
            </div>
            <div>
              <span className="block font-display text-[15px] font-normal leading-none tracking-[-0.01em]">Expo Builder</span>
              <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.16em] text-muted">Mobile workbench</span>
            </div>
          </div>

          {/* New app */}
          <div className="px-3 pb-3">
            <button
              onClick={() => {
                setSidebarOpen(false);
                setPrompt("");
                textareaRef.current?.focus();
              }}
              className="flex min-h-10 w-full items-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-sm font-medium text-accent-foreground shadow-[0_1px_2px_rgba(0,0,0,0.3),0_4px_12px_rgba(232,116,74,0.2)] transition-all hover:bg-accent-hover hover:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_6px_18px_rgba(232,116,74,0.3)] active:scale-[0.96]"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              New app
            </button>
          </div>

          {/* Projects list */}
          <div className="scrollbar-thin flex-1 overflow-y-auto px-2">
            <div className="px-2 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted">Your apps</div>
            {projects === undefined ? (
              <div className="px-2 py-2 text-sm text-muted">{"\u2026"}</div>
            ) : projects.length === 0 ? (
              <div className="px-2 py-2 text-sm text-muted">
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
        {/* Mobile header */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-sidebar-hover hover:text-foreground"
            aria-label="Open menu"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <span className="font-display text-sm">Expo Builder</span>
        </div>

        {/* Centered content */}
        <div className="ambient-glow flex flex-1 flex-col items-center justify-center px-6 py-8">
          {/* Greeting */}
          <div className="animate-fade-in-up text-center" style={{ animationDelay: "0ms" }}>
            <div className="mx-auto mb-5 flex w-fit items-center gap-2 rounded-full bg-surface-raised/60 px-3.5 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted shadow-[inset_0_0_0_1px_var(--border)]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-status-pulse" />
              Expo workspace ready
            </div>
            <h1 className="font-display text-4xl font-normal tracking-[-0.03em] md:text-6xl" style={{ background: "linear-gradient(180deg, #f0eee8 30%, #c8a080 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Build the app you wish existed.
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sm leading-7 tracking-wide text-muted md:text-base">
              Describe the product and get a working Expo app—code, preview, and device testing in one place.
            </p>
          </div>

          {/* Input */}
          <div className="animate-fade-in-up mt-10 w-full max-w-2xl" style={{ animationDelay: "100ms" }}>
            <div className="relative rounded-3xl bg-surface shadow-[0_0_0_1px_var(--border),0_10px_35px_rgba(0,0,0,0.3)] transition-[box-shadow] focus-within:shadow-[0_0_0_2px_var(--accent),0_14px_50px_rgba(232,116,74,0.08)]">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") start();
                }}
                rows={3}
                placeholder={"Describe the app you want to build\u2026"}
                className="w-full resize-none bg-transparent px-5 pt-5 pb-14 text-sm outline-none placeholder:text-muted/60"
              />
              <div className="absolute bottom-3.5 right-3.5 flex items-center gap-2">
                <button
                  onClick={() => start()}
                  disabled={busy || !prompt.trim()}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-[0_2px_8px_rgba(232,116,74,0.35)] transition-all hover:bg-accent-hover hover:shadow-[0_2px_14px_rgba(232,116,74,0.5)] active:scale-[0.96] disabled:opacity-30 disabled:shadow-none"
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
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M8 13V3M4 7l4-4 4 4"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Prompt suggestions */}
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={s.label}
                  onClick={() => {
                    setPrompt(s.prompt);
                    textareaRef.current?.focus();
                  }}
                  className="animate-fade-in-up glass group flex min-h-10 items-center gap-2 rounded-full bg-suggestion-bg px-4 py-2 text-left shadow-[0_0_0_1px_var(--suggestion-border),0_1px_3px_rgba(0,0,0,0.2)] transition-all hover:text-foreground hover:shadow-[0_0_0_1px_var(--accent),0_4px_16px_rgba(232,116,74,0.08)] active:scale-[0.96]"
                  style={{ animationDelay: `${200 + i * 60}ms` }}
                >
                  <span className={`shrink-0 [&>svg]:h-[18px] [&>svg]:w-[18px] ${s.color}`}>
                    {s.icon}
                  </span>
                  <span className="text-xs text-muted transition-colors group-hover:text-foreground sm:text-sm">
                    {s.label}
                  </span>
                </button>
              ))}
            </div>

            <p className="mt-4 text-center text-xs text-muted/60">
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
    <div className="group relative flex min-h-10 items-center rounded-lg px-2 py-2 transition-colors hover:bg-surface-raised">
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
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M3 4h8M5.5 4V3a1 1 0 011-1h1a1 1 0 011 1v1M4 4v7a1 1 0 001 1h4a1 1 0 001-1V4"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
