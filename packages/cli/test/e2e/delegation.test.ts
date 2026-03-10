/**
 * E2E tests for `tc delegation` commands against a local tinycloud-node.
 *
 * NOTE: The local tinycloud-node does not currently implement delegation
 * CRUD operations via /invoke (only /delegate for creation). These tests
 * verify the CLI command structure and error handling, but delegation
 * operations will return errors from the server.
 *
 * Requires: tinycloud-node running on localhost:8000
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  tc,
  setupTestProfile,
  cleanupProfile,
  NODE_AVAILABLE,
} from "../helpers";

let tempHome: string;

/**
 * Check if the delegation service is available on the local node.
 * Returns true only if delegation list succeeds (server supports it).
 */
async function isDelegationServiceAvailable(home: string): Promise<boolean> {
  try {
    const result = await tc(["delegation", "list"], { tempHome: home });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

let delegationAvailable = false;

describe.skipIf(!NODE_AVAILABLE)("tc delegation", () => {
  beforeAll(async () => {
    tempHome = await setupTestProfile();
    delegationAvailable = await isDelegationServiceAvailable(tempHome);
    if (!delegationAvailable) {
      console.warn(
        "⚠ Delegation service not available on local node — delegation CRUD tests will be skipped",
      );
    }
  });

  afterAll(async () => {
    if (tempHome) await cleanupProfile(tempHome);
  });

  test("delegation commands exist in CLI", async () => {
    // Verify the command structure exists (help doesn't require server)
    const result = await tc(["delegation", "--help"], { tempHome });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("create");
    expect(result.stdout).toContain("list");
    expect(result.stdout).toContain("info");
    expect(result.stdout).toContain("revoke");
  });

  test("create requires --to, --path, and --actions", async () => {
    // Missing required options should fail
    const result = await tc(["delegation", "create"], { tempHome });
    expect(result.exitCode).not.toBe(0);
  });

  test("info requires a cid argument", async () => {
    const result = await tc(["delegation", "info"], { tempHome });
    expect(result.exitCode).not.toBe(0);
  });

  test("revoke requires a cid argument", async () => {
    const result = await tc(["delegation", "revoke"], { tempHome });
    expect(result.exitCode).not.toBe(0);
  });

  test.skipIf(!delegationAvailable)("list returns delegations array", async () => {
    const result = await tc(["delegation", "list"], { tempHome });
    expect(result.exitCode).toBe(0);

    const data = result.json() as { delegations: unknown[]; count: number };
    expect(data).toHaveProperty("delegations");
    expect(data).toHaveProperty("count");
    expect(Array.isArray(data.delegations)).toBe(true);
  });

  test.skipIf(!delegationAvailable)("create delegation with path and actions", async () => {
    const recipientDid = "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK";

    const result = await tc(
      [
        "delegation",
        "create",
        "--to",
        recipientDid,
        "--path",
        "/e2e-test",
        "--actions",
        "kv/get,kv/list",
        "--expiry",
        "1h",
      ],
      { tempHome },
    );
    expect(result.exitCode).toBe(0);

    const data = result.json() as {
      cid: string;
      delegateDid: string;
      path: string;
      actions: string[];
      expiry: string;
    };
    expect(data).toHaveProperty("cid");
    expect(data.delegateDid).toBe(recipientDid);
    expect(data.path).toBe("/e2e-test");
    expect(data.actions).toContain("tinycloud.kv/get");
    expect(data.actions).toContain("tinycloud.kv/list");
  });

  test.skipIf(!delegationAvailable)("create + revoke delegation", async () => {
    const recipientDid = "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK";

    const createResult = await tc(
      [
        "delegation",
        "create",
        "--to",
        recipientDid,
        "--path",
        "/e2e-revoke",
        "--actions",
        "kv/get",
        "--expiry",
        "1h",
      ],
      { tempHome },
    );
    expect(createResult.exitCode).toBe(0);
    const created = createResult.json() as { cid: string };

    const revokeResult = await tc(["delegation", "revoke", created.cid], { tempHome });
    expect(revokeResult.exitCode).toBe(0);
    const revokeData = revokeResult.json() as { cid: string; revoked: boolean };
    expect(revokeData.cid).toBe(created.cid);
    expect(revokeData.revoked).toBe(true);
  });

  test.skipIf(!delegationAvailable)("list --granted filters to my delegations", async () => {
    const result = await tc(["delegation", "list", "--granted"], { tempHome });
    expect(result.exitCode).toBe(0);

    const data = result.json() as { delegations: unknown[]; count: number };
    expect(data).toHaveProperty("delegations");
    expect(data).toHaveProperty("count");
  });

  test.skipIf(!delegationAvailable)("actions are auto-prefixed with tinycloud.", async () => {
    const recipientDid = "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK";

    const result = await tc(
      [
        "delegation",
        "create",
        "--to",
        recipientDid,
        "--path",
        "/e2e-prefix",
        "--actions",
        "kv/get,kv/put",
        "--expiry",
        "1h",
      ],
      { tempHome },
    );
    expect(result.exitCode).toBe(0);
    const data = result.json() as { actions: string[] };
    for (const action of data.actions) {
      expect(action.startsWith("tinycloud.")).toBe(true);
    }
  });
});
