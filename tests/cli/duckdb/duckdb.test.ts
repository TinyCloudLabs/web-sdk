import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { checkServerHealth, setupCliProfile, tc } from "../setup";
import type { TinyCloudNode } from "@tinycloud/node-sdk";

const TABLE = `cli_test_duck_${Date.now()}`;

describe("tc duckdb", () => {
  let node: TinyCloudNode;

  beforeAll(async () => {
    await checkServerHealth();
    node = await setupCliProfile();
  });

  afterAll(async () => {
    await node.duckdb.execute(`DROP TABLE IF EXISTS ${TABLE}`);
    console.log("[Cleanup] Dropped table", TABLE);
  });

  describe("execute", () => {
    test("CREATE TABLE succeeds", async () => {
      const result = await tc(
        "duckdb", "execute",
        `CREATE TABLE ${TABLE} (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, price DOUBLE)`,
      );
      expect(result.exitCode).toBe(0);
      expect(result.json).toHaveProperty("changes");
    });

    test("INSERT returns changes: 1", async () => {
      const result = await tc(
        "duckdb", "execute",
        `INSERT INTO ${TABLE} (id, name, price) VALUES (1, 'Widget', 29.99)`,
      );
      expect(result.exitCode).toBe(0);
      expect(result.json.changes).toBe(1);
    });

    test("execute response has changes but no lastInsertRowId", async () => {
      const result = await tc(
        "duckdb", "execute",
        `INSERT INTO ${TABLE} (id, name, price) VALUES (2, 'Gadget', 49.99)`,
      );
      expect(result.exitCode).toBe(0);
      expect(result.json).toHaveProperty("changes");
      expect(result.json).not.toHaveProperty("lastInsertRowId");
    });

    test("INSERT with --params binds correctly", async () => {
      const result = await tc(
        "duckdb", "execute",
        `INSERT INTO ${TABLE} (id, name, price) VALUES ($1, $2, $3)`,
        "--params", '[3, "Doohickey", 19.99]',
      );
      expect(result.exitCode).toBe(0);
      expect(result.json.changes).toBe(1);
    });

    test("UPDATE returns correct changes count", async () => {
      const result = await tc(
        "duckdb", "execute",
        `UPDATE ${TABLE} SET price = 34.99 WHERE id = 1`,
      );
      expect(result.exitCode).toBe(0);
      expect(result.json.changes).toBe(1);
    });
  });

  describe("query", () => {
    test("SELECT * returns columns, rows, rowCount", async () => {
      const result = await tc("duckdb", "query", `SELECT * FROM ${TABLE} ORDER BY id`);
      expect(result.exitCode).toBe(0);
      expect(result.json.columns).toContain("id");
      expect(result.json.columns).toContain("name");
      expect(result.json.columns).toContain("price");
      expect(result.json.rowCount).toBe(3);
      expect(result.json.rows).toHaveLength(3);
    });

    test("WHERE clause filters correctly", async () => {
      const result = await tc("duckdb", "query", `SELECT * FROM ${TABLE} WHERE name = 'Widget'`);
      expect(result.exitCode).toBe(0);
      expect(result.json.rowCount).toBe(1);
    });

    test("query with --params binds correctly", async () => {
      const result = await tc(
        "duckdb", "query",
        `SELECT * FROM ${TABLE} WHERE id = $1`,
        "--params", "[2]",
      );
      expect(result.exitCode).toBe(0);
      expect(result.json.rowCount).toBe(1);
      const nameIdx = result.json.columns.indexOf("name");
      expect(result.json.rows[0][nameIdx]).toBe("Gadget");
    });

    test("aggregates work", async () => {
      const result = await tc(
        "duckdb", "query",
        `SELECT COUNT(*) as cnt, SUM(price) as total FROM ${TABLE}`,
      );
      expect(result.exitCode).toBe(0);
      expect(result.json.rowCount).toBe(1);
      const cntIdx = result.json.columns.indexOf("cnt");
      expect(result.json.rows[0][cntIdx]).toBeGreaterThanOrEqual(3);
    });

    test("empty result returns rowCount 0", async () => {
      const result = await tc("duckdb", "query", `SELECT * FROM ${TABLE} WHERE id = 999`);
      expect(result.exitCode).toBe(0);
      expect(result.json.rowCount).toBe(0);
      expect(result.json.rows).toHaveLength(0);
    });
  });

  describe("describe", () => {
    test("returns tables and views", async () => {
      const result = await tc("duckdb", "describe");
      expect(result.exitCode).toBe(0);
      expect(result.json).toHaveProperty("tables");
      expect(result.json).toHaveProperty("views");
      expect(Array.isArray(result.json.tables)).toBe(true);
      expect(Array.isArray(result.json.views)).toBe(true);
    });

    test("table has name and columns", async () => {
      const result = await tc("duckdb", "describe");
      expect(result.exitCode).toBe(0);
      const table = result.json.tables.find((t: any) => t.name === TABLE);
      expect(table).toBeDefined();
      expect(Array.isArray(table.columns)).toBe(true);
      expect(table.columns.length).toBeGreaterThanOrEqual(3);
    });

    test("column has name, type, nullable", async () => {
      const result = await tc("duckdb", "describe");
      expect(result.exitCode).toBe(0);
      const table = result.json.tables.find((t: any) => t.name === TABLE);
      const idCol = table.columns.find((c: any) => c.name === "id");
      expect(idCol).toHaveProperty("name");
      expect(idCol).toHaveProperty("type");
      expect(idCol).toHaveProperty("nullable");
    });

    test("describe with --db targets named database", async () => {
      const dbName = `cli_test_describe_${Date.now()}`;
      // Create a table in a named db first
      await tc("duckdb", "execute", "--db", dbName,
        `CREATE TABLE test_tbl (x INTEGER)`);

      const result = await tc("duckdb", "describe", "--db", dbName);
      expect(result.exitCode).toBe(0);
      const table = result.json.tables.find((t: any) => t.name === "test_tbl");
      expect(table).toBeDefined();

      // Cleanup
      await node.duckdb.db(dbName).execute("DROP TABLE IF EXISTS test_tbl");
    });
  });

  // NOTE: export/import tests are skipped — the local dev server returns 404 for database export.
  // These should be enabled when testing against a server that supports export/import.
  // describe("export", () => { ... });
  // describe("import", () => { ... });
});
