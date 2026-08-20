import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { readFile } from "node:fs/promises";
import { ProfileManager } from "../config/profiles.js";
import { NodeWasmBindings } from "../../../node-sdk/src/NodeWasmBindings.js";
import { PrivateKeySigner } from "../../../node-sdk/src/signers/PrivateKeySigner.js";
import { createProductionUploadAuthorizer, createShareAuthorityAdapters, postAddressedShareDelivery } from "./adapters.js";

const upload = {
  blob: new Uint8Array([1, 2, 3]),
  cid: "bafkreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  deleteAfter: "2030-01-01T00:00:00.000Z",
  contentLength: 3,
};

const profile = {
  name: "openkey-profile",
  host: "https://node.example",
  chainId: 1,
  spaceName: "default",
  did: "did:pkh:eip155:1:0x1111111111111111111111111111111111111111",
  sessionDid: "did:key:session",
  createdAt: "2026-01-01T00:00:00.000Z",
  authMethod: "openkey" as const,
};
const session = await (async () => {
  const wasm = new NodeWasmBindings();
  const signer = new PrivateKeySigner("7".repeat(64));
  const address = await signer.getAddress();
  const chainId = await signer.getChainId();
  const manager = wasm.createSessionManager();
  const jwk = JSON.parse(manager.jwk("default")!);
  profile.sessionDid = manager.getDID("default");
  const spaceId = wasm.makeSpaceId(address, chainId, "default");
  const prepared = wasm.prepareSession({ abilities: { kv: { "": ["tinycloud.kv/get"] } }, address, chainId, domain: "localhost", issuedAt: new Date().toISOString(), expirationTime: new Date(Date.now() + 60_000).toISOString(), spaceId, jwk });
  const complete = wasm.completeSessionSetup({ ...prepared, signature: await signer.signMessage(prepared.siwe) });
  return { ...complete, jwk, verificationMethod: profile.sessionDid };
})();
const restore: Array<{ mockRestore: () => void }> = [];

beforeEach(() => {
  restore.push(spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    if (String(input).endsWith("/delegate")) {
      return new Response(JSON.stringify({ activated: [] }), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw new Error("unexpected test fetch");
  }));
});

afterEach(() => {
  while (restore.length > 0) restore.pop()?.mockRestore();
});

