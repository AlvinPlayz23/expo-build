// Tiny server-side logger so the `pnpm dev` terminal shows what's happening.
// Tag groups related lines (e.g. "chat", "sandbox", "ai").

function stamp(): string {
  return new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
}

export function log(tag: string, msg: string): void {
  console.log(`${stamp()} [${tag}] ${msg}`);
}

export function logErr(tag: string, msg: string, err?: unknown): void {
  const detail =
    err instanceof Error ? `${err.message}` : err ? String(err) : "";
  console.error(`${stamp()} [${tag}] ✘ ${msg}${detail ? ` — ${detail}` : ""}`);
}

// Redact a secret for logging: show length + first few chars only.
export function mask(v?: string): string {
  if (!v) return "MISSING";
  return `set (${v.slice(0, 5)}…, len ${v.length})`;
}
