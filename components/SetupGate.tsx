"use client";

import { ReactNode } from "react";

// Convex's NEXT_PUBLIC_CONVEX_URL is inlined at build time. If it's missing,
// `useQuery` would crash, so we show setup steps instead of the app.
export function SetupGate({ children }: { children: ReactNode }) {
  if (process.env.NEXT_PUBLIC_CONVEX_URL) return <>{children}</>;

  return (
    <div className="ambient-glow flex min-h-dvh items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-sm font-semibold text-accent-foreground shadow-[0_1px_2px_rgba(0,0,0,0.16),0_4px_10px_rgba(220,74,39,0.18)]">
            E
          </div>
          <span className="text-base font-semibold">Expo Builder</span>
        </div>
        <h1 className="mt-8 text-2xl font-semibold tracking-tight">Finish setup</h1>
        <p className="mt-2 text-sm text-muted">
          Expo Builder needs a Convex backend, an AI key, and an E2B key.
        </p>
        <ol className="mt-8 space-y-5 text-sm">
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
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground font-mono text-xs font-medium text-background">
        {n}
      </span>
      <div>
        <div className="font-medium">{title}</div>
        <div className="mt-0.5 text-muted">{children}</div>
      </div>
    </li>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md bg-sidebar px-1.5 py-0.5 font-mono text-[0.8em] font-medium text-foreground shadow-[inset_0_0_0_1px_var(--border)]">
      {children}
    </code>
  );
}
