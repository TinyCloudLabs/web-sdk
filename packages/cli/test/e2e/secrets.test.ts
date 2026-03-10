/**
 * E2E tests for `tc secrets` commands against a local tinycloud-node.
 *
 * Secrets use the vault (encrypted) with a "secrets/" prefix.
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

describe.skipIf(!NODE_AVAILABLE)("tc secrets", () => {
  beforeAll(async () => {
    tempHome = await setupTestProfile();
  });

  afterAll(async () => {
    if (tempHome) await cleanupProfile(tempHome);
  });

  test("list returns secrets array", async () => {
    const result = await tc(["secrets", "list"], { tempHome });
    expect(result.exitCode).toBe(0);

    const data = result.json() as { secrets: string[]; count: number };
    expect(data).toHaveProperty("secrets");
    expect(data).toHaveProperty("count");
    expect(Array.isArray(data.secrets)).toBe(true);
  });

  test("put + get round-trip", async () => {
    const key = uniqueKey("secret");
    const value = `secret-value-${Date.now()}`;

    const putResult = await tc(["secrets", "put", key, value], { tempHome });
    expect(putResult.exitCode).toBe(0);
    const putData = putResult.json() as { name: string; written: boolean };
    expect(putData.name).toBe(key);
    expect(putData.written).toBe(true);

    const getResult = await tc(["secrets", "get", key], { tempHome });
    expect(getResult.exitCode).toBe(0);
    const getData = getResult.json() as { name: string; value: unknown };
    expect(getData.name).toBe(key);
    // The CLI returns the full stored payload {value, createdAt}
    const storedValue =
      typeof getData.value === "object" && getData.value !== null
        ? (getData.value as { value: string }).value
        : getData.value;
    expect(storedValue).toBe(value);
  });

  test("put + list shows the key", async () => {
    const key = uniqueKey("secret-list");
    const value = "list-test-secret";

    await tc(["secrets", "put", key, value], { tempHome });

    const listResult = await tc(["secrets", "list"], { tempHome });
    expect(listResult.exitCode).toBe(0);
    const listData = listResult.json() as { secrets: string[]; count: number };
    expect(listData.secrets).toContain(key);
  });

  test("put + delete + get fails", async () => {
    const key = uniqueKey("secret-del");
    const value = "delete-me-secret";

    await tc(["secrets", "put", key, value], { tempHome });

    const delResult = await tc(["secrets", "delete", key], { tempHome });
    expect(delResult.exitCode).toBe(0);
    const delData = delResult.json() as { name: string; deleted: boolean };
    expect(delData.name).toBe(key);
    expect(delData.deleted).toBe(true);

    const getResult = await tc(["secrets", "get", key], { tempHome });
    expect(getResult.exitCode).not.toBe(0);
  });

  test("get nonexistent secret exits with error", async () => {
    const key = uniqueKey("secret-miss");
    const result = await tc(["secrets", "get", key], { tempHome });
    expect(result.exitCode).not.toBe(0);
  });

  test("put overwrites existing secret", async () => {
    const key = uniqueKey("secret-overwrite");

    await tc(["secrets", "put", key, "first-secret"], { tempHome });
    await tc(["secrets", "put", key, "second-secret"], { tempHome });

    const getResult = await tc(["secrets", "get", key], { tempHome });
    expect(getResult.exitCode).toBe(0);
    const getData = getResult.json() as { value: unknown };
    const storedValue =
      typeof getData.value === "object" && getData.value !== null
        ? (getData.value as { value: string }).value
        : getData.value;
    expect(storedValue).toBe("second-secret");
  });
});
