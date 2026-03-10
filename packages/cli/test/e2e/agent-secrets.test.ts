/**
 * E2E tests for the agent secret access flow (delegated vault).
 *
 * Tests the full lifecycle:
 *   1. Agent unlocks vault (publishes X25519 public key to public space)
 *   2. Admin stores a secret
 *   3. Admin grants vault access to agent's DID
 *   4. Admin creates delegation for agent
 *   5. Agent fetches the shared secret using delegation + get-shared
 *
 * Two-user test using Hardhat accounts #0 (admin) and #1 (agent).
 *
 * Requires: tinycloud-node running on localhost:8000
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  tc,
  setupTestProfile,
  cleanupProfile,
  ensureTestSpace,
  uniqueKey,
  NODE_AVAILABLE,
  TEST_PRIVATE_KEY,
  AGENT_PRIVATE_KEY,
  LOCAL_HOST,
} from "../helpers";

let adminHome: string;
let agentHome: string;
let adminDid: string;
let agentDid: string;

/**
 * Derive the primary DID for a private key by signing in via the SDK.
 */
async function deriveDid(privateKey: string): Promise<string> {
  const { TinyCloudNode } = await import("@tinycloud/node-sdk");
  const node = new TinyCloudNode({
    host: LOCAL_HOST,
    privateKey,
    autoCreateSpace: true,
  });
  await node.signIn();
  return node.did;
}

