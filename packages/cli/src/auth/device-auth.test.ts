import { describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { generateKey } from "./local-key.js";
import { acquireShareDeviceDelegation, SHARE_DEVICE_PERMISSIONS } from "./device-auth.js";

function response(value: unknown, status = 200): Response {
  return Response.json(value, { status });
}

describe("Share device authorization client", () => {
  test("never sends private key material and accepts only the requested relay binding", async () => {
    const { jwk, did } = generateKey();
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    let startBody: Record<string, unknown> | undefined;
    const transactionId = randomBytes(18).toString("base64url");
    const fetchFn = Object.assign(async (url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      requests.push({ url: String(url), body });
      if (String(url).endsWith("/api/device-authorizations")) {
        startBody = body;
        return response({
          transactionId,
          userCode: "ABCD-EFGH",
          verificationUri: "https://openkey.so/device",
          verificationUriComplete: "https://openkey.so/device?user_code=ABCD-EFGH",
          expiresIn: 600,
          interval: 2,
        }, 201);
      }
      const publicJwk = startBody!.publicJwk as object;
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000 - 1000).toISOString();
      return response({
        status: "approved",
        delegation: {
          delegationHeader: { Authorization: "Bearer encrypted-relay-result" },
          delegationCid: "bafy-device-client-test",
          spaceId: "tinycloud:pkh:eip155:1:0x1111111111111111111111111111111111111111:applications",
          verificationMethod: did,
          jwk: publicJwk,
          expiresAt,
        },
        binding: {
          transactionId,
          sessionDid: did,
          nodeOrigin: "https://node.tinycloud.xyz",
          shareOrigin: "https://share.tinycloud.xyz",
          permissions: SHARE_DEVICE_PERMISSIONS,
          delegationExpiresAt: expiresAt,
        },
      });
    }, { preconnect: () => undefined }) as typeof globalThis.fetch;

    const result = await acquireShareDeviceDelegation({
      sessionDid: did,
      jwk,
      nodeOrigin: "https://node.tinycloud.xyz",
      shareOrigin: "https://share.tinycloud.xyz",
      fetchFn,
      emitInstructions: () => undefined,
      wait: async () => undefined,
    });
    expect(result.delegationCid).toBe("bafy-device-client-test");
    expect(requests).toHaveLength(2);
    expect(JSON.stringify(requests[0]!.body)).not.toContain(`\"d\"`);
    expect(requests[0]!.body.permissions).toEqual(SHARE_DEVICE_PERMISSIONS);
    expect(requests[1]!.body.deviceSecret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(requests[1]!.body.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  test("rejects a relay result bound to another Share origin", async () => {
    const { jwk, did } = generateKey();
    let calls = 0;
    const fetchFn = Object.assign(async () => {
      calls += 1;
      if (calls === 1) return response({
        transactionId: randomBytes(18).toString("base64url"),
        userCode: "JKLM-NPQR",
        verificationUri: "https://openkey.so/device",
        verificationUriComplete: "https://openkey.so/device?user_code=JKLM-NPQR",
        expiresIn: 600,
        interval: 2,
      }, 201);
      const publicJwk = Object.fromEntries(Object.entries(jwk).filter(([key]) => key !== "d"));
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString();
      return response({
        status: "approved",
        delegation: {
          delegationHeader: { Authorization: "Bearer wrong-binding" },
          delegationCid: "bafy-wrong-binding",
          spaceId: "tinycloud:pkh:eip155:1:0x1111111111111111111111111111111111111111:applications",
          verificationMethod: did,
          jwk: publicJwk,
          expiresAt,
        },
        binding: {
          transactionId: "wrong-transaction",
          sessionDid: did,
          nodeOrigin: "https://node.tinycloud.xyz",
          shareOrigin: "https://attacker.example",
          permissions: SHARE_DEVICE_PERMISSIONS,
          delegationExpiresAt: expiresAt,
        },
      });
    }, { preconnect: () => undefined }) as typeof globalThis.fetch;

    await expect(acquireShareDeviceDelegation({
      sessionDid: did,
      jwk,
      nodeOrigin: "https://node.tinycloud.xyz",
      shareOrigin: "https://share.tinycloud.xyz",
      fetchFn,
      emitInstructions: () => undefined,
      wait: async () => undefined,
    })).rejects.toThrow(/wrong device binding/);
  });
});
