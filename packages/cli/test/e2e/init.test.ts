/**
 * E2E tests for `tc init` command.
 *
 * Only tests the --key-only flow (no browser auth).
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  tc,
  setupTestProfile,
  cleanupProfile,
  uniqueKey,
  NODE_AVAILABLE,
} from "../helpers";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Use a fresh HOME with NO pre-existing profile for init tests
let freshHome: string;

describe.skipIf(!NODE_AVAILABLE)("tc init", () => {
  beforeAll(async () => {
    // Create a bare temp home (no .tinycloud directory)
    freshHome = await mkdtemp(join(tmpdir(), "tc-init-"));
  });

  afterAll(async () => {
    if (freshHome) await cleanupProfile(freshHome);
  });

  test("--key-only creates profile without auth", async () => {
    const result = await tc(["init", "--key-only"], { tempHome: freshHome });
    expect(result.exitCode).toBe(0);
    const data = result.json() as {
      profile: string;
      did: string;
      host: string;
      authenticated: boolean;
    };
    expect(data.profile).toBe("default");
    expect(data.did).toMatch(/^did:key:/);
    expect(data.authenticated).toBe(false);
  });

  test("--key-only with custom name", async () => {
    const name = uniqueKey("init").slice(0, 10);
    const result = await tc(["init", "--key-only", "--name", name], {
      tempHome: freshHome,
    });
    expect(result.exitCode).toBe(0);
    const data = result.json() as { profile: string; did: string };
    expect(data.profile).toBe(name);
    expect(data.did).toMatch(/^did:key:/);
  });

  test("init on existing profile fails", async () => {
    // "default" was already created by the first test
    const result = await tc(["init", "--key-only"], { tempHome: freshHome });
    expect(result.exitCode).not.toBe(0);
  });

  test("profile show works after init", async () => {
    const result = await tc(["profile", "show"], { tempHome: freshHome });
    expect(result.exitCode).toBe(0);
    const data = result.json() as { name: string; hasKey: boolean };
    expect(data.name).toBe("default");
    expect(data.hasKey).toBe(true);
  });
});
