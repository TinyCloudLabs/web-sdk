import { describe, expect, it } from "bun:test";
import { ed25519 } from "@noble/curves/ed25519";
import { base58btc } from "multiformats/bases/base58";
import { publishAddressedShare, type AddressedPolicyRegistrationInput } from "../src/index.js";

const ownerSeed = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const ownerDid = `did:key:${base58btc.encode(Uint8Array.from([0xed, 0x01, ...ed25519.getPublicKey(ownerSeed)]))}`;
const nodeSeed = Uint8Array.from({ length: 32 }, (_, index) => index + 33);
const nodeDid = `did:key:${base58btc.encode(Uint8Array.from([0xed, 0x01, ...ed25519.getPublicKey(nodeSeed)]))}`;

async function fixture(inline = true) {
  let registration: AddressedPolicyRegistrationInput | undefined;
  let uploadDeleteAfter: string | undefined;
  const published = await publishAddressedShare({
    shareId: "addressedroundtrip0001",
    shareOrigin: "https://share.tinycloud.xyz",
    nodeOrigin: "https://node.example",
    nodeAudience: nodeDid,
    enforcerDid: nodeDid,
    spaceId: "tinycloud:test-space",
    target: { kind: "email", address: "alice@example.com" },
    resource: { kind: "exact", path: "shares/addressedroundtrip0001/readme.md" },
    actions: ["read"],
    policyActions: ["tinycloud.kv/get", "tinycloud.kv/metadata"],
    contentSource: {
      shareId: "addressedroundtrip0001",
      kvResource: "tinycloud:test-space/kv/shares/addressedroundtrip0001/readme.md",
      selector: "exact",
      encryptionNetwork: `urn:tinycloud:encryption:${ownerDid}:default`,
      encryptedSymmetricKeyDigestHex: "1".repeat(64),
      keyVersion: 1,
      mode: "immutable",
      initialCiphertextDigestHex: "2".repeat(64),
    },
    filename: "readme.md",
    mediaType: "text/markdown",
    byteLength: 8,
    expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    authority: {
      ownerDid,
      async createOwnerRoot(input) {
        return { cid: input.role === "policy-authority" ? "bafy-policy-root" : "bafy-enforcement-root", delegationHeader: { Authorization: input.role === "policy-authority" ? "a.b.c" : "d.e.f" } };
      },
      async sign(bytes) {
        return ed25519.sign(bytes, ownerSeed);
      },
      async registerPolicy(input) {
        registration = input;
        return {
          policyCid: input.policyCid,
          policyRootCid: input.policyRoot.cid,
          enforcementRootCid: input.enforcementRoot.cid,
          attestedEnforcerBinding: {
            schema: "xyz.tinycloud.policy/attested-enforcer/v2",
            enforcerDid: nodeDid,
            nodeAudience: nodeDid,
            attestationBindingDigestHex: "3".repeat(64),
            issuedAt: "2026-01-01T00:00:00.000Z",
            expiresAt: "2030-01-01T00:00:00.000Z",
            signature: { suite: "Ed25519", signerDid: nodeDid, value: "AQ" },
          },
        };
      },
    },
    inline,
    upload: inline ? {} : {
      uploadBlob: async (input) => {
        uploadDeleteAfter = input.deleteAfter;
        return { cid: input.cid, deleteAfter: input.deleteAfter };
      },
    },
  });
  return { published, registration, uploadDeleteAfter };
}

describe("canonical addressed publication", () => {
  it("builds a signed Policy/v3 envelope from an app-neutral registration callback", async () => {
    const { published, registration } = await fixture();
    expect(registration).toMatchObject({
      policyRoot: { cid: "bafy-policy-root", authorization: "a.b.c" },
      enforcementRoot: { cid: "bafy-enforcement-root", authorization: "d.e.f" },
      enforcerDid: nodeDid,
      expectedNodeAudience: nodeDid,
    });
    expect(published.metadata.policyCid).toBe(registration?.policyCid);
    expect(JSON.stringify(published)).not.toContain(published.url);
    expect(JSON.stringify(registration)).not.toContain("/share/");
  });

  it("preserves the registry's millisecond retention contract independently of policy expiry", async () => {
    const { published, uploadDeleteAfter } = await fixture(false);
    expect(published.metadata.expiresAt).toBe("2030-01-01T00:00:00Z");
    expect(uploadDeleteAfter).toBe("2030-01-01T00:00:00.000Z");
    expect(published.registryDeleteAfter).toBe(uploadDeleteAfter);
  });
});
