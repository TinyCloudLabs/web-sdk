import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { checkServerHealth, setupCliProfile, tc } from "../setup";
import type { TinyCloudNode } from "@tinycloud/node-sdk";

const TABLE = `cli_test_sql_${Date.now()}`;

describe("tc sql", () => {
  let node: TinyCloudNode;

  beforeAll(async () => {
    await checkServerHealth();
    node = await setupCliProfile();
  });

  afterAll(async () => {
    await node.sql.execute(`DROP TABLE IF EXISTS ${TABLE}`);
    console.log("[Cleanup] Dropped table", TABLE);
  });

  describe("execute", () => {
    test("CREATE TABLE succeeds", async () => {
      const result = await tc(
        "sql", "execute",
        `CREATE TABLE IF NOT EXISTS ${TABLE} (id INTEGER PRIMARY KEY, name TEXT, score REAL)`,
      );
      expect(result.exitCode).toBe(0);
      expect(result.json).toHaveProperty("changes");
    });

    test("INSERT returns changes: 1", async () => {
      const result = await tc(
        "sql", "execute",
        `INSERT INTO ${TABLE} (id, name, score) VALUES (1, 'Alice', 95.5)`,
      );
      expect(result.exitCode).toBe(0);
      expect(result.json.changes).toBe(1);
      expect(result.json).toHaveProperty("lastInsertRowId");
    });

    test("INSERT with --params binds correctly", async () => {
      const result = await tc(
        "sql", "execute",
        `INSERT INTO ${TABLE} (id, name, score) VALUES (?, ?, ?)`,
        "--params", '[2, "Bob", 87.3]',
      );
      expect(result.exitCode).toBe(0);
      expect(result.json.changes).toBe(1);
    });

    test("UPDATE returns correct changes count", async () => {
      const result = await tc(
        "sql", "execute",
        `UPDATE ${TABLE} SET score = 96.0 WHERE id = 1`,
      );
      expect(result.exitCode).toBe(0);
      expect(result.json.changes).toBe(1);
    });
  });

  describe("query", () => {
    test("SELECT * returns columns, rows, rowCount", async () => {
      const result = await tc("sql", "query", `SELECT * FROM ${TABLE} ORDER BY id`);
      expect(result.exitCode).toBe(0);
      expect(result.json.columns).toContain("id");
      expect(result.json.columns).toContain("name");
      expect(result.json.columns).toContain("score");
      expect(result.json.rowCount).toBe(2);
      expect(result.json.rows).toHaveLength(2);
    });

    test("WHERE clause filters correctly", async () => {
      const result = await tc("sql", "query", `SELECT * FROM ${TABLE} WHERE name = 'Alice'`);
      expect(result.exitCode).toBe(0);
      expect(result.json.rowCount).toBe(1);
    });

    test("query with --params binds correctly", async () => {
      const result = await tc(
        "sql", "query",
        `SELECT * FROM ${TABLE} WHERE id = ?`,
        "--params", "[2]",
      );
      expect(result.exitCode).toBe(0);
      expect(result.json.rowCount).toBe(1);
      const nameIdx = result.json.columns.indexOf("name");
      expect(result.json.rows[0][nameIdx]).toBe("Bob");
    });

    test("empty result returns rowCount 0", async () => {
      const result = await tc("sql", "query", `SELECT * FROM ${TABLE} WHERE id = 999`);
      expect(result.exitCode).toBe(0);
      expect(result.json.rowCount).toBe(0);
      expect(result.json.rows).toHaveLength(0);
    });
  });

  describe("named database", () => {
    const namedTable = `cli_test_sql_named_${Date.now()}`;

    afterAll(async () => {
      await node.sql.db("cli-analytics").execute(`DROP TABLE IF EXISTS ${namedTable}`);
    });

    test("execute with --db targets named database", async () => {
      const result = await tc(
        "sql", "execute",
        "--db", "cli-analytics",
        `CREATE TABLE IF NOT EXISTS ${namedTable} (id INTEGER PRIMARY KEY, event TEXT)`,
      );
      expect(result.exitCode).toBe(0);
    });

    test("query with --db reads from named database", async () => {
      await tc(
        "sql", "execute",
        "--db", "cli-analytics",
        `INSERT INTO ${namedTable} (id, event) VALUES (1, 'page_view')`,
      );
      const result = await tc(
        "sql", "query",
        "--db", "cli-analytics",
        `SELECT * FROM ${namedTable}`,
      );
      expect(result.exitCode).toBe(0);
      expect(result.json.rowCount).toBe(1);
    });
  });

});
