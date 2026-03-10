/**
 * E2E tests for `tc vault` commands against a local tinycloud-node.
 *
 * Vault provides raw encrypted key-value storage (no prefix).
 * Requires: tinycloud-node running on localhost:8000
 *
 * Note: Vault values must be JSON-serializable — the vault encrypt/decrypt
 * pipeline expects JSON data. Plain strings cause parse errors.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  tc,
  setupTestProfile,
  cleanupProfile,
  uniqueKey,
  NODE_AVAILABLE,
} from "../helpers";

let tempHome: string;

/** Vault values must be JSON — wrap in a JSON string */
function jsonValue(v: string): string {
  return JSON.stringify({ data: v });
}

describe.skipIf(!NODE_AVAILABLE)("tc vault", () => {
  beforeAll(async () => {
    tempHome = await setupTestProfile();
  });

  afterAll(async () => {
    if (tempHome) await cleanupProfile(tempHome);
  });

  test("unlock succeeds", async () => {
    const result = await tc(["vault", "unlock"], { tempHome });
    expect(result.exitCode).toBe(0);
    const data = result.json() as { unlocked: boolean };
    expect(data.unlocked).toBe(true);
  });

  test("put + get round-trip", async () => {
    const key = uniqueKey("vault");
    const value = jsonValue(`vault-value-${Date.now()}`);

    const putResult = await tc(["vault", "put", key, value], { tempHome });
    expect(putResult.exitCode).toBe(0);
    const putData = putResult.json() as { key: string; written: boolean };
    expect(putData.key).toBe(key);
    expect(putData.written).toBe(true);

    const getResult = await tc(["vault", "get", key], { tempHome });
    expect(getResult.exitCode).toBe(0);
    const getData = getResult.json() as { key: string; data: unknown };
    expect(getData.key).toBe(key);
    expect(getData.data).toBeTruthy();
  });

  test("list returns keys", async () => {
    const key = uniqueKey("vault-list");
    await tc(["vault", "put", key, jsonValue("list-test")], { tempHome });

    const result = await tc(["vault", "list"], { tempHome });
    expect(result.exitCode).toBe(0);
    const data = result.json() as { keys: string[]; count: number };
    expect(data).toHaveProperty("keys");
    expect(data).toHaveProperty("count");
    expect(Array.isArray(data.keys)).toBe(true);
    expect(data.keys).toContain(key);
  });

  test("list --prefix filters keys", async () => {
    const prefix = uniqueKey("vp");
    const key1 = `${prefix}/a`;
    const key2 = `${prefix}/b`;

    await tc(["vault", "put", key1, jsonValue("val-a")], { tempHome });
    await tc(["vault", "put", key2, jsonValue("val-b")], { tempHome });

    const result = await tc(["vault", "list", "--prefix", `${prefix}/`], { tempHome });
    expect(result.exitCode).toBe(0);
    const data = result.json() as { keys: string[]; count: number; prefix: string };
    expect(data.count).toBeGreaterThanOrEqual(2);
  });

  test("delete removes a key", async () => {
    const key = uniqueKey("vault-del");
    await tc(["vault", "put", key, jsonValue("delete-me")], { tempHome });

    const delResult = await tc(["vault", "delete", key], { tempHome });
    expect(delResult.exitCode).toBe(0);
    const delData = delResult.json() as { key: string; deleted: boolean };
    expect(delData.key).toBe(key);
    expect(delData.deleted).toBe(true);

    // Get after delete should fail
    const getResult = await tc(["vault", "get", key], { tempHome });
    expect(getResult.exitCode).not.toBe(0);
  });

  test("head returns metadata for existing key", async () => {
    const key = uniqueKey("vault-head");
    await tc(["vault", "put", key, jsonValue("head-test")], { tempHome });

    const result = await tc(["vault", "head", key], { tempHome });
    expect(result.exitCode).toBe(0);
    const data = result.json() as { key: string; exists: boolean };
    expect(data.key).toBe(key);
    expect(data.exists).toBe(true);
  });

  test("head for missing key returns exists: false", async () => {
    const key = uniqueKey("vault-head-miss");
    const result = await tc(["vault", "head", key], { tempHome });
    expect(result.exitCode).toBe(0);
    const data = result.json() as { key: string; exists: boolean };
    expect(data.exists).toBe(false);
  });

  test("get --raw outputs raw data", async () => {
    const key = uniqueKey("vault-raw");
    const value = jsonValue("raw-vault-output");

    await tc(["vault", "put", key, value], { tempHome });

    const result = await tc(["vault", "get", key, "--raw"], { tempHome });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.length).toBeGreaterThan(0);
  });

  test("get --output writes to file", async () => {
    const key = uniqueKey("vault-file");
    const value = jsonValue("file-output-test");

    await tc(["vault", "put", key, value], { tempHome });

    const outputDir = await mkdtemp(join(tmpdir(), "tc-vault-out-"));
    const outputFile = join(outputDir, "output.txt");

    try {
      const result = await tc(
        ["vault", "get", key, "--output", outputFile],
        { tempHome },
      );
      expect(result.exitCode).toBe(0);

      const written = await readFile(outputFile, "utf-8");
      expect(written.length).toBeGreaterThan(0);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  test("get nonexistent key returns error", async () => {
    const key = uniqueKey("vault-miss");
    const result = await tc(["vault", "get", key], { tempHome });
    expect(result.exitCode).not.toBe(0);
  });
});
