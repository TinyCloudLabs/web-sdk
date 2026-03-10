/**
 * E2E tests for `tc doctor` command.
 *
 * Doctor runs diagnostic checks on the local profile and node connectivity.
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

describe.skipIf(!NODE_AVAILABLE)("tc doctor", () => {
  beforeAll(async () => {
    tempHome = await setupTestProfile();
  });

  afterAll(async () => {
    if (tempHome) await cleanupProfile(tempHome);
  });

  test("runs all diagnostic checks", async () => {
    const result = await tc(["doctor"], { tempHome });
    expect(result.exitCode).toBe(0);
    const data = result.json() as {
      checks: Array<{ name: string; ok: boolean; detail?: string }>;
      healthy: boolean;
    };
    expect(data).toHaveProperty("checks");
    expect(data).toHaveProperty("healthy");
    expect(Array.isArray(data.checks)).toBe(true);
    expect(data.checks.length).toBeGreaterThanOrEqual(3);

    // Check names we expect
    const checkNames = data.checks.map((c) => c.name);
    expect(checkNames).toContain("Profile");
    expect(checkNames).toContain("Key");
    expect(checkNames).toContain("Session");
  });

  test("profile check passes with valid profile", async () => {
    const result = await tc(["doctor"], { tempHome });
    const data = result.json() as {
      checks: Array<{ name: string; ok: boolean }>;
    };
    const profileCheck = data.checks.find((c) => c.name === "Profile");
    expect(profileCheck?.ok).toBe(true);
  });

  test("key check passes when key exists", async () => {
    const result = await tc(["doctor"], { tempHome });
    const data = result.json() as {
      checks: Array<{ name: string; ok: boolean }>;
    };
    const keyCheck = data.checks.find((c) => c.name === "Key");
    expect(keyCheck?.ok).toBe(true);
  });

  test("session check passes when session exists", async () => {
    const result = await tc(["doctor"], { tempHome });
    const data = result.json() as {
      checks: Array<{ name: string; ok: boolean }>;
    };
    const sessionCheck = data.checks.find((c) => c.name === "Session");
    expect(sessionCheck?.ok).toBe(true);
  });
});
