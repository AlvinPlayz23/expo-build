"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/lib/convex/api";
import { SetupGate } from "@/components/SetupGate";

export default function Home() {
  return (
    <SetupGate>
      <HomeInner />
    </SetupGate>
  );
}

function HomeInner() {
  const router = useRouter();
  const projects = useQuery(api.projects.list) as any[] | undefined;
  const createProject = useMutation(api.projects.create);
  const removeProject = useMutation(api.projects.remove);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);

  async function start() {
    const text = prompt.trim();
    if (!text || busy) return;
    setBusy(true);
    const name = text.length > 40 ? text.slice(0, 40) + "…" : text;
    const id = await createProject({ name });
    router.push(`/project/${id}?prompt=${encodeURIComponent(text)}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Expo Builder</h1>
      <p className="mt-2 text-zinc-500">
        Describe a mobile app. Watch it build live, powered by AI + Expo.
      </p>

      <div className="mt-8">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") start();
          }}
          rows={3}
          placeholder="A todo app with categories and a dark theme…"
          className="w-full resize-none rounded-xl border border-zinc-300 bg-white p-4 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-300"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-zinc-400">⌘/Ctrl + Enter</span>
          <button
            onClick={start}
            disabled={busy || !prompt.trim()}
            className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
          >
            {busy ? "Creating…" : "Build it"}
          </button>
        </div>
      </div>

      <div className="mt-12">
        <h2 className="text-sm font-medium text-zinc-500">Your apps</h2>
        {projects === undefined ? (
          <p className="mt-4 text-sm text-zinc-400">Loading…</p>
        ) : projects.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-400">
            No apps yet. Describe one above to get started.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800">
            {projects.map((p) => (
              <li key={p._id} className="flex items-center gap-3 py-3">
                <Link
                  href={`/project/${p._id}`}
                  className="flex-1 truncate text-sm hover:underline"
                >
                  {p.name}
                </Link>
                <span className="text-xs text-zinc-400">
                  {p.sandboxStatus === "running" ? "● live" : p.sandboxStatus}
                </span>
                <button
                  onClick={() => removeProject({ id: p._id })}
                  className="text-xs text-zinc-400 hover:text-red-500"
                >
                  delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
