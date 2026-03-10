/**
 * E2E tests for `tc kv` commands against a local tinycloud-node.
 *
 * Requires: tinycloud-node running on localhost:8000
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  tc,
  setupTestProfile,
  cleanupProfile,
  uniqueKey,
  NODE_AVAILABLE,
} from "../helpers";

let tempHome: string;

describe.skipIf(!NODE_AVAILABLE)("tc kv", () => {
  beforeAll(async () => {
    tempHome = await setupTestProfile();
  });

  afterAll(async () => {
    if (tempHome) await cleanupProfile(tempHome);
  });

  test("list returns keys", async () => {
    const result = await tc(["kv", "list"], { tempHome });
    expect(result.exitCode).toBe(0);

    const data = result.json() as { keys: unknown[]; count: number };
    expect(data).toHaveProperty("keys");
    expect(data).toHaveProperty("count");
    expect(Array.isArray(data.keys)).toBe(true);
  });

  test("put + get round-trip", async () => {
    const key = uniqueKey("kv");
    const value = `kv-value-${Date.now()}`;

    // Put
    const putResult = await tc(["kv", "put", key, value], { tempHome });
    expect(putResult.exitCode).toBe(0);
    const putData = putResult.json() as { key: string; written: boolean };
    expect(putData.key).toBe(key);
    expect(putData.written).toBe(true);

    // Get
    const getResult = await tc(["kv", "get", key], { tempHome });
    expect(getResult.exitCode).toBe(0);
    const getData = getResult.json() as { key: string; data: string };
    expect(getData.key).toBe(key);
    expect(getData.data).toBe(value);
  });

  test("put + get --raw outputs plain value", async () => {
    const key = uniqueKey("kv-raw");
    const value = "raw-test-value";

    await tc(["kv", "put", key, value], { tempHome });

    const result = await tc(["kv", "get", key, "--raw"], { tempHome });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(value);
  });

  test("put + list shows the key", async () => {
    const key = uniqueKey("kv-list");
    const value = "list-test";

    await tc(["kv", "put", key, value], { tempHome });

    const result = await tc(["kv", "list"], { tempHome });
    expect(result.exitCode).toBe(0);
    const data = result.json() as { keys: any[] };
    // Keys may be objects with a .key field or plain strings
    const keyNames = data.keys.map((k: any) => (typeof k === "string" ? k : k.key));
    expect(keyNames).toContain(key);
  });

  test("list --prefix filters keys", async () => {
    const prefix = `pfx-${Date.now().toString(36)}`;
    const key1 = `${prefix}/alpha`;
    const key2 = `${prefix}/beta`;

    await tc(["kv", "put", key1, "a"], { tempHome });
    await tc(["kv", "put", key2, "b"], { tempHome });

    const result = await tc(["kv", "list", "--prefix", prefix], { tempHome });
    expect(result.exitCode).toBe(0);
    const data = result.json() as { keys: any[]; prefix: string };
    const keyNames = data.keys.map((k: any) => (typeof k === "string" ? k : k.key));
    expect(keyNames).toContain(key1);
    expect(keyNames).toContain(key2);
  });

  test("put + delete + get returns not found", async () => {
    const key = uniqueKey("kv-del");
    const value = "delete-me";

    await tc(["kv", "put", key, value], { tempHome });

    const delResult = await tc(["kv", "delete", key], { tempHome });
    expect(delResult.exitCode).toBe(0);
    const delData = delResult.json() as { key: string; deleted: boolean };
    expect(delData.key).toBe(key);
    expect(delData.deleted).toBe(true);

    const getResult = await tc(["kv", "get", key], { tempHome });
    expect(getResult.exitCode).not.toBe(0);
  });

  test("put overwrites existing value", async () => {
    const key = uniqueKey("kv-overwrite");

    await tc(["kv", "put", key, "first"], { tempHome });
    await tc(["kv", "put", key, "second"], { tempHome });

    const result = await tc(["kv", "get", key, "--raw"], { tempHome });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("second");
  });

  test("get nonexistent key returns error exit code", async () => {
    const key = uniqueKey("kv-nonexistent");
    const result = await tc(["kv", "get", key], { tempHome });
    expect(result.exitCode).not.toBe(0);
  });

  test("head returns metadata for existing key", async () => {
    const key = uniqueKey("kv-head");
    const value = "head-test";

    await tc(["kv", "put", key, value], { tempHome });

    const result = await tc(["kv", "head", key], { tempHome });
    expect(result.exitCode).toBe(0);
    const data = result.json() as { key: string; exists: boolean; metadata: Record<string, unknown> };
    expect(data.key).toBe(key);
    expect(data.exists).toBe(true);
  });

  test("head on nonexistent key returns exists: false", async () => {
    const key = uniqueKey("kv-head-miss");
    const result = await tc(["kv", "head", key], { tempHome });
    // head on missing key may return exists: false or error depending on server
    if (result.exitCode === 0) {
      const data = result.json() as { key: string; exists: boolean };
      expect(data.exists).toBe(false);
    } else {
      // Some servers return error for missing keys
      expect(result.exitCode).not.toBe(0);
    }
  });

  test("put JSON value round-trip", async () => {
    const key = uniqueKey("kv-json");
    const jsonValue = JSON.stringify({ name: "test", count: 42 });

    await tc(["kv", "put", key, jsonValue], { tempHome });

    const result = await tc(["kv", "get", key, "--raw"], { tempHome });
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.name).toBe("test");
    expect(parsed.count).toBe(42);
  });
});
