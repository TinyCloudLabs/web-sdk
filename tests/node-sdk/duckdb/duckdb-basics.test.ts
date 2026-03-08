import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { checkServerHealth, createClient, TEST_KEY } from "../setup";
import type { TinyCloudNode } from "@tinycloud/node-sdk";

const TABLE = `sdk_test_duck_items_${Date.now()}`;
const TYPES_TABLE = `sdk_test_duck_types_${Date.now()}`;
const VIEW_NAME = `sdk_test_duck_view_${Date.now()}`;
const INDEX_NAME = `sdk_test_duck_idx_${Date.now()}`;

describe("DuckDB Basics", () => {
  let alice: TinyCloudNode;

  beforeAll(async () => {
    await checkServerHealth();
    alice = createClient("alice-duck", TEST_KEY);
    await alice.signIn();
    console.log("[Setup] Alice signed in, DID:", alice.did);
  });

  afterAll(async () => {
    await alice.duckdb.execute(`DROP INDEX IF EXISTS ${INDEX_NAME}`);
    await alice.duckdb.execute(`DROP VIEW IF EXISTS ${VIEW_NAME}`);
    await alice.duckdb.execute(`DROP TABLE IF EXISTS ${TYPES_TABLE}`);
    await alice.duckdb.execute(`DROP TABLE IF EXISTS ${TABLE}`);
    console.log("[Cleanup] Tables dropped");
  });

  // PART 1: Schema & Writes
  describe("Schema & Writes", () => {
    test("CREATE TABLE succeeds", async () => {
      const result = await alice.duckdb.execute(
        `CREATE TABLE ${TABLE} (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, email VARCHAR, price DOUBLE, active BOOLEAN DEFAULT true)`
      );
      expect(result.ok).toBe(true);
    });

    test("INSERT returns changes: 1", async () => {
      const result = await alice.duckdb.execute(
        `INSERT INTO ${TABLE} (id, name, email, price, active) VALUES (1, 'Widget', 'sales@example.com', 29.99, true)`
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.changes).toBe(1);
      }
    });

    test("execute response has changes field (no lastInsertRowId)", async () => {
      const result = await alice.duckdb.execute(
        `INSERT INTO ${TABLE} (id, name, email, price) VALUES (2, 'Gadget', 'info@example.com', 49.99)`
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveProperty("changes");
        expect(result.data).not.toHaveProperty("lastInsertRowId");
      }
    });

    test("UPDATE returns correct changes", async () => {
      const result = await alice.duckdb.execute(
        `UPDATE ${TABLE} SET price = 34.99 WHERE id = 1`
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.changes).toBe(1);
      }
    });

    test("DELETE returns correct changes", async () => {
      // Insert then delete
      await alice.duckdb.execute(
        `INSERT INTO ${TABLE} (id, name, price) VALUES (99, 'ToDelete', 0.01)`
      );
      const result = await alice.duckdb.execute(`DELETE FROM ${TABLE} WHERE id = 99`);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.changes).toBe(1);
      }
    });

    test("CREATE VIEW succeeds", async () => {
      const result = await alice.duckdb.execute(
        `CREATE VIEW ${VIEW_NAME} AS SELECT id, name FROM ${TABLE} WHERE active = true`
      );
      expect(result.ok).toBe(true);
    });

    test("CREATE INDEX succeeds", async () => {
      const result = await alice.duckdb.execute(
        `CREATE INDEX ${INDEX_NAME} ON ${TABLE} (name)`
      );
      expect(result.ok).toBe(true);
    });
  });

  // PART 2: Queries
  describe("Queries", () => {
    test("SELECT * returns columns, rows, rowCount", async () => {
      const result = await alice.duckdb.query(`SELECT * FROM ${TABLE} ORDER BY id`);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const data = result.data as { columns: string[]; rows: any[][]; rowCount: number };
        expect(data.columns).toContain("id");
        expect(data.columns).toContain("name");
        expect(data.rowCount).toBeGreaterThanOrEqual(2);
        expect(data.rows.length).toBe(data.rowCount);
      }
    });

    test("WHERE clause filters correctly", async () => {
      const result = await alice.duckdb.query(`SELECT * FROM ${TABLE} WHERE name = 'Widget'`);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const data = result.data as { columns: string[]; rows: any[][]; rowCount: number };
        expect(data.rowCount).toBe(1);
      }
    });

    test("query with params binds correctly", async () => {
      const result = await alice.duckdb.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [2]);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const data = result.data as { columns: string[]; rows: any[][]; rowCount: number };
        expect(data.rowCount).toBe(1);
        const nameIdx = data.columns.indexOf("name");
        expect(data.rows[0][nameIdx]).toBe("Gadget");
      }
    });

    test("COUNT/SUM/AVG aggregates work", async () => {
      const result = await alice.duckdb.query(`SELECT COUNT(*) as cnt, SUM(price) as total, AVG(price) as avg_price FROM ${TABLE}`);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const data = result.data as { columns: string[]; rows: any[][]; rowCount: number };
        expect(data.rowCount).toBe(1);
        const cntIdx = data.columns.indexOf("cnt");
        expect(data.rows[0][cntIdx]).toBeGreaterThanOrEqual(2);
      }
    });

    test("ORDER BY + LIMIT + OFFSET paginates", async () => {
      // Insert a few more rows
      await alice.duckdb.execute(`INSERT INTO ${TABLE} (id, name, price) VALUES (3, 'Doohickey', 19.99)`);
      await alice.duckdb.execute(`INSERT INTO ${TABLE} (id, name, price) VALUES (4, 'Thingamajig', 9.99)`);

      const result = await alice.duckdb.query(`SELECT * FROM ${TABLE} ORDER BY price ASC LIMIT 2 OFFSET 1`);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const data = result.data as { columns: string[]; rows: any[][]; rowCount: number };
        expect(data.rowCount).toBe(2);
      }
    });

    test("CTE (WITH clause) works", async () => {
      const result = await alice.duckdb.query(
        `WITH expensive AS (SELECT * FROM ${TABLE} WHERE price > 20) SELECT COUNT(*) as cnt FROM expensive`
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        const data = result.data as { columns: string[]; rows: any[][]; rowCount: number };
        expect(data.rowCount).toBe(1);
      }
    });
  });

  // PART 3: Type Round-Trips
  describe("Type Round-Trips", () => {
    beforeAll(async () => {
      await alice.duckdb.execute(
        `CREATE TABLE ${TYPES_TABLE} (
          int_col INTEGER, bigint_col BIGINT, double_col DOUBLE,
          varchar_col VARCHAR, bool_col BOOLEAN,
          ts_col TIMESTAMP, null_col VARCHAR
        )`
      );
      await alice.duckdb.execute(
        `INSERT INTO ${TYPES_TABLE} VALUES (42, 9007199254740992, 3.14159, 'hello world', true, '2025-01-15 10:30:00', NULL)`
      );
    });

    test("INTEGER, BIGINT, DOUBLE round-trip", async () => {
      const result = await alice.duckdb.query(`SELECT int_col, bigint_col, double_col FROM ${TYPES_TABLE}`);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const data = result.data as { columns: string[]; rows: any[][]; rowCount: number };
        const row = data.rows[0];
        expect(row[0]).toBe(42);
        expect(typeof row[1]).toBe("number");
        expect(row[2]).toBeCloseTo(3.14159, 4);
      }
    });

    test("VARCHAR, BOOLEAN round-trip", async () => {
      const result = await alice.duckdb.query(`SELECT varchar_col, bool_col FROM ${TYPES_TABLE}`);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const data = result.data as { columns: string[]; rows: any[][]; rowCount: number };
        const row = data.rows[0];
        expect(row[0]).toBe("hello world");
        expect(row[1]).toBe(true);
      }
    });

    test("TIMESTAMP round-trips", async () => {
      const result = await alice.duckdb.query(`SELECT ts_col FROM ${TYPES_TABLE}`);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const data = result.data as { columns: string[]; rows: any[][]; rowCount: number };
        const tsValue = data.rows[0][0];
        expect(tsValue).toBeTruthy();
        // Timestamp should come back as a string or number representation
        expect(String(tsValue)).toContain("2025");
      }
    });

    test("NULL round-trips", async () => {
      const result = await alice.duckdb.query(`SELECT null_col FROM ${TYPES_TABLE}`);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const data = result.data as { columns: string[]; rows: any[][]; rowCount: number };
        expect(data.rows[0][0]).toBeNull();
      }
    });
  });

  // PART 4: Batch
  describe("Batch", () => {
    test("batch with DDL+DML executes in order", async () => {
      const batchTable = `sdk_test_duck_batch_${Date.now()}`;
      const result = await alice.duckdb.batch([
        { sql: `CREATE TABLE IF NOT EXISTS ${batchTable} (id INTEGER, val VARCHAR)` },
        { sql: `INSERT INTO ${batchTable} VALUES (1, 'one')` },
        { sql: `INSERT INTO ${batchTable} VALUES (2, 'two')` },
      ]);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.results).toHaveLength(3);
      }
      // Cleanup
      await alice.duckdb.execute(`DROP TABLE IF EXISTS ${batchTable}`);
    });

    test("batch returns results array", async () => {
      const result = await alice.duckdb.batch([
        { sql: `UPDATE ${TABLE} SET price = price + 1 WHERE id = 1` },
        { sql: `UPDATE ${TABLE} SET price = price + 1 WHERE id = 2` },
      ]);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(Array.isArray(result.data.results)).toBe(true);
        expect(result.data.results[0].changes).toBe(1);
        expect(result.data.results[1].changes).toBe(1);
      }
    });
  });
});
