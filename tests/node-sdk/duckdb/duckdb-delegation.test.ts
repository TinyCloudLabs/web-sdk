import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { checkServerHealth, createClient, TEST_KEY } from "../setup";
import type { TinyCloudNode } from "@tinycloud/node-sdk";

const TABLE = `sdk_test_deleg_duck_${Date.now()}`;
const NAMED_DB = "deleg_test_db";
const NAMED_DB_TABLE = `sdk_test_deleg_duck_named_${Date.now()}`;

describe("DuckDB Delegation", () => {
  let alice: TinyCloudNode;

  beforeAll(async () => {
    await checkServerHealth();
    alice = createClient("alice-duck-deleg", TEST_KEY);
    await alice.signIn();
    console.log("[Setup] Alice signed in, DID:", alice.did);

    // Create table and insert baseline data
    await alice.duckdb.execute(
      `CREATE TABLE IF NOT EXISTS ${TABLE} (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, value DOUBLE)`
    );
    await alice.duckdb.execute(
      `INSERT INTO ${TABLE} (id, name, value) VALUES (1, 'Alpha', 10.0)`
    );
    await alice.duckdb.execute(
      `INSERT INTO ${TABLE} (id, name, value) VALUES (2, 'Beta', 20.0)`
    );
    console.log("[Setup] Table created and seeded");
  });

  afterAll(async () => {
    await alice.duckdb.execute(`DROP TABLE IF EXISTS ${TABLE}`);
    await alice.duckdb.db(NAMED_DB).execute(`DROP TABLE IF EXISTS ${NAMED_DB_TABLE}`);
    console.log("[Cleanup] Tables dropped");
  });

  // PART 1: Read-Only Delegation
  describe("Read-Only Delegation", () => {
    let bob: TinyCloudNode;
    let access: TinyCloudNode;

    beforeAll(async () => {
      bob = createClient("bob-duck-deleg");
      await bob.signIn();
      console.log("[Delegation] Bob signed in, DID:", bob.did);

      const delegation = await alice.createDelegation({
        path: "",
        actions: ["tinycloud.duckdb/read"],
        delegateDID: bob.did,
      });
      console.log("[Delegation] Created read-only delegation:", delegation.cid);

      access = await bob.useDelegation(delegation);
    });

    test("bob can query Alice's table via read delegation", async () => {
      const result = await access.duckdb.query(`SELECT * FROM ${TABLE} ORDER BY id`);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.rowCount).toBeGreaterThanOrEqual(2);
        expect(result.data.columns).toContain("id");
        expect(result.data.columns).toContain("name");
        expect(result.data.columns).toContain("value");
      }
    });

    test("bob write attempt via read delegation is denied", async () => {
      const result = await access.duckdb.execute(
        `INSERT INTO ${TABLE} (id, name, value) VALUES (99, 'Hacker', 0.0)`
      );
      expect(result.ok).toBe(false);
    });
  });

  // PART 2: Write Delegation
  describe("Write Delegation", () => {
    let bob2: TinyCloudNode;
    let access: TinyCloudNode;

    beforeAll(async () => {
      bob2 = createClient("bob2-duck-deleg");
      await bob2.signIn();
      console.log("[Delegation] Bob2 signed in, DID:", bob2.did);

      const delegation = await alice.createDelegation({
        path: "",
        actions: ["tinycloud.duckdb/read", "tinycloud.duckdb/write"],
        delegateDID: bob2.did,
      });
      console.log("[Delegation] Created read+write delegation:", delegation.cid);

      access = await bob2.useDelegation(delegation);
    });

    test("bob2 can INSERT into Alice's table via write delegation", async () => {
      const result = await access.duckdb.execute(
        `INSERT INTO ${TABLE} (id, name, value) VALUES (10, 'Gamma', 30.0)`
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.changes).toBe(1);
      }
    });

    test("bob2 can UPDATE via write delegation", async () => {
      const result = await access.duckdb.execute(
        `UPDATE ${TABLE} SET value = 35.0 WHERE id = 10`
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.changes).toBe(1);
      }
    });

    test("alice can verify bob2's writes", async () => {
      const result = await alice.duckdb.query(
        `SELECT * FROM ${TABLE} WHERE id = $1`, [10]
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.rowCount).toBe(1);
        const nameIdx = result.data.columns.indexOf("name");
        const valueIdx = result.data.columns.indexOf("value");
        expect(result.data.rows[0][nameIdx]).toBe("Gamma");
        expect(result.data.rows[0][valueIdx]).toBe(35.0);
      }
    });
  });

  // PART 3: Named Database Delegation
  describe("Named Database Delegation", () => {
    let bob3: TinyCloudNode;
    let access: TinyCloudNode;

    beforeAll(async () => {
      // Alice creates data in a named db
      await alice.duckdb.db(NAMED_DB).execute(
        `CREATE TABLE IF NOT EXISTS ${NAMED_DB_TABLE} (id INTEGER PRIMARY KEY, label VARCHAR)`
      );
      await alice.duckdb.db(NAMED_DB).execute(
        `INSERT INTO ${NAMED_DB_TABLE} (id, label) VALUES (1, 'named_entry')`
      );
      console.log("[Setup] Named db table created and seeded");

      bob3 = createClient("bob3-duck-deleg");
      await bob3.signIn();
      console.log("[Delegation] Bob3 signed in, DID:", bob3.did);

      const delegation = await alice.createDelegation({
        path: "",
        actions: ["tinycloud.duckdb/read"],
        delegateDID: bob3.did,
      });
      console.log("[Delegation] Created named db read delegation:", delegation.cid);

      access = await bob3.useDelegation(delegation);
    });

    test("bob3 can query the named database via delegation", async () => {
      const result = await access.duckdb.db(NAMED_DB).query(
        `SELECT * FROM ${NAMED_DB_TABLE}`
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.rowCount).toBe(1);
        const labelIdx = result.data.columns.indexOf("label");
        expect(result.data.rows[0][labelIdx]).toBe("named_entry");
      }
    });
  });
});
