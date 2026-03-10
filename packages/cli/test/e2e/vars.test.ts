/**
 * E2E tests for `tc vars` commands against a local tinycloud-node.
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

describe.skipIf(!NODE_AVAILABLE)("tc vars", () => {
  beforeAll(async () => {
    tempHome = await setupTestProfile();
  });

  afterAll(async () => {
    if (tempHome) await cleanupProfile(tempHome);
  });

  test("list returns variables array", async () => {
    const result = await tc(["vars", "list"], { tempHome });
    expect(result.exitCode).toBe(0);

    const data = result.json() as { variables: string[]; count: number };
    expect(data).toHaveProperty("variables");
    expect(data).toHaveProperty("count");
    expect(Array.isArray(data.variables)).toBe(true);
  });

  test("put + get round-trip", async () => {
    const key = uniqueKey("var");
    const value = `test-value-${Date.now()}`;

    // Put
    const putResult = await tc(["vars", "put", key, value], { tempHome });
    expect(putResult.exitCode).toBe(0);
    const putData = putResult.json() as { name: string; written: boolean };
    expect(putData.name).toBe(key);
    expect(putData.written).toBe(true);

    // Get
    const getResult = await tc(["vars", "get", key], { tempHome });
    expect(getResult.exitCode).toBe(0);
    const getData = getResult.json() as { name: string; value: string };
    expect(getData.name).toBe(key);
    expect(getData.value).toBe(value);
  });

  test("put + list shows the key", async () => {
    const key = uniqueKey("var-list");
    const value = "list-test";

    await tc(["vars", "put", key, value], { tempHome });

    const listResult = await tc(["vars", "list"], { tempHome });
    expect(listResult.exitCode).toBe(0);
    const listData = listResult.json() as { variables: string[]; count: number };
    expect(listData.variables).toContain(key);
  });

  test("put + delete + get returns not found", async () => {
    const key = uniqueKey("var-del");
    const value = "delete-me";

    await tc(["vars", "put", key, value], { tempHome });

    const delResult = await tc(["vars", "delete", key], { tempHome });
    expect(delResult.exitCode).toBe(0);
    const delData = delResult.json() as { name: string; deleted: boolean };
    expect(delData.name).toBe(key);
    expect(delData.deleted).toBe(true);

    const getResult = await tc(["vars", "get", key], { tempHome });
    expect(getResult.exitCode).not.toBe(0);
  });

  test("get --raw outputs plain value", async () => {
    const key = uniqueKey("var-raw");
    const value = "raw-output-test";

    await tc(["vars", "put", key, value], { tempHome });

    const result = await tc(["vars", "get", key, "--raw"], { tempHome });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(value);
  });

  test("put overwrites existing value", async () => {
    const key = uniqueKey("var-overwrite");

    await tc(["vars", "put", key, "first"], { tempHome });
    await tc(["vars", "put", key, "second"], { tempHome });

    const getResult = await tc(["vars", "get", key], { tempHome });
    expect(getResult.exitCode).toBe(0);
    const data = getResult.json() as { value: string };
    expect(data.value).toBe("second");
  });

  test("get nonexistent key returns exit code 4", async () => {
    const key = uniqueKey("var-nonexistent");
    const result = await tc(["vars", "get", key], { tempHome });
    expect(result.exitCode).toBe(4);
  });
});
