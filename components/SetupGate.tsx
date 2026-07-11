"use client";

import { ReactNode } from "react";

// Convex's NEXT_PUBLIC_CONVEX_URL is inlined at build time. If it's missing,
// `useQuery` would crash, so we show setup steps instead of the app.
export function SetupGate({ children }: { children: ReactNode }) {
  if (process.env.NEXT_PUBLIC_CONVEX_URL) return <>{children}</>;

  return (
    <div className="ambient-glow flex min-h-dvh items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-xl animate-fade-in-up">
        <div className="flex items-center gap-3.5">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-accent shrink-0 select-none">
            <path d="M12 2L2 9.5l3.5 2.6L12 7.2l6.5 4.9 3.5-2.6L12 2zM12 22l10-7.5-3.5-2.6L12 16.8l-6.5-4.9L2 14.5 12 22z" fill="currentColor" />
          </svg>
          <span className="font-display text-lg font-normal tracking-[-0.01em]">Expo Builder</span>
        </div>
        <h1 className="mt-8 font-display text-3xl font-normal tracking-tight text-foreground" style={{ background: "linear-gradient(180deg, #f0eee8 30%, #c8a080 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Finish setup
        </h1>
        <p className="mt-2 text-sm text-muted">
          Expo Builder needs a Convex backend, an AI API key, and an E2B key.
        </p>
        <ol className="mt-8 space-y-6 text-sm">
          <Step n={1} title="Start Convex">
            Run <Code>npx convex dev</Code> and keep it running. It creates your
            deployment and prints <Code>NEXT_PUBLIC_CONVEX_URL</Code>.
          </Step>
          <Step n={2} title="Add keys to .env.local">
            Copy <Code>.env.example</Code> to <Code>.env.local</Code> and fill in{" "}
            <Code>ANTHROPIC_API_KEY</Code>, <Code>E2B_API_KEY</Code>, and the
            Convex URL.
          </Step>
          <Step n={3} title="Build the Expo sandbox template">
            Run <Code>node e2b/build-template.mjs</Code> once (with{" "}
            <Code>E2B_API_KEY</Code> set) to create the{" "}
            <Code>expo-builder</Code> template.
          </Step>
          <Step n={4} title="Restart the dev server">
            Stop and re-run <Code>pnpm dev</Code> so the new env vars load.
          </Step>
        </ol>
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-4 animate-fade-in-up" style={{ animationDelay: `${n * 100}ms` }}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent font-mono text-xs font-semibold text-accent-foreground shadow-[0_2px_8px_rgba(232,116,74,0.25)]">
        {n}
      </span>
      <div>
        <div className="font-semibold text-foreground">{title}</div>
        <div className="mt-1 text-xs text-muted leading-relaxed">{children}</div>
      </div>
    </li>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md bg-surface-raised px-1.5 py-0.5 font-mono text-[0.85em] font-medium text-accent border border-border/40 shadow-sm">
      {children}
    </code>
  );
}
