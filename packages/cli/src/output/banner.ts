import { isInteractive } from "./formatter.js";
import { pickTagline } from "./taglines.js";
import { theme } from "./theme.js";
import { execSync } from "node:child_process";

let bannerEmitted = false;

function resolveCommitHash(): string | null {
  try {
    return (
      execSync("git rev-parse --short HEAD", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim() || null
    );
  } catch {
    return null;
  }
}

function formatBannerLine(version: string): string {
  const commit = resolveCommitHash();
  const tagline = pickTagline();

  const versionPart = `tc v${version}`;
  const commitPart = commit ? ` (${commit})` : "";
  const separator = " — ";

  if (!isInteractive()) {
    return `${versionPart}${commitPart}${separator}${tagline}`;
  }

  return [
    theme.brand("☁️  tc"),
    " ",
    theme.muted(`v${version}`),
    commit ? theme.dim(` (${commit})`) : "",
    theme.dim(separator),
    theme.primary(tagline),
  ].join("");
}

export function emitBanner(version: string): void {
  if (bannerEmitted) return;
  if (!isInteractive()) return;
  if (process.env.TC_HIDE_BANNER === "1") return;

  bannerEmitted = true;
  process.stderr.write(formatBannerLine(version) + "\n\n");
}
