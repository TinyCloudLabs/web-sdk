/**
 * E2E tests for `tc node` commands against a local tinycloud-node.
 *
 * These commands don't require auth — they just hit HTTP endpoints.
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

describe.skipIf(!NODE_AVAILABLE)("tc node", () => {
  beforeAll(async () => {
    tempHome = await setupTestProfile();
  });

  afterAll(async () => {
    if (tempHome) await cleanupProfile(tempHome);
  });

  test("health reports node is healthy", async () => {
    const result = await tc(["node", "health"], { tempHome });
    expect(result.exitCode).toBe(0);
    const data = result.json() as { healthy: boolean; host: string; latencyMs: number };
    expect(data.healthy).toBe(true);
    expect(data.host).toBe("http://localhost:8000");
    expect(data.latencyMs).toBeGreaterThan(0);
  });

  test("status reports node status", async () => {
    const result = await tc(["node", "status"], { tempHome });
    expect(result.exitCode).toBe(0);
    const data = result.json() as { healthy: boolean; host: string; latencyMs: number };
    expect(data.healthy).toBe(true);
    expect(data.host).toBe("http://localhost:8000");
  });

  test("health with unreachable host exits with error", async () => {
    const result = await tc(["node", "health"], {
      tempHome,
      host: "http://localhost:19999",
    });
    // CLI exits with error when connection fails
    expect(result.exitCode).not.toBe(0);
  });
});