describe("Share upload authority adapter", () => {
  it("routes addressed delivery through Policy/v3 with no retired Node delivery fallback", async () => {
    const source = await readFile(new URL("./adapters.ts", import.meta.url), "utf8");
    expect(source).toContain("node.authorizeShareDeliveryV3({");
    expect(source).not.toContain("node.authorizeShareDelivery({");
    expect(source).not.toContain("/share/v2/deliveries/authorize");
  });

  it("posts the exact signed delivery receipt only to OpenCredentials", async () => {
    const credentialsOrigin = "https://credentials.example";
    const emailOrigin = "https://email.example";
    const authorization = { type: "TinyCloudShareDeliveryAuthorization", version: 2 };
    const proof = { alg: "EdDSA", kid: "did:web:node.example#key", signature: "test-signature" };
    const shareUrl = "share-url-with-private-fragment";
    const calls: Array<{ readonly url: string; readonly init?: RequestInit }> = [];

    const response = await postAddressedShareDelivery({
      credentialsOrigin,
      receipt: { authorization, proof },
      shareUrl,
      fetchFn: (async (input, init) => {
        calls.push({ url: String(input), init });
        return new Response(null, { status: 202 });
      }) as typeof globalThis.fetch,
    });

    expect(response.status).toBe(202);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`${credentialsOrigin}/share/v2`);
    expect(calls[0]?.url).not.toBe(`${emailOrigin}/share/v2`);
    expect(calls[0]?.init).toMatchObject({
      method: "POST",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
    });
    expect(calls[0]?.init).not.toHaveProperty("referrer");
    expect(calls[0]?.init?.headers).toEqual({ accept: "application/json", "content-type": "application/json" });
    const body = JSON.parse(String(calls[0]?.init?.body));
    expect(body).toEqual({ authorization, proof, shareUrl });
    expect(Object.keys(body).sort()).toEqual(["authorization", "proof", "shareUrl"]);
  });

  it("uses an explicit noninteractive acquisition hook without reading or persisting a private JWK", async () => {
    let received: string | undefined;
    const authorize = createProductionUploadAuthorizer({
      profileName: async () => "openkey-profile",
      testOnly: true,
      acquireUploadAuthorization: async (input) => {
        received = input.profileName;
        expect(input.upload.cid).toBe(upload.cid);
        return { cookie: "share_session_opaque" };
      },
    });

    await expect(authorize(upload)).resolves.toEqual({ cookie: "share_session_opaque" });
    expect(received).toBe("openkey-profile");
  });

  it("accepts an already host-issued session as the resumable authority", async () => {
    const authorize = createProductionUploadAuthorizer({
      profileName: async () => "openkey-profile",
      testOnly: true,
      sessionAuthorization: async () => ({ cookie: "share_session_opaque" }),
    });
    await expect(authorize(upload)).resolves.toEqual({ cookie: "share_session_opaque" });
  });

  it("retires production Node upload authorization without a network fallback", async () => {
    const requests: string[] = [];
    const authorize = createProductionUploadAuthorizer({
      origin: "https://share.tinycloud.xyz",
      profileName: async () => profile.name,
      fetchFn: (async (input) => { requests.push(String(input)); throw new Error("unexpected network request"); }) as typeof globalThis.fetch,
    });
    await expect(authorize(upload)).rejects.toThrow();
    expect(requests).toEqual([]);
  });

  it("uses the persisted recipient DID and rejects a wrong-DID envelope before the Node ceremony", async () => {
    restore.push(spyOn(ProfileManager, "getProfile").mockResolvedValue(profile));
    restore.push(spyOn(ProfileManager, "getSession").mockResolvedValue(session));
    const calls: string[] = [];
    const services = createShareAuthorityAdapters({
      profileName: async () => profile.name,
      fetchFn: (async (input: unknown) => {
        calls.push(String(input));
        return new Response(JSON.stringify({
          shareOrigin: "https://share.tinycloud.xyz", registryOrigin: "https://registry.tinycloud.xyz", nodeOrigin: profile.host, emailOrigin: "https://email.tinycloud.xyz", credentialsOrigin: "https://credentials.tinycloud.xyz", nodeAudience: "did:web:node.example", enforcerDid: "did:key:enforcer", nodeInvitationKid: "did:web:node.example#invitation", nodeInvitationPublicKey: "A".repeat(43),
        }), { status: 200 });
      }) as unknown as typeof globalThis.fetch,
    });
    const envelope = {
      version: 2, shareId: "share-id", recipientMatcher: { kind: "recipientDid", value: "did:key:other" }, actions: ["read"], resource: { kind: "exact", path: "docs/plan.md" }, target: { origin: profile.host, nodeAudience: "did:web:node.example", spaceId: "space" }, delegationCid: "bafy-delegation", authorityMaterialHandle: "handle", authorityMaterialDigest: "A".repeat(43), contentSource: { kind: "kv", space: "space", path: "docs/plan.md", action: "tinycloud.kv/get" }, contentSourceDigest: "B".repeat(43), authorizationTarget: { kind: "recipientDid", did: "did:key:other" }, display: {}, expiry: "2030-01-01T00:00:00.000Z", encrypted: true, metadata: { byteLength: 1, mediaType: "text/markdown" }, signature: { signerDid: "did:key:owner", algorithm: "Ed25519", value: "" },
    } as any;
    await expect(services.authorization.begin({ envelope, method: "openkey-device" })).resolves.toEqual({ state: "denied", reason: "rejected" });
    expect(calls).toHaveLength(1);
  });
});
