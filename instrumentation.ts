// Runs once when the server boots. Prints a config summary to the dev terminal
// so you can immediately see whether keys are loaded and which provider is on.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { mask } = await import("./lib/log");

  const provider = (process.env.LLM_PROVIDER || "anthropic").toLowerCase();
  const lines = [
    "────────────────────────────────────────",
    " Expo Builder — server starting",
    `   LLM_PROVIDER      : ${provider}`,
    provider === "openai"
      ? `   OPENAI_API_KEY   : ${mask(process.env.OPENAI_API_KEY)}`
      : `   ANTHROPIC_API_KEY: ${mask(process.env.ANTHROPIC_API_KEY)}`,
    provider === "openai"
      ? `   OPENAI_BASEURL   : ${process.env.OPENAI_BASEURL || "default (api.openai.com/v1)"}`
      : "",
    `   AI_MODEL         : ${process.env.AI_MODEL || `(default for ${provider})`}`,
    `   E2B_API_KEY      : ${mask(process.env.E2B_API_KEY)}`,
    `   E2B_TEMPLATE     : ${process.env.E2B_TEMPLATE || "expo-builder (default)"}`,
    `   CONVEX_URL       : ${process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL || "MISSING"}`,
    "────────────────────────────────────────",
  ].filter(Boolean);

  console.log(lines.join("\n"));
}
