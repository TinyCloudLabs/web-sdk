import { describe, expect, test } from "bun:test";
import { createCipheriv, createHmac, createPublicKey, diffieHellman, generateKeyPairSync, randomBytes } from "node:crypto";
import { generateKey } from "./local-key.js";
import { acquireShareDeviceDelegation, SHARE_DEVICE_PERMISSIONS } from "./device-auth.js";

function response(value: unknown, status = 200): Response {
  return Response.json(value, { status });
}

function encryptRelay(relayPublicJwk: object, transactionId: string, value: unknown) {
  const ephemeral = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const sharedSecret = diffieHellman({ privateKey: ephemeral.privateKey, publicKey: createPublicKey({ key: relayPublicJwk, format: "jwk" }) });
  const extracted = createHmac("sha256", Buffer.from(transactionId)).update(sharedSecret).digest();
  const key = createHmac("sha256", extracted).update(Buffer.from("openkey-device-relay-v1")).update(Buffer.from([1])).digest();
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(transactionId));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final(), cipher.getAuthTag()]);
  return {
    version: 1,
    algorithm: "ECDH-P256-A256GCM",
    ephemeralPublicJwk: ephemeral.publicKey.export({ format: "jwk" }),
    nonce: nonce.toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
  };
}

describe("Share device authorization client", () => {
  test("never sends private key material and accepts only the requested relay binding", async () => {
    const { jwk, did } = generateKey();
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    const instructions: Array<{ verificationUri: string; verificationUriComplete: string; userCode: string }> = [];
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
      const delegation = {
        delegationHeader: { Authorization: "Bearer encrypted-relay-result" },
        delegationCid: "bafy-device-client-test",
        spaceId: "tinycloud:pkh:eip155:1:0x1111111111111111111111111111111111111111:applications",
        verificationMethod: did,
        jwk: publicJwk,
        expiresAt,
        permissions: [{
          service: "capabilities",
          space: "tinycloud:pkh:eip155:1:0x1111111111111111111111111111111111111111:applications",
          path: "",
          actions: ["tinycloud.capabilities/read"],
        }],
      };
      return response({
        status: "approved",
        relay: encryptRelay(startBody!.relayPublicJwk as object, transactionId, delegation),
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
      emitInstructions: (value) => instructions.push(value),
      wait: async () => undefined,
    });
    expect(result.delegationCid).toBe("bafy-device-client-test");
    expect(requests).toHaveLength(2);
    expect(requests.map(({ url }) => url)).toEqual([
      "https://api.openkey.so/api/device-authorizations",
      "https://api.openkey.so/api/device-authorizations/token",
    ]);
    expect(instructions).toEqual([{
      verificationUri: "https://openkey.so/device",
      verificationUriComplete: "https://openkey.so/device?user_code=ABCD-EFGH",
      userCode: "ABCD-EFGH",
    }]);
    expect(JSON.stringify(requests[0]!.body)).not.toContain(`\"d\"`);
    expect(requests[0]!.body.permissions).toEqual(SHARE_DEVICE_PERMISSIONS);
    expect(requests[1]!.body.deviceSecret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(requests[1]!.body.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  test("preserves an explicit custom device API host for local deployments", async () => {
    const { jwk, did } = generateKey();
    const requests: string[] = [];
    const fetchFn = Object.assign(async (url: string | URL | Request) => {
      requests.push(String(url));
      if (requests.length === 1) {
        return response({
          transactionId: randomBytes(18).toString("base64url"),
          userCode: "CDEF-GHJK",
          verificationUri: "https://openkey.localhost/device",
          verificationUriComplete: "https://openkey.localhost/device?user_code=CDEF-GHJK",
          expiresIn: 600,
          interval: 2,
        }, 201);
      }
      return response({ error: "expired_token" }, 410);
    }, { preconnect: () => undefined }) as typeof globalThis.fetch;

    await expect(acquireShareDeviceDelegation({
      sessionDid: did,
      jwk,
      nodeOrigin: "https://node.tinycloud.xyz",
      shareOrigin: "https://share.tinycloud.xyz",
      openkeyHost: "https://openkey.localhost",
      fetchFn,
      emitInstructions: () => undefined,
      wait: async () => undefined,
    })).rejects.toThrow(/expired_token/);
    expect(requests).toEqual([
      "https://openkey.localhost/api/device-authorizations",
      "https://openkey.localhost/api/device-authorizations/token",
    ]);
  });

  test("rejects a relay result bound to another Share origin", async () => {
    const { jwk, did } = generateKey();
    let calls = 0;
    let relayPublicJwk: object | undefined;
    let transactionId = "";
    const fetchFn = Object.assign(async () => {
      calls += 1;
      if (calls === 1) {
        transactionId = randomBytes(18).toString("base64url");
        return response({
        transactionId,
        userCode: "JKLM-NPQR",
        verificationUri: "https://openkey.so/device",
        verificationUriComplete: "https://openkey.so/device?user_code=JKLM-NPQR",
        expiresIn: 600,
        interval: 2,
      }, 201);
      }
      const publicJwk = Object.fromEntries(Object.entries(jwk).filter(([key]) => key !== "d"));
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString();
      const delegation = {
        delegationHeader: { Authorization: "Bearer wrong-binding" },
        delegationCid: "bafy-wrong-binding",
        spaceId: "tinycloud:pkh:eip155:1:0x1111111111111111111111111111111111111111:applications",
        verificationMethod: did,
        jwk: publicJwk,
        expiresAt,
        permissions: [{ service: "capabilities", space: "applications", path: "", actions: ["tinycloud.capabilities/read"] }],
      };
      return response({
        status: "approved",
        relay: encryptRelay(relayPublicJwk!, transactionId, delegation),
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
      fetchFn: Object.assign(async (url: string | URL | Request, init?: RequestInit) => {
        if (calls === 0) {
          const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
          relayPublicJwk = body.relayPublicJwk as object;
        }
        return fetchFn(url, init);
      }, { preconnect: () => undefined }) as typeof globalThis.fetch,
      emitInstructions: () => undefined,
      wait: async () => undefined,
    })).rejects.toThrow(/wrong device binding/);
  });

  test("rejects a decrypted delegation that widens the requested Share permission", async () => {
    const { jwk, did } = generateKey();
    const transactionId = randomBytes(18).toString("base64url");
    let startBody: Record<string, unknown> | undefined;
    const fetchFn = Object.assign(async (url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      if (String(url).endsWith("/api/device-authorizations")) {
        startBody = body;
        return response({
          transactionId,
          userCode: "STUV-WXYZ",
          verificationUri: "https://openkey.so/device",
          verificationUriComplete: "https://openkey.so/device?user_code=STUV-WXYZ",
          expiresIn: 600,
          interval: 2,
        }, 201);
      }
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const delegation = {
        delegationHeader: { Authorization: "Bearer widened" },
        delegationCid: "bafy-widened",
        spaceId: "tinycloud:pkh:eip155:1:0x1111111111111111111111111111111111111111:applications",
        verificationMethod: did,
        jwk: startBody!.publicJwk,
        expiresAt,
        permissions: [{ service: "kv", space: "applications", path: "", actions: ["tinycloud.kv/write"] }],
      };
      return response({
        status: "approved",
        relay: encryptRelay(startBody!.relayPublicJwk as object, transactionId, delegation),
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

    await expect(acquireShareDeviceDelegation({
      sessionDid: did,
      jwk,
      nodeOrigin: "https://node.tinycloud.xyz",
      shareOrigin: "https://share.tinycloud.xyz",
      fetchFn,
      emitInstructions: () => undefined,
      wait: async () => undefined,
    })).rejects.toThrow(/outside the requested Share scope/);
  });
});