describe.skipIf(!NODE_AVAILABLE)("agent secret access (delegated vault)", () => {
  beforeAll(async () => {
    // Create separate profiles for admin and agent
    adminHome = await setupTestProfile("admin");
    agentHome = await setupTestProfile("agent");

    // Ensure both spaces exist
    await ensureTestSpace(TEST_PRIVATE_KEY, LOCAL_HOST);
    await ensureTestSpace(AGENT_PRIVATE_KEY, LOCAL_HOST);

    // Derive DIDs
    adminDid = await deriveDid(TEST_PRIVATE_KEY);
    agentDid = await deriveDid(AGENT_PRIVATE_KEY);

    // Agent must unlock vault to publish X25519 public key
    await tc(["vault", "unlock"], {
      tempHome: agentHome,
      privateKey: AGENT_PRIVATE_KEY,
    });
  }, 60_000);

  afterAll(async () => {
    if (adminHome) await cleanupProfile(adminHome);
    if (agentHome) await cleanupProfile(agentHome);
  });

  // =========================================================================
  // Vault Grant Lifecycle (no delegation needed)
  // =========================================================================

  test("admin stores secret and grants vault access to agent", async () => {
    const key = uniqueKey("agent-grant");
    const value = `shared-secret-${Date.now()}`;

    // Admin stores a secret
    const putResult = await tc(["secrets", "put", key, value], {
      tempHome: adminHome,
    });
    expect(putResult.exitCode).toBe(0);
    expect((putResult.json() as any).written).toBe(true);

    // Admin grants vault access to agent
    const grantResult = await tc(
      ["vault", "grant", `secrets/${key}`, "--to", agentDid],
      { tempHome: adminHome },
    );
    expect(grantResult.exitCode).toBe(0);
    const grantData = grantResult.json() as {
      key: string;
      grantedTo: string;
      granted: boolean;
    };
    expect(grantData.granted).toBe(true);
    expect(grantData.grantedTo).toBe(agentDid);
  });

  test("admin can list grants for a secret", async () => {
    const key = uniqueKey("agent-list-grants");
    const value = "list-grants-test";

    await tc(["secrets", "put", key, value], { tempHome: adminHome });
    await tc(["vault", "grant", `secrets/${key}`, "--to", agentDid], {
      tempHome: adminHome,
    });

    const listResult = await tc(["vault", "list-grants", `secrets/${key}`], {
      tempHome: adminHome,
    });
    expect(listResult.exitCode).toBe(0);
    const listData = listResult.json() as {
      key: string;
      grants: string[];
      count: number;
    };
    expect(listData.grants).toContain(agentDid);
    expect(listData.count).toBeGreaterThanOrEqual(1);
  });

  test("admin can revoke vault grant from agent", async () => {
    const key = uniqueKey("agent-revoke");
    const value = "revoke-test";

    await tc(["secrets", "put", key, value], { tempHome: adminHome });
    await tc(["vault", "grant", `secrets/${key}`, "--to", agentDid], {
      tempHome: adminHome,
    });

    const revokeResult = await tc(
      ["vault", "revoke", `secrets/${key}`, "--from", agentDid],
      { tempHome: adminHome },
    );
    expect(revokeResult.exitCode).toBe(0);
    const revokeData = revokeResult.json() as {
      key: string;
      revokedFrom: string;
      revoked: boolean;
    };
    expect(revokeData.revoked).toBe(true);
    expect(revokeData.revokedFrom).toBe(agentDid);
  });

  test("grant fails for nonexistent key", async () => {
    const key = uniqueKey("agent-nokey");
    const result = await tc(
      ["vault", "grant", `secrets/${key}`, "--to", agentDid],
      { tempHome: adminHome },
    );
    expect(result.exitCode).not.toBe(0);
  });

  test("get-shared requires delegation token", async () => {
    const result = await tc(
      ["vault", "get-shared", adminDid, "secrets/any-key"],
      { tempHome: agentHome, privateKey: AGENT_PRIVATE_KEY },
    );
    expect(result.exitCode).not.toBe(0);
    const stderr = result.stderr + result.stdout;
    expect(stderr).toContain("delegation");
  });

  // =========================================================================
  // Full Delegation Flow
  // =========================================================================

  test(
    "full flow: admin stores → grants → delegates → agent fetches",
    async () => {
      const key = uniqueKey("agent-e2e");
      const secretValue = `e2e-secret-${Date.now()}`;

      // Step 1: Admin stores a secret
      const putResult = await tc(["secrets", "put", key, secretValue], {
        tempHome: adminHome,
      });
      expect(putResult.exitCode).toBe(0);

      // Step 2: Admin grants vault access to agent
      const grantResult = await tc(
        ["vault", "grant", `secrets/${key}`, "--to", agentDid],
        { tempHome: adminHome },
      );
      expect(grantResult.exitCode).toBe(0);

      // Step 3: Admin creates delegation for agent
      const delegResult = await tc(
        [
          "delegation",
          "create",
          "--to",
          agentDid,
          "--path",
          "",
          "--actions",
          "kv/get,kv/list",
          "--expiry",
          "1h",
        ],
        { tempHome: adminHome },
      );
      expect(delegResult.exitCode).toBe(0);

      const delegData = delegResult.json() as {
        cid: string;
        delegateDid: string;
        serialized?: string;
      };
      expect(delegData.cid).toBeTruthy();

      const delegationJson = delegData.serialized ?? JSON.stringify(delegData);

      // Step 4: Agent fetches shared secret using delegation
      const getResult = await tc(
        [
          "vault",
          "get-shared",
          adminDid,
          `secrets/${key}`,
          "--delegation",
          delegationJson,
        ],
        { tempHome: agentHome, privateKey: AGENT_PRIVATE_KEY },
      );
      expect(getResult.exitCode).toBe(0);

      const getData = getResult.json() as { key: string; data: unknown };
      expect(getData.key).toBe(`secrets/${key}`);

      // Verify the decrypted data contains our secret
      const data = getData.data as any;
      const extractedValue =
        typeof data === "object" && data !== null ? data.value : data;
      expect(extractedValue).toBe(secretValue);
    },
    60_000,
  );

  test(
    "agent cannot access secret without vault grant (only delegation)",
    async () => {
      const key = uniqueKey("agent-no-grant");
      const value = "no-grant-test";

      // Admin stores secret but does NOT grant vault access
      await tc(["secrets", "put", key, value], { tempHome: adminHome });

      // Admin creates delegation (KV access only, no vault grant)
      const delegResult = await tc(
        [
          "delegation",
          "create",
          "--to",
          agentDid,
          "--path",
          "",
          "--actions",
          "kv/get,kv/list",
          "--expiry",
          "1h",
        ],
        { tempHome: adminHome },
      );
      expect(delegResult.exitCode).toBe(0);
      const delegData = delegResult.json() as any;
      const delegationJson = delegData.serialized ?? JSON.stringify(delegData);

      // Agent tries to fetch — should fail (no vault grant)
      const getResult = await tc(
        [
          "vault",
          "get-shared",
          adminDid,
          `secrets/${key}`,
          "--delegation",
          delegationJson,
        ],
        { tempHome: agentHome, privateKey: AGENT_PRIVATE_KEY },
      );
      expect(getResult.exitCode).not.toBe(0);
    },
    60_000,
  );

  test(
    "agent cannot access after vault grant is revoked",
    async () => {
      const key = uniqueKey("agent-revoked");
      const value = "revoked-test";

      // Admin stores + grants
      await tc(["secrets", "put", key, value], { tempHome: adminHome });
      await tc(["vault", "grant", `secrets/${key}`, "--to", agentDid], {
        tempHome: adminHome,
      });

      // Admin revokes vault access
      await tc(["vault", "revoke", `secrets/${key}`, "--from", agentDid], {
        tempHome: adminHome,
      });

      // Create delegation (access control is separate from vault grant)
      const delegResult = await tc(
        [
          "delegation",
          "create",
          "--to",
          agentDid,
          "--path",
          "",
          "--actions",
          "kv/get,kv/list",
          "--expiry",
          "1h",
        ],
        { tempHome: adminHome },
      );
      expect(delegResult.exitCode).toBe(0);
      const delegData = delegResult.json() as any;
      const delegationJson = delegData.serialized ?? JSON.stringify(delegData);

      // Agent tries to fetch — should fail (grant was revoked, key rotated)
      const getResult = await tc(
        [
          "vault",
          "get-shared",
          adminDid,
          `secrets/${key}`,
          "--delegation",
          delegationJson,
        ],
        { tempHome: agentHome, privateKey: AGENT_PRIVATE_KEY },
      );
      expect(getResult.exitCode).not.toBe(0);
    },
    60_000,
  );
});
