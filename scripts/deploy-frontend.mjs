import { spawnSync } from "child_process";
import { loadMergedEnv } from "./env-loader.mjs";

function deployFrontend() {
  const env = loadMergedEnv();
  const wsUrl = (env.RENDER_WS_URL || env.NEXT_PUBLIC_WS_URL || "").trim();

  const args = ["vercel", "--prod"];

  if (wsUrl) {
    if (!wsUrl.startsWith("wss://") && !wsUrl.startsWith("ws://")) {
      console.error("Invalid RENDER_WS_URL / NEXT_PUBLIC_WS_URL. Expected wss://<your-render-domain>/api/ws");
      process.exit(1);
    }
    args.push("--build-env", `NEXT_PUBLIC_WS_URL=${wsUrl}`);
    args.push("--env", `NEXT_PUBLIC_WS_URL=${wsUrl}`);
  } else {
    console.warn(
      "Notice: RENDER_WS_URL is not set in .env.local. Using NEXT_PUBLIC_WS_URL configured in Vercel Dashboard (if any)."
    );
  }

  if (env.GIPHY_API_KEY) {
    args.push("--env", `GIPHY_API_KEY=${env.GIPHY_API_KEY}`);
  }
  if (env.TENOR_API_KEY) {
    args.push("--env", `TENOR_API_KEY=${env.TENOR_API_KEY}`);
  }

  console.log("Deploying frontend to Vercel production...");
  const result = spawnSync("npx", args, {
    stdio: "inherit",
    env,
  });

  process.exit(result.status ?? 1);
}

deployFrontend();

