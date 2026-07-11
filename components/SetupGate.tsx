"use client";

import { ReactNode } from "react";

// Convex's NEXT_PUBLIC_CONVEX_URL is inlined at build time. If it's missing,
// `useQuery` would crash, so we show setup steps instead of the app.
export function SetupGate({ children }: { children: ReactNode }) {
  if (process.env.NEXT_PUBLIC_CONVEX_URL) return <>{children}</>;

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Finish setup</h1>
      <p className="mt-2 text-zinc-500">
        Expo Builder needs a Convex backend, an AI key, and an E2B key.
      </p>
      <ol className="mt-6 space-y-4 text-sm">
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
          <Code>E2B_API_KEY</Code> set) to create the <Code>expo-builder</Code>{" "}
          template.
        </Step>
        <Step n={4} title="Restart the dev server">
          Stop and re-run <Code>pnpm dev</Code> so the new env vars load.
        </Step>
      </ol>
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
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs text-white dark:bg-white dark:text-black">
        {n}
      </span>
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-zinc-500">{children}</div>
      </div>
    </li>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.8em] text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
      {children}
    </code>
  );
}
