import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { checkServerHealth, createClient, TEST_KEY } from "../setup";
import type { TinyCloudNode } from "@tinycloud/node-sdk";

const EXPORT_DB = `sdk_test_export_${Date.now()}`;
const IMPORT_DB = `sdk_test_import_${Date.now()}`;
const ROUNDTRIP_DB = `sdk_test_roundtrip_${Date.now()}`;
const TABLE = `test_data`;

describe("DuckDB Export/Import", () => {
  let alice: TinyCloudNode;

  beforeAll(async () => {
    await checkServerHealth();
    alice = createClient("alice-export", TEST_KEY);
    await alice.signIn();
    console.log("[Setup] Alice signed in, DID:", alice.did);

    // Create table and insert data in export db
    const db = alice.duckdb.db(EXPORT_DB);
    await db.execute(`CREATE TABLE ${TABLE} (id INTEGER PRIMARY KEY, name VARCHAR, value DOUBLE)`);
    await db.execute(`INSERT INTO ${TABLE} VALUES (1, 'alpha', 1.1)`);
    await db.execute(`INSERT INTO ${TABLE} VALUES (2, 'beta', 2.2)`);
    await db.execute(`INSERT INTO ${TABLE} VALUES (3, 'gamma', 3.3)`);
    console.log("[Setup] Test data created in", EXPORT_DB);
  });

  afterAll(async () => {
    await alice.duckdb.db(EXPORT_DB).execute(`DROP TABLE IF EXISTS ${TABLE}`);
    console.log("[Cleanup] Export db cleaned");
  });

  // PART 1: Export
  describe("Export", () => {
    test("export returns a Blob", async () => {
      const result = await alice.duckdb.db(EXPORT_DB).export();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBeInstanceOf(Blob);
      }
    });

    test("exported Blob is non-empty", async () => {
      const result = await alice.duckdb.db(EXPORT_DB).export();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.size).toBeGreaterThan(0);
        console.log("[Export] Blob size:", result.data.size, "bytes");
      }
    });
  });

  // PART 2: Import
  describe("Import", () => {
    test("import valid DuckDB bytes succeeds", async () => {
      const exportResult = await alice.duckdb.db(EXPORT_DB).export();
      expect(exportResult.ok).toBe(true);
      if (!exportResult.ok) return;

      const blob = exportResult.data;
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      const importResult = await alice.duckdb.db(IMPORT_DB).import(bytes);
      expect(importResult.ok).toBe(true);
    });

    test("query after import returns expected data", async () => {
      const result = await alice.duckdb.db(IMPORT_DB).query(`SELECT * FROM ${TABLE} ORDER BY id`);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const data = result.data as { columns: string[]; rows: any[][]; rowCount: number };
        expect(data.rowCount).toBe(3);
        const nameIdx = data.columns.indexOf("name");
        expect(data.rows[0][nameIdx]).toBe("alpha");
        expect(data.rows[1][nameIdx]).toBe("beta");
        expect(data.rows[2][nameIdx]).toBe("gamma");
      }
    });

    test("import invalid bytes returns error (not crash)", async () => {
      const invalidBytes = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
      const invalidDb = `sdk_test_invalid_${Date.now()}`;
      const result = await alice.duckdb.db(invalidDb).import(invalidBytes);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeDefined();
        console.log("[Import] Invalid bytes error:", result.error.message);
      }
    });
  });

  // PART 3: Round-Trip
  describe("Round-Trip", () => {
    test("export from db A, import as db B, query B matches A", async () => {
      // Query original data
      const originalResult = await alice.duckdb.db(EXPORT_DB).query(`SELECT * FROM ${TABLE} ORDER BY id`);
      expect(originalResult.ok).toBe(true);
      if (!originalResult.ok) return;
      const originalData = originalResult.data as { columns: string[]; rows: any[][]; rowCount: number };

      // Export
      const exportResult = await alice.duckdb.db(EXPORT_DB).export();
      expect(exportResult.ok).toBe(true);
      if (!exportResult.ok) return;

      // Import into new db
      const blob = exportResult.data;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const importResult = await alice.duckdb.db(ROUNDTRIP_DB).import(bytes);
      expect(importResult.ok).toBe(true);
      if (!importResult.ok) return;

      // Query imported data
      const importedResult = await alice.duckdb.db(ROUNDTRIP_DB).query(`SELECT * FROM ${TABLE} ORDER BY id`);
      expect(importedResult.ok).toBe(true);
      if (!importedResult.ok) return;
      const importedData = importedResult.data as { columns: string[]; rows: any[][]; rowCount: number };

      // Compare
      expect(importedData.columns).toEqual(originalData.columns);
      expect(importedData.rowCount).toBe(originalData.rowCount);
      expect(importedData.rows).toEqual(originalData.rows);
      console.log("[Round-Trip] Data matches between export and import");
    });
  });
});
