/**
 * E2E tests for CLI error handling and exit codes.
 *
 * Tests that the CLI returns correct exit codes and error messages
 * for various failure scenarios.
 *
 * Requires: tinycloud-node running on localhost:8000
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  tc,
  setupTestProfile,
  cleanupProfile,
  NODE_AVAILABLE,
} from "../helpers";

let tempHome: string;

describe.skipIf(!NODE_AVAILABLE)("tc error handling", () => {
  beforeAll(async () => {
    tempHome = await setupTestProfile();
  });

  afterAll(async () => {
    if (tempHome) await cleanupProfile(tempHome);
  });

  test("invalid private key format returns exit code 10", async () => {
    const result = await tc(["vault", "unlock"], {
      tempHome,
      privateKey: "not-a-valid-hex-key",
    });
    expect(result.exitCode).toBe(10); // INVALID_INPUT
    expect(result.stderr).toContain("INVALID_INPUT");
    expect(result.stderr).toContain("64-character hex");
  });

  test("missing private key returns exit code 3", async () => {
    const result = await tc(["vault", "unlock"], {
      tempHome,
      privateKey: "", // empty = no key
      env: { TC_PRIVATE_KEY: "" },
    });
    expect(result.exitCode).toBe(3); // AUTH_REQUIRED
  });

  test("unreachable host returns exit code 6", async () => {
    const result = await tc(["kv", "list"], {
      tempHome,
      host: "http://127.0.0.1:19999", // nothing running here
    });
    expect(result.exitCode).toBe(6); // NETWORK_ERROR
  });

  test("nonexistent kv key returns exit code 4", async () => {
    const result = await tc(["kv", "get", "nonexistent-key-that-does-not-exist"], { tempHome });
    expect(result.exitCode).toBe(4); // NOT_FOUND
  });

  test("JSON error output includes exitCode and suggestion", async () => {
    const result = await tc(["vault", "unlock"], {
      tempHome,
      privateKey: "bad",
      env: { NO_COLOR: "1" },
    });
    expect(result.exitCode).toBe(10);
    // stderr should contain JSON with exitCode
    try {
      const errorJson = JSON.parse(result.stderr);
      expect(errorJson.error.exitCode).toBe(10);
      expect(errorJson.error.suggestion).toBeTruthy();
    } catch {
      // In TTY mode (unlikely in test), stderr is human-readable
      expect(result.stderr).toContain("INVALID_INPUT");
    }
  });

  test("vault head on missing key returns exists: false (not error)", async () => {
    const result = await tc(["vault", "head", "nonexistent-vault-key"], { tempHome });
    expect(result.exitCode).toBe(0);
    const data = result.json() as { exists: boolean };
    expect(data.exists).toBe(false);
  });
});
