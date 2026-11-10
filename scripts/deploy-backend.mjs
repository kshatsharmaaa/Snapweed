import { spawnSync } from "child_process";
import { loadMergedEnv } from "./env-loader.mjs";

async function deployBackend() {
  const env = loadMergedEnv();
  const serviceId = (env.RENDER_SERVICE_ID || "").trim();
  const apiKey = (env.RENDER_API_KEY || "").trim();
  const deployHookUrl = (env.RENDER_DEPLOY_HOOK_URL || "").trim();

  // Option 1: Direct Render REST API (zero CLI required)
  if (serviceId && apiKey) {
    console.log(`Triggering Render deploy for ${serviceId} via Render API...`);
    try {
      const res = await fetch(
        `https://api.render.com/v1/services/${encodeURIComponent(serviceId)}/deploys`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ clearCache: "do_not_clear" }),
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        console.error(`Render API failed (${res.status}): ${errText}`);
        process.exit(1);
      }

      const data = await res.json();
      console.log(`Render deploy triggered! Deploy ID: ${data?.id || "created"} (Status: ${data?.status || "queued"})`);
      process.exit(0);
    } catch (err) {
      console.error("Failed to reach Render API:", err);
      process.exit(1);
    }
  }

  // Option 2: Official Render CLI
  if (serviceId) {
    const cliCheck = spawnSync("which", ["render"], { encoding: "utf-8" });
    if (cliCheck.status !== 0) {
      console.error(
        "Either add RENDER_API_KEY in .env.local, or install Render CLI: brew install render && render login"
      );
      process.exit(1);
    }

    console.log(`Triggering Render deploy for service ${serviceId} via CLI...`);
    const result = spawnSync(
      "render",
      ["deploys", "create", serviceId, "--confirm", "--wait"],
      { stdio: "inherit", env }
    );
    process.exit(result.status ?? 1);
  }

  // Option 3: Render Deploy Hook URL
  if (deployHookUrl) {
    if (!deployHookUrl.startsWith("https://api.render.com/deploy/")) {
      console.error("Invalid RENDER_DEPLOY_HOOK_URL. Expected URL starting with https://api.render.com/deploy/");
      process.exit(1);
    }

    console.log("Triggering Render deploy via Deploy Hook...");
    try {
      const res = await fetch(deployHookUrl, { method: "POST" });
      if (!res.ok) {
        console.error(`Render deploy hook failed with status ${res.status}`);
        process.exit(1);
      }
      console.log("Render deploy triggered successfully. Check your Render dashboard for build logs.");
      process.exit(0);
    } catch (err) {
      console.error("Failed to call Render deploy hook:", err);
      process.exit(1);
    }
  }

  console.error(
    [
      "Missing Render backend deploy configuration.",
      "",
      "Set ONE of the following in .env.local:",
      "  1) RENDER_SERVICE_ID=srv-xxxx AND RENDER_API_KEY=rnd_xxxx",
      "  2) RENDER_DEPLOY_HOOK_URL=https://api.render.com/deploy/srv-xxxx?key=xxxx",
      "",
      "Or push to GitHub to auto-deploy both Render and Vercel:",
      "  npm run deploy:git",
    ].join("\n")
  );
  process.exit(1);
}

deployBackend();
