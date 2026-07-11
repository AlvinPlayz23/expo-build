// Builds the E2B sandbox template that runs a live Expo dev server.
//
//   E2B_API_KEY=... node e2b/build-template.mjs
//
// Uses E2B v2's code-based templates. The baked start command runs Metro in
// TUNNEL mode: this exposes a public exp://…exp.direct URL that Expo Go on a
// physical phone can load (the sandbox isn't on your LAN, so plain LAN mode
// won't reach it), while still serving the web build on the same port for the
// in-browser iframe preview. `waitForPort` blocks Sandbox.create() until Metro
// is listening; the tunnel URL shows up in expo.log shortly after.
import { Template, waitForPort, defaultBuildLogger } from "e2b";

const NAME = process.env.E2B_TEMPLATE || "expo-builder";
const PORT = 8081;

if (!process.env.E2B_API_KEY) {
  console.error("Set E2B_API_KEY before building (see .env.example).");
  process.exit(1);
}

const template = Template()
  .fromImage("node:20-slim")
  // E2B's default user is the non-root `user`; apt needs root.
  .runCmd(
    "apt-get update && apt-get install -y git bash curl && rm -rf /var/lib/apt/lists/*",
    { user: "root" },
  )
  .setWorkdir("/home/user")
  // Blank Expo app: single App.js entry point, no router config to fight with.
  // Pin SDK 54: the Play Store Expo Go client currently supports SDK 54,
  // while `blank` without a version resolves to the newer SDK 57 template.
  .runCmd("npx --yes create-expo-app@latest app --template blank@sdk-54 --yes")
  .setWorkdir("/home/user/app")
  // Web target deps so Metro can bundle for the browser (iframe preview).
  .runCmd("npx --yes expo install react-dom react-native-web @expo/metro-runtime")
  // ngrok powers `--tunnel`; bake it in so startup doesn't try to install it.
  .runCmd("npm install --save-dev @expo/ngrok@^4.1.0")
  // Boot Metro on every sandbox start with BOTH:
  //   --web     keeps the web bundle served at the port root (iframe preview)
  //   --tunnel  publishes the exp://…exp.direct URL for Expo Go (QR / phone)
  // These flags are orthogonal (what-to-serve vs. connection mode). Log to a
  // tailable file so we can scrape the tunnel URL and surface build errors.
  .setStartCmd(
    `cd /home/user/app && CI=1 EXPO_NO_TELEMETRY=1 ` +
      `npx expo start --web --tunnel --port ${PORT} > /home/user/expo.log 2>&1`,
    waitForPort(PORT),
  );

const info = await Template.build(template, NAME, {
  cpuCount: 2,
  memoryMB: 2048,
  onBuildLogs: defaultBuildLogger(),
});

console.log(`\nBuilt template "${NAME}".`, info?.templateId ?? "");
console.log(`Set E2B_TEMPLATE=${NAME} in .env.local`);
