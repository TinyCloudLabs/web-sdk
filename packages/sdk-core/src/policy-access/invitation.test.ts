import { describe, expect, test } from "bun:test";
import { ed25519 } from "@noble/curves/ed25519";
import { didKeyFromEd25519PublicKey } from "./holder";
import {
  CREDENTIAL_INVITATION_PATH,
  DELIVERY_ADMISSION_PATH,
  requestCredentialInvitationDelivery,
} from "./invitation";
import type { PolicyAccessHttpRequest, PolicyAccessTransport } from "./transport";

const policyOrigin = "https://policy.example";
const deliveryOrigin = "https://credentials.example";
const now = new Date("2026-08-19T12:00:00Z");
const seed = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const senderDid = didKeyFromEd25519PublicKey(ed25519.getPublicKey(seed));

function transport(mutate?: (admission: Record<string, unknown>) => void) {
  const requests: PolicyAccessHttpRequest[] = [];
  const implementation: PolicyAccessTransport = {
    async request(request) {
      requests.push(request);
      if (request.url.endsWith(DELIVERY_ADMISSION_PATH)) {
        const body = (request.body as { request: Record<string, unknown> }).request;
        const admission: Record<string, unknown> = {
          schema: "xyz.tinycloud.policy/delivery-admission/v0",
          policyId: body.policyId,
          ownerDid: "did:key:z6MkOwner",
          recipient: "sam@example.com",
          resource: body.resource,
          actions: ["tinycloud.kv/get"],
          credentialType: body.credentialType,
          returnLink: body.returnLink,
          envelopeRef: body.envelopeRef,
          senderKeyDid: senderDid,
          audience: body.audience,
          issuedAt: body.issuedAt,
          expiresAt: body.expiresAt,
          nonce: body.nonce,
          signature: {
            suite: "eddsa-ed25519-sha256-jcs-v1",
            signerDid: "did:key:z6MkEngine",
            value: "signature",
          },
        };
        mutate?.(admission);
        return { status: 200, body: { admission }, finalUrl: request.url };
      }
      return { status: 202, body: { status: "accepted" }, finalUrl: request.url };
    },
  };
  return { requests, implementation };
}

function input(implementation: PolicyAccessTransport) {
  return {
    policyEngineEndpoint: policyOrigin,
    deliveryEndpoint: deliveryOrigin,
    policyId: "policy_123",
    resource: "did:pkh:eip155:1:0x123/kv/shares/doc",
    credentialType: "opencredentials.email/v1",
    returnLink: "https://share.example/s/bafkrei#k=secret",
    envelopeRef: "bafkrei",
    audience: deliveryOrigin,
    signerDid: senderDid,
    signDigest: (digest: Uint8Array) => ed25519.sign(digest, seed),
    transport: implementation,
    nonce: "AAAAAAAAAAAAAAAAAAAAAA",
    now,
    ttlSeconds: 300,
  } as const;
}

describe("generic credential invitation delivery", () => {
  test("authors the admission and delivery calls without a Node route", async () => {
    const { requests, implementation } = transport();
    const result = await requestCredentialInvitationDelivery(input(implementation));
    expect(result.status).toBe("accepted");
    expect(requests.map((request) => request.url)).toEqual([
      `${policyOrigin}${DELIVERY_ADMISSION_PATH}`,
      `${deliveryOrigin}${CREDENTIAL_INVITATION_PATH}`,
    ]);
    expect(requests.some((request) => new URL(request.url).pathname.startsWith("/share/"))).toBe(false);
    const delivery = requests[1]!.body as { request: Record<string, unknown>; admission: Record<string, unknown>; proof: Record<string, unknown> };
    expect(delivery.request).toMatchObject({
      recipient: "sam@example.com",
      resource: input(implementation).resource,
      policyId: "policy_123",
      credentialType: "opencredentials.email/v1",
      audience: deliveryOrigin,
      nonce: "AAAAAAAAAAAAAAAAAAAAAA",
    });
    expect(delivery.proof.kid).toBe(senderDid);
    expect(delivery.proof.signature).toMatch(/^[A-Za-z0-9_-]{86}$/);
  });

  test("rejects an admission that widens the engine-derived resource", async () => {
    const { implementation } = transport((admission) => {
      admission.resource = "other-space/kv/other";
    });
    await expect(requestCredentialInvitationDelivery(input(implementation))).rejects.toThrow(
      "invalid delivery admission",
    );
  });

  test("rejects overlong windows and an audience other than the delivery origin", async () => {
    const first = transport().implementation;
    await expect(requestCredentialInvitationDelivery({ ...input(first), ttlSeconds: 901 })).rejects.toThrow("TTL");
    const second = transport().implementation;
    await expect(requestCredentialInvitationDelivery({ ...input(second), audience: "https://other.example" })).rejects.toThrow("audience");
  });
});
