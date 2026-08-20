import { describe, expect, it } from "bun:test";
import { ed25519 } from "@noble/curves/ed25519";
import { canonicalize, type ShareEnvelopeV2, toBase64Url } from "@tinycloud/share-envelope";
import { createAddressedAuthorization, ShareRecipientClient } from "../src/recipient.js";

const nodePrivateKey = new Uint8Array(32).fill(41);
const nodePublicKey = ed25519.getPublicKey(nodePrivateKey);
const nodeKid = "did:web:node.example#invitation-key-1";

function envelope(resource = "documents/plan.md"): ShareEnvelopeV2 {
  return {
    version: 2,
    shareId: "share-recipient-proof",
    recipientMatcher: { kind: "exactEmail", value: "person@example.com" },
    actions: ["read"],
    resource: { kind: "exact", path: resource },
    target: { origin: "https://node.example", nodeAudience: "did:web:node.example", spaceId: "space" },
    delegationCid: "bafy-delegation",
    authorityMaterialHandle: "amh_share",
    authorityMaterialDigest: "A".repeat(43),
    contentSource: { kind: "kv", space: "space", path: resource, action: "tinycloud.kv/get" },
    contentSourceDigest: "B".repeat(43),
    authorizationTarget: { kind: "recipientDid", did: "did:key:z6Mkholder" },
    display: {},
    expiry: "2030-01-01T00:00:00.000Z",
    encrypted: true,
    metadata: { byteLength: 5, mediaType: "text/markdown" },
    signature: { signerDid: "did:key:z6Mksigner", algorithm: "Ed25519", value: "" },
  } as unknown as ShareEnvelopeV2;
}

async function digestText(value: string): Promise<string> {
  return toBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}

async function responseFor(target: ShareEnvelopeV2, content = "right"): Promise<Record<string, unknown>> {
  const response = {
    type: "TinyCloudShareInvokeResponse",
    version: 2,
    action: "tinycloud.kv/get",
    resource: target.resource.path,
    content: toBase64Url(new TextEncoder().encode(content)),
    bodyDigest: await digestText(content),
  };
  return {
    ...response,
    proof: {
      alg: "EdDSA",
      kid: nodeKid,
      signature: toBase64Url(ed25519.sign(new TextEncoder().encode(`xyz.tinycloud.share/read-response/v2\0${canonicalize(response)}`), nodePrivateKey)),
    },
  };
}

function addressedTarget(): ShareEnvelopeV2 {
  return {
    ...envelope(),
    ownerAuthority: {
      registrationCid: "registration",
      shareCid: "share-cid",
      envelopeCid: "envelope-cid",
      enforcementDelegation: { cid: "enforcement-cid" },
      outerEnvelope: {
        target: envelope().target,
        resource: envelope().resource,
        contentSource: envelope().contentSource,
        contentSourceDigest: envelope().contentSourceDigest,
        actions: ["tinycloud.kv/get"],
      },
    },
  } as ShareEnvelopeV2;
}

describe("addressed recipient response binding", () => {
  it("rejects a trusted node response signed for another resource", async () => {
    const target = envelope();
    const adapter = createAddressedAuthorization({
      nodeOrigin: "https://node.example",
      trustedNode: { invitationKid: nodeKid, invitationPublicKey: nodePublicKey },
      holderDid: "did:key:z6Mkholder",
    });
    const response = await responseFor(target, "wrong");
    response.resource = "documents/other.md";
    const value = {
      bytes: new TextEncoder().encode("wrong"),
      bodyDigest: response.bodyDigest,
      contentSourceDigest: target.contentSourceDigest,
      binding: { shareId: target.shareId, delegationCid: target.delegationCid, authorityMaterialHandle: target.authorityMaterialHandle, authorityMaterialDigest: target.authorityMaterialDigest, resource: target.resource },
      proof: { response },
    };
    await expect(adapter.verifyResult?.({ envelope: target, value, proof: value.proof })).resolves.toBe(false);
  });

  it("accepts a response whose signed resource matches the requested share", async () => {
    const target = envelope();
    const adapter = createAddressedAuthorization({
      nodeOrigin: "https://node.example",
      trustedNode: { invitationKid: nodeKid, invitationPublicKey: nodePublicKey },
      holderDid: "did:key:z6Mkholder",
    });
    const response = await responseFor(target);
    const value = {
      bytes: new TextEncoder().encode("right"),
      bodyDigest: response.bodyDigest as string,
      contentSourceDigest: target.contentSourceDigest,
      binding: { shareId: target.shareId, delegationCid: target.delegationCid, authorityMaterialHandle: target.authorityMaterialHandle, authorityMaterialDigest: target.authorityMaterialDigest, resource: target.resource },
      proof: { response, detached: response.proof },
    };
    await expect(adapter.verifyResult?.({ envelope: target, value, proof: value.proof })).resolves.toBe(true);
  });

  it("rejects a read response without a detached trusted-node proof", async () => {
    const target = envelope();
    const adapter = createAddressedAuthorization({
      nodeOrigin: "https://node.example",
      trustedNode: { invitationKid: nodeKid, invitationPublicKey: nodePublicKey },
      holderDid: "did:key:z6Mkholder",
    });
    const response = await responseFor(target);
    delete response.proof;
    const value = {
      bytes: new TextEncoder().encode("right"),
      bodyDigest: response.bodyDigest as string,
      contentSourceDigest: target.contentSourceDigest,
      binding: { shareId: target.shareId, delegationCid: target.delegationCid, authorityMaterialHandle: target.authorityMaterialHandle, authorityMaterialDigest: target.authorityMaterialDigest, resource: target.resource },
      proof: { response },
    };
    await expect(adapter.verifyResult?.({ envelope: target, value, proof: value.proof })).resolves.toBe(false);
  });

  it("refuses the retired Node /share/v2 policy challenge transport", async () => {
    const target = addressedTarget();
    const calls: string[] = [];
    const fetchFn = async (input: RequestInfo | URL): Promise<Response> => {
      calls.push(String(input));
      throw new Error("retired Share transport was used");
    };
    const client = new ShareRecipientClient({ nodeOrigin: "https://node.example", trustedNode: { invitationKid: nodeKid, invitationPublicKey: nodePublicKey }, holderDid: "did:key:z6Mkholder", envelope: target, fetchFn });
    await expect(client.beginChallenge(target)).rejects.toThrow("v2 Share recipient transport has been removed");
    expect(calls).toEqual([]);
  });

  it("refuses the retired Node /share/v2 resume transport", async () => {
    const target = addressedTarget();
    const holderPrivateKey = new Uint8Array(32).fill(73);
    const holderDid = "did:key:z6Mkholder";
    const calls: string[] = [];
    const fetchFn = async (input: RequestInfo | URL): Promise<Response> => {
      calls.push(String(input));
      throw new Error("retired Share transport was used");
    };
    const client = new ShareRecipientClient({ nodeOrigin: "https://node.example", trustedNode: { invitationKid: nodeKid, invitationPublicKey: nodePublicKey }, holderDid, envelope: target, fetchFn, sign: async (bytes) => ed25519.sign(bytes, holderPrivateKey) });
    await expect(client.resumeWithProof(target, "resume-token", { nonce: "nonce-resumed", credential: "credential", holderDid, holderBinding: { holderDid }, presentation: { type: "TinyCloudSharePolicyPresentation", version: 1 }, presentationProof: { alg: "EdDSA", kid: "holder-key", signature: "presented" } })).rejects.toThrow("v2 Share recipient transport has been removed");
    expect(calls).toEqual([]);
  });
});
