import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { NextConfig } from "next";

function loadVisibleEnvFallback() {
  const fallbackPath = path.join(process.cwd(), "env.local");
  if (!existsSync(fallbackPath)) {
    return;
  }

  const contents = readFileSync(fallbackPath, "utf8");
  for (const line of contents.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadVisibleEnvFallback();

const nextConfig: NextConfig = {
  transpilePackages: ["@shadowpilot/shared"],
};

export default nextConfig;
