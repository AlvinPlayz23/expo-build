# Expo Builder — "Lovable for mobile apps"

Describe a mobile app in plain English. An AI writes the Expo (React Native)
code, it runs live in an E2B sandbox, and you iterate by chatting. Convex is
the source of truth and streams everything to the UI in real time.

## Architecture

```
Next.js 16 app (this repo)
  UI  ── chat + live preview (iframe) + file browser
  │
  ├─ /api/projects/[id]/chat     the core loop (AI → files → sandbox)
  └─ /api/projects/[id]/preview  (re)boot the sandbox on demand
        │
   ┌────┴─────┐      ┌──────────────┐      ┌───────────────────┐
   │  Convex  │      │  AI engine   │      │   E2B sandbox     │
   │ (truth)  │      │  lib/ai/*    │      │   lib/sandbox/*   │
   │ projects │      │  Claude +    │      │   blank Expo app  │
   │ messages │      │  file-op     │      │   `expo start`    │
   │ files    │      │  protocol    │      │   web preview URL │
   └──────────┘      └──────────────┘      └───────────────────┘
```

**Flow:** user prompt → stored in Convex → the AI streams prose + `<expoFile>`
blocks → files are parsed and written to Convex (source of truth) **and** the
E2B sandbox (live Expo runtime) → Convex reactivity updates the chat + file
tree, and Expo hot-reload updates the preview iframe.

Key modules:

| Path | Responsibility |
| --- | --- |
| `convex/schema.ts`, `convex/*.ts` | Backend: `projects`, `messages`, `files` + queries/mutations |
| `lib/ai/prompt.ts` | System prompt constraining the model to a hostable Expo app |
| `lib/ai/parser.ts` | Incremental parser: streamed text → file operations |
| `lib/ai/agent.ts` | Orchestrates a turn over the Anthropic SDK |
| `lib/sandbox/manager.ts` | Create/connect the E2B sandbox, sync files, preview URL |
| `e2b/build-template.mjs` | One-time build of the Expo sandbox template |
| `app/api/projects/[id]/chat/route.ts` | Ties AI + Convex + E2B together |
| `app/project/[id]/page.tsx` | The workspace: chat + preview + files |

## Setup

Requires Node 20.9+. You need three accounts:
[Anthropic](https://console.anthropic.com/), [E2B](https://e2b.dev/dashboard),
and [Convex](https://convex.dev) (free).

### 1. Install

```bash
pnpm install
```

### 2. Convex backend

```bash
npx convex dev
```

Log in when prompted; it creates a deployment, generates `convex/_generated`,
and prints your `NEXT_PUBLIC_CONVEX_URL`. **Leave this running** in its own
terminal — it also live-pushes the functions in `convex/`.

### 3. Environment

```bash
cp .env.example .env.local
```

Fill in:

- `LLM_PROVIDER` — `anthropic` or `openai`
- `ANTHROPIC_API_KEY` — if using Anthropic
- `OPENAI_API_KEY` (+ optional `OPENAI_BASEURL`) — if using OpenAI or any
  OpenAI-compatible endpoint (Azure, OpenRouter, local server). Leave
  `OPENAI_BASEURL` empty to use OpenAI's default.
- `E2B_API_KEY` — runs the live sandbox
- `NEXT_PUBLIC_CONVEX_URL` — printed by `npx convex dev`

The model defaults per provider (`claude-sonnet-5` / `gpt-4o`); set `AI_MODEL`
to override.

### 4. Build the Expo sandbox template (one time)

Creates the `expo-builder` E2B template (a blank Expo SDK 54 app that serves web
on port 8081). SDK 54 is pinned to match the Expo Go version currently shipped
through the mobile app stores:

```bash
E2B_API_KEY=your_key node e2b/build-template.mjs
```

Takes a few minutes. When done, the template lives on your E2B account and
every project reuses it.

### 5. Run

```bash
pnpm dev
```

Open http://localhost:3000, describe an app, and watch it build.

## Preview on a real phone (Expo Go)

Open a project, then click the **📱 Device** tab and **Get QR code**. Install
**Expo Go** ([iOS](https://apps.apple.com/app/expo-go/id982107779) /
[Android](https://play.google.com/store/apps/details?id=host.exp.exponent)) and
scan the code — the app opens live on your phone and hot-reloads as you chat.

How it works: the sandbox runs `expo start --tunnel`, which publishes a public
`exp://…exp.direct` URL (via ngrok) that Expo Go can reach from anywhere — the
sandbox isn't on your LAN, so plain LAN mode wouldn't work. The tunnel URL is
captured from Metro's log and rendered as a QR code (`/api/qr`).

> The tunnel can take up to ~2 minutes on a cold start (anonymous ngrok is
> slow/rate-limited). The Device tab shows a spinner with a live timer; if it
> times out, check the dev terminal for the ngrok log tail and hit **refresh
> tunnel**.

The **Preview** tab does not block chat on Metro compile. Instead it polls
`/api/projects/[id]/preview-status` and shows a **compiling** spinner until the
web bundle returns 200, then mounts the iframe.

## Notes & limitations

- **Output protocol.** The model returns full files wrapped in
  `<expoFile path="…">…</expoFile>` (and `<expoDelete path="…" />`). See
  `lib/ai/protocol.ts`. Full-file writes (not diffs) keep it robust.
- **Two preview modes.** The **Preview** tab is Expo Web (react-native-web) in
  an iframe; the **Device** tab is the real native app via Expo Go. Generated
  apps are constrained (via the system prompt) to components that render on both.
- **Sandbox lifetime.** Sandboxes idle out after ~15 min; the next chat or the
  **restart** button re-provisions from the files in Convex.
- **Typed Convex API.** The app calls Convex through `anyApi` (`lib/convex/api.ts`)
  so it compiles before `convex dev` runs. After codegen you can switch to the
  typed `@/convex/_generated/api` for end-to-end type safety.
- **Cost.** Each build turn is one Claude call; the sandbox bills for uptime.
  Default `AI_MODEL=claude-sonnet-5`.

## Roadmap ideas

- Write files into the sandbox incrementally (on `file-close` during
  generation instead of after the full turn).
- Device preview (Expo Go tunnel + QR).
- Feed Metro build errors from `expo.log` back to the AI for auto-repair.
- Auth + per-user projects (Convex Auth).
