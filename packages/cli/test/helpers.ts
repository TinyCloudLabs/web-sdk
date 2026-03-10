/**
 * E2E test helpers for the TinyCloud CLI.
 *
 * Tests shell out to the built `tc` binary against a local tinycloud-node.
 * Requires:
 *   - `bun run build` (CLI must be built)
 *   - tinycloud-node running on localhost:8000 (cargo run or docker-compose)
 */

import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Well-known test private keys (Hardhat accounts)
export const TEST_PRIVATE_KEY =
  "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
export const AGENT_PRIVATE_KEY =
  "59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

export const LOCAL_HOST = "http://localhost:8000";

const CLI_BIN = join(import.meta.dir, "..", "bin", "tc");

export interface CLIResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  json: () => unknown;
}

/**
 * Create a temporary profile directory with the minimum files needed
 * for `ensureAuthenticated()` to succeed when `--private-key` is used.
 *
 * Returns the temp HOME path (cleanup with `cleanupProfile`).
 */
export async function setupTestProfile(
  profileName = "default",
): Promise<string> {
  const tempHome = await mkdtemp(join(tmpdir(), "tc-e2e-"));
  const profileDir = join(tempHome, ".tinycloud", "profiles", profileName);
  await mkdir(profileDir, { recursive: true });

  // Profile config — minimal fields
  await writeFile(
    join(profileDir, "profile.json"),
    JSON.stringify({
      name: profileName,
      host: LOCAL_HOST,
      chainId: 1,
      spaceName: "e2e-test",
      did: "did:key:test",
      createdAt: new Date().toISOString(),
    }),
  );

  // Key — dummy JWK (required by createSDKInstance)
  await writeFile(
    join(profileDir, "key.json"),
    JSON.stringify({ kty: "EC", crv: "secp256k1", x: "test", d: "test" }),
  );

  // Session — stub (ensureAuthenticated checks existence, but signIn ignores content)
  await writeFile(
    join(profileDir, "session.json"),
    JSON.stringify({ stub: true }),
  );

  // Global config
  await writeFile(
    join(tempHome, ".tinycloud", "config.json"),
    JSON.stringify({ defaultProfile: profileName, version: 1 }),
  );

  return tempHome;
}

/**
 * Remove the temporary profile directory.
 */
export async function cleanupProfile(tempHome: string): Promise<void> {
  await rm(tempHome, { recursive: true, force: true });
}

/**
 * Run a `tc` CLI command and return structured output.
 *
 * Automatically sets:
 *   --host (local node)
 *   --quiet (suppress banners)
 *   TC_PRIVATE_KEY (test key)
 *   HOME (temp profile dir)
 */
export async function tc(
  args: string[],
  options?: {
    tempHome?: string;
    privateKey?: string;
    host?: string;
    env?: Record<string, string>;
    stdin?: string;
    timeout?: number;
  },
): Promise<CLIResult> {
  const tempHome = options?.tempHome ?? (await setupTestProfile());
  const shouldCleanup = !options?.tempHome;

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    HOME: tempHome,
    TC_PRIVATE_KEY: options?.privateKey ?? TEST_PRIVATE_KEY,
    // Force non-interactive mode so output is JSON
    NO_COLOR: "1",
    ...options?.env,
  };

  const fullArgs = [
    "--host",
    options?.host ?? LOCAL_HOST,
    "--quiet",
    ...args,
  ];

  const proc = Bun.spawn(["bun", CLI_BIN, ...fullArgs], {
    env,
    stdin: options?.stdin ? "pipe" : "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });

  if (options?.stdin && proc.stdin) {
    const writer = proc.stdin.getWriter();
    await writer.write(new TextEncoder().encode(options.stdin));
    await writer.close();
  }

  const timeout = options?.timeout ?? 30_000;
  const timer = setTimeout(() => proc.kill(), timeout);

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  clearTimeout(timer);

  if (shouldCleanup) {
    await cleanupProfile(tempHome);
  }

  return {
    stdout,
    stderr,
    exitCode,
    json: () => {
      try {
        return JSON.parse(stdout);
      } catch {
        throw new Error(
          `Failed to parse CLI JSON output.\nstdout: ${stdout}\nstderr: ${stderr}`,
        );
      }
    },
  };
}

/**
 * Check if the local tinycloud-node is reachable.
 */
export async function isNodeRunning(
  host = LOCAL_HOST,
): Promise<boolean> {
  try {
    const res = await fetch(`${host}/healthz`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Generate a unique key name for test isolation.
 */
export function uniqueKey(prefix = "e2e"): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${ts}-${rand}`;
}

/**
 * Ensure the test user's space exists on the local node.
 * Uses the SDK directly with `autoCreateSpace: true`.
 */
export async function ensureTestSpace(
  privateKey = TEST_PRIVATE_KEY,
  host = LOCAL_HOST,
): Promise<void> {
  const { TinyCloudNode } = await import("@tinycloud/node-sdk");

  const node = new TinyCloudNode({
    host,
    privateKey,
    autoCreateSpace: true,
  });

  await node.signIn();
}

/**
 * Pre-computed node availability check.
 * Resolved at module load time via top-level await so `describe.skipIf` works.
 */
export const NODE_AVAILABLE = await isNodeRunning();

if (!NODE_AVAILABLE) {
  console.warn(
    "⚠ Local tinycloud-node not running on localhost:8000 — E2E tests will be skipped",
  );
} else {
  // Ensure the test space exists before any tests run
  try {
    await ensureTestSpace();
  } catch (err) {
    console.warn("⚠ Failed to create test space:", err);
  }
}
