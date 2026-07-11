import "server-only";
import { ConvexHttpClient } from "convex/browser";
import { api } from "./api";

// Convex client for use inside route handlers / server code. Uses a plain HTTP
// client (no websocket) which is the right fit for one-shot server mutations.
const url = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;

export function convexServer(): ConvexHttpClient {
  if (!url) {
    throw new Error(
      "CONVEX_URL / NEXT_PUBLIC_CONVEX_URL is not set. Run `npx convex dev` and add it to .env.local.",
    );
  }
  return new ConvexHttpClient(url);
}

export { api };
