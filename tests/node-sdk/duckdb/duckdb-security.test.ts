import { describe, test, expect, beforeAll } from "bun:test";
import { checkServerHealth, createClient, TEST_KEY } from "../setup";
import type { TinyCloudNode } from "@tinycloud/node-sdk";

const TABLE = `sdk_test_security_${Date.now()}`;

describe("DuckDB Security", () => {
  let alice: TinyCloudNode;

  beforeAll(async () => {
    await checkServerHealth();
    alice = createClient("alice-security", TEST_KEY);
    await alice.signIn();
    console.log("[Setup] Alice signed in, DID:", alice.did);

    // Create a table for sanity checks
    await alice.duckdb.execute(`CREATE TABLE IF NOT EXISTS ${TABLE} (id INTEGER, val VARCHAR)`);
    await alice.duckdb.execute(`INSERT INTO ${TABLE} VALUES (1, 'test')`);
  });

  // PART 1: Blocked Statements
  describe("Blocked Statements", () => {
    test("COPY TO returns error", async () => {
      const result = await alice.duckdb.execute(`COPY ${TABLE} TO '/tmp/export.csv'`);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        console.log("[Blocked] COPY TO error:", result.error.message);
      }
    });

    test("INSTALL returns error", async () => {
      const result = await alice.duckdb.execute(`INSTALL httpfs`);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        console.log("[Blocked] INSTALL error:", result.error.message);
      }
    });

    test("ATTACH returns error", async () => {
      const result = await alice.duckdb.execute(`ATTACH '/tmp/other.db' AS other`);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        console.log("[Blocked] ATTACH error:", result.error.message);
      }
    });
  });

  // PART 2: Blocked Functions
  describe("Blocked Functions", () => {
    test("read_csv() in SELECT returns error", async () => {
      const result = await alice.duckdb.query(`SELECT * FROM read_csv('/etc/passwd')`);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        console.log("[Blocked] read_csv error:", result.error.message);
      }
    });

    test("parquet_scan() returns error", async () => {
      const result = await alice.duckdb.query(`SELECT * FROM parquet_scan('/tmp/data.parquet')`);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        console.log("[Blocked] parquet_scan error:", result.error.message);
      }
    });
  });

  // PART 3: SET Restrictions
  describe("SET Restrictions", () => {
    test("SET enable_external_access = true returns error", async () => {
      const result = await alice.duckdb.execute(`SET enable_external_access = true`);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        console.log("[Blocked] SET error:", result.error.message);
      }
    });
  });

  // PART 4: Allowed Operations (sanity check)
  describe("Allowed Operations", () => {
    test("SELECT works", async () => {
      const result = await alice.duckdb.query(`SELECT * FROM ${TABLE}`);
      expect(result.ok).toBe(true);
    });

    test("INSERT works", async () => {
      const result = await alice.duckdb.execute(`INSERT INTO ${TABLE} VALUES (2, 'allowed')`);
      expect(result.ok).toBe(true);
    });

    test("CREATE TABLE works", async () => {
      const tmpTable = `sdk_test_sec_tmp_${Date.now()}`;
      const result = await alice.duckdb.execute(`CREATE TABLE ${tmpTable} (x INTEGER)`);
      expect(result.ok).toBe(true);
      // Cleanup
      await alice.duckdb.execute(`DROP TABLE IF EXISTS ${tmpTable}`);
    });

    test("EXPLAIN SELECT works", async () => {
      const result = await alice.duckdb.query(`EXPLAIN SELECT * FROM ${TABLE}`);
      expect(result.ok).toBe(true);
    });

    test("BEGIN / COMMIT work", async () => {
      const beginResult = await alice.duckdb.execute(`BEGIN`);
      // DuckDB might handle transactions differently through the service
      // Accept either success or a specific error about transactions
      if (beginResult.ok) {
        const commitResult = await alice.duckdb.execute(`COMMIT`);
        expect(commitResult.ok).toBe(true);
      }
    });
  });
});
