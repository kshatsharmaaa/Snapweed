import fs from "fs";
import path from "path";

function parseEnvFile(filename) {
  const filePath = path.join(process.cwd(), filename);
  if (!fs.existsSync(filePath)) return {};

  const parsed = {};
  const content = fs.readFileSync(filePath, "utf-8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = line.slice(0, eqIndex).trim();
    let val = line.slice(eqIndex + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (val) {
      parsed[key] = val;
    }
  }
  return parsed;
}

export function loadMergedEnv() {
  const baseEnv = parseEnvFile(".env");
  const localEnv = parseEnvFile(".env.local");
  return {
    ...baseEnv,
    ...localEnv,
    ...process.env,
  };
}

