import { describe, expect, it } from "vitest";
import { shareEnvelopeV3Schema, toBase64Url, unifiedPolicySchema } from "../src/index.js";

const source = { type: "xyz.tinycloud.share/plaintext-kv/v1" as const, shareId: "plain-1", kvResource: "tinycloud:space/kv/shares/plain-1/report.txt", selector: "exact" as const, mode: "mutable" as const, contentDigestHex: "a".repeat(64) };
const kv = { kind: "kv" as const, resource: source.kvResource, selector: "exact" as const, actions: ["tinycloud.kv/get" as const] };
const policy = { schema: "xyz.tinycloud.policy/policy/v2" as const, policyId: "pol_abc", ownerDid: "did:key:zowner", createdAt: "2026-08-03T12:00:00Z", expiresAt: "2026-08-04T12:00:00Z", contentSource: source, capabilityCeiling: [kv], credentialRequirement: { type: "TinyCloudPolicyCredentialRequirement" as const, version: 1 as const, requirementDigest: "a".repeat(43), descriptorDigest: "b".repeat(43), issuerDid: "did:web:issuer", issuerKid: "did:web:issuer#key", profile: { id: "email", version: 1 as const }, credentialType: { id: "email", version: 1 as const } }, signature: { suite: "Ed25519" as const, signerDid: "did:key:zowner", value: "signature" } };

describe("plaintext exact-email V3 contract", () => {
  it("accepts KV-get-only plaintext and rejects decrypt authority", () => {
    expect(unifiedPolicySchema.safeParse(policy).success).toBe(true);
    const signature = toBase64Url(new Uint8Array(64));
    const envelope = { version: 3 as const, shareId: source.shareId, recipientMatcher: { kind: "exactEmail" as const, value: "reader@example.com" }, actions: ["read" as const], resource: { kind: "exact" as const, path: "shares/plain-1/report.txt" }, target: { origin: "https://node.example", nodeAudience: "did:key:zEnforcer", spaceId: "tinycloud:space" }, policy, policyCid: "policy", policyRoot: { cid: "root-a", authorization: "a.b.c", role: "policy-authority" as const }, enforcementRoot: { cid: "root-b", authorization: "d.e.f", role: "policy-enforcement" as const }, attestedEnforcerBinding: { schema: "xyz.tinycloud.policy/attested-enforcer/v2" as const, enforcerDid: "did:key:zEnforcer", nodeAudience: "did:key:zNode", attestationBindingDigestHex: "b".repeat(64), issuedAt: "2026-08-03T12:00:00Z", expiresAt: "2026-08-04T12:00:00Z", signature: { suite: "Ed25519" as const, signerDid: "did:key:zNode", value: signature } }, contentSource: source, contentSourceDigestHex: "c".repeat(64), expiry: "2026-08-04T12:00:00Z", display: { filename: "report.txt" }, encrypted: false, metadata: { mediaType: "text/plain", byteLength: 5, filename: "report.txt" }, signature: { signerDid: "did:key:zowner", algorithm: "Ed25519" as const, value: signature } };
    const parsed = shareEnvelopeV3Schema.safeParse(envelope);
    expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
    expect(shareEnvelopeV3Schema.safeParse({ ...envelope, policy: { ...policy, capabilityCeiling: [kv, { kind: "encryption", resource: "urn:tinycloud:encryption:did:key:zowner:default", action: "tinycloud.encryption/decrypt" }] } }).success).toBe(false);
  });
});
