import { describe, expect, it } from "vitest";
import { ed25519 } from "@noble/curves/ed25519";
import { sha256 } from "@noble/hashes/sha256";

import {
  canonicalize,
  computeCid,
  didKeyFromEd25519PublicKey,
  shareEnvelopeV3Schema,
  signEnvelopeV3,
  toBase64Url,
  unifiedPolicySchema,
  verifyEnvelopeV3SignatureOnly,
} from "../src/index.js";

const POLICY_V2_DOMAIN = "xyz.tinycloud.policy/policy/v2\0";

describe("ShareEnvelopeV3 Policy/v2", () => {
  it("round-trips the frozen credential projection through production exports without weakening Policy/v1", async () => {
    const vector = (await Bun.file(
      `${import.meta.dir}/../../sdk-core/test-fixtures/policy-engine-vectors/unified-policy/credential-requirement.json`,
    ).json()) as { policyProjection: Record<string, unknown> };
    const privateKey = new Uint8Array(32).fill(47);
    const ownerDid = didKeyFromEd25519PublicKey(ed25519.getPublicKey(privateKey));
    const nodeDid = didKeyFromEd25519PublicKey(ed25519.getPublicKey(new Uint8Array(32).fill(48)));
    const spaceId = "tinycloud:pkh:eip155:1:0x1111111111111111111111111111111111111111:share";
    const contentSource = {
      shareId: "share-policy-v2",
      kvResource: `${spaceId}/kv/shares/report.txt`,
      selector: "exact" as const,
      encryptionNetwork: `urn:tinycloud:encryption:${ownerDid}:default`,
      encryptedSymmetricKeyDigestHex: "a".repeat(64),
      keyVersion: 1,
      mode: "immutable" as const,
      initialCiphertextDigestHex: "b".repeat(64),
    };
    const capabilityCeiling = [
      {
        kind: "kv" as const,
        resource: contentSource.kvResource,
        selector: "exact" as const,
        actions: ["tinycloud.kv/get" as const, "tinycloud.kv/metadata" as const],
      },
      {
        kind: "encryption" as const,
        resource: contentSource.encryptionNetwork,
        action: "tinycloud.encryption/decrypt" as const,
      },
    ];
    const unsignedPolicy = {
      schema: "xyz.tinycloud.policy/policy/v2" as const,
      ownerDid,
      createdAt: "2026-08-03T12:00:00Z",
      expiresAt: "2026-08-04T12:00:00Z",
      contentSource,
      capabilityCeiling,
      credentialRequirement: vector.policyProjection,
    };
    const policyDigest = sha256(new TextEncoder().encode(
      `${POLICY_V2_DOMAIN}${canonicalize(unsignedPolicy)}`,
    ));
    const policy = unifiedPolicySchema.parse({
      ...unsignedPolicy,
      policyId: `pol_${base32Lower(policyDigest)}`,
      signature: {
        suite: "Ed25519",
        signerDid: ownerDid,
        value: toBase64Url(ed25519.sign(policyDigest, privateKey)),
      },
    });
    const policyCid = await computeCid(new TextEncoder().encode(canonicalize(policy)));
    const envelope = signEnvelopeV3({
      version: 3,
      shareId: contentSource.shareId,
      recipientMatcher: { kind: "policyDigest", value: "c".repeat(43) },
      actions: ["read"],
      resource: { kind: "exact", path: "shares/report.txt" },
      target: {
        origin: "https://node.example.test",
        nodeAudience: ownerDid,
        spaceId,
      },
      policy,
      policyCid,
      policyRoot: { cid: "policy-root", authorization: "a.b.c", role: "policy-authority" },
      enforcementRoot: { cid: "enforcement-root", authorization: "d.e.f", role: "policy-enforcement" },
      attestedEnforcerBinding: {
        schema: "xyz.tinycloud.policy/attested-enforcer/v2",
        enforcerDid: ownerDid,
        nodeAudience: nodeDid,
        attestationBindingDigestHex: "d".repeat(64),
        issuedAt: "2026-08-03T12:00:00Z",
        expiresAt: "2026-08-04T12:00:00Z",
        signature: { suite: "Ed25519", signerDid: nodeDid, value: toBase64Url(new Uint8Array(64)) },
      },
      contentSource,
      contentSourceDigestHex: "e".repeat(64),
      encryptionNetwork: contentSource.encryptionNetwork,
      expiry: "2026-08-04T12:00:00Z",
      display: { filename: "report.txt" },
      encrypted: true,
      metadata: { mediaType: "text/plain", byteLength: 12, filename: "report.txt", encoding: "utf-8" },
    }, privateKey);

    const roundTripped = shareEnvelopeV3Schema.parse(JSON.parse(JSON.stringify(envelope)));
    expect(roundTripped.policy).toEqual(policy);
    expect(roundTripped.target.nodeAudience).toBe(ownerDid);
    expect(roundTripped.attestedEnforcerBinding!.enforcerDid).toBe(ownerDid);
    expect(roundTripped.attestedEnforcerBinding!.nodeAudience).toBe(nodeDid);
    expect(roundTripped.attestedEnforcerBinding!.signature.signerDid).toBe(nodeDid);
    if (roundTripped.policy.schema !== "xyz.tinycloud.policy/policy/v2") throw new Error("expected Policy/v2");
    expect(roundTripped.policy.credentialRequirement).toEqual(vector.policyProjection);
    expect(verifyEnvelopeV3SignatureOnly(roundTripped)).toBe(true);

    const { credentialRequirement: _requirement, ...v1Fields } = unsignedPolicy;
    const v1 = { ...v1Fields, schema: "xyz.tinycloud.policy/policy/v1", policyId: policy.policyId, signature: policy.signature };
    expect(unifiedPolicySchema.safeParse(v1).success).toBe(true);
    expect(unifiedPolicySchema.safeParse({ ...v1, credentialRequirement: vector.policyProjection }).success).toBe(false);
    expect(unifiedPolicySchema.safeParse({ ...policy, credentialRequirement: undefined }).success).toBe(false);
    expect(shareEnvelopeV3Schema.safeParse({
      ...envelope,
      attestedEnforcerBinding: {
        ...envelope.attestedEnforcerBinding,
        signature: { ...envelope.attestedEnforcerBinding!.signature, signerDid: ownerDid },
      },
    }).success).toBe(false);
    expect(shareEnvelopeV3Schema.safeParse({
      ...envelope,
      target: { ...envelope.target, nodeAudience: nodeDid },
    }).success).toBe(false);
  });

  it("covers the policy-engine binding with the envelope signature", async () => {
    const privateKey = new Uint8Array(32).fill(51);
    const ownerDid = didKeyFromEd25519PublicKey(ed25519.getPublicKey(privateKey));
    const base = await minimalV3Envelope(privateKey, ownerDid);

    // A share with no engine enrolled is still valid: the field is optional so
    // a deployment can ship before it has an engine.
    expect(shareEnvelopeV3Schema.safeParse(base.envelope).success).toBe(true);

    const binding = {
      endpoint: "https://policy.example.test",
      audience: "urn:tinycloud:policy-engine:test",
      grantIssuerDid: didKeyFromEd25519PublicKey(ed25519.getPublicKey(new Uint8Array(32).fill(52))),
      policyId: `pol_${"a".repeat(52)}`,
      requirementId: "recipient-email",
    };
    const localContent = {
      keyWrap: "share-envelope-aes-gcm-v1" as const,
      wrappedKey: toBase64Url(new Uint8Array(61).fill(7)),
      ciphertextDigest: toBase64Url(new Uint8Array(32).fill(8)),
    };
    const bound = signEnvelopeV3({
      ...base.unsigned,
      policyRoot: undefined,
      enforcementRoot: undefined,
      attestedEnforcerBinding: undefined,
      policyEngine: binding,
      localContent,
    }, privateKey);
    const parsed = shareEnvelopeV3Schema.parse(JSON.parse(JSON.stringify(bound)));
    expect(parsed.policyEngine).toEqual(binding);
    expect(parsed.localContent).toEqual(localContent);
    expect(verifyEnvelopeV3SignatureOnly(parsed)).toBe(true);

    // The recipient decides which engine to trust and which policy to name from
    // these bytes, so substituting either must break the signature rather than
    // silently redirect the presentation.
    expect(verifyEnvelopeV3SignatureOnly({
      ...parsed,
      policyEngine: { ...binding, endpoint: "https://attacker.example.test" },
    })).toBe(false);
    expect(verifyEnvelopeV3SignatureOnly({
      ...parsed,
      policyEngine: { ...binding, policyId: `pol_${"b".repeat(52)}` },
    })).toBe(false);
    expect(() => verifyEnvelopeV3SignatureOnly({ ...parsed, policyEngine: undefined })).toThrow();
    expect(verifyEnvelopeV3SignatureOnly({
      ...parsed,
      localContent: { ...localContent, ciphertextDigest: toBase64Url(new Uint8Array(32).fill(9)) },
    })).toBe(false);

    // Structural refusals: a non-https engine, a non-content-addressed policy
    // id, and an unknown member all fail closed.
    for (const invalid of [
      { ...binding, endpoint: "http://policy.example.test" },
      { ...binding, policyId: "pol_short" },
      { ...binding, extra: "x" },
    ]) {
      expect(shareEnvelopeV3Schema.safeParse({ ...parsed, policyEngine: invalid }).success).toBe(false);
    }
  });
});

function base32Lower(bytes: Uint8Array): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  let output = "";
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(buffer << (5 - bits)) & 31];
  return output;
}

async function minimalV3Envelope(privateKey: Uint8Array, ownerDid: string) {
  const nodeDid = didKeyFromEd25519PublicKey(ed25519.getPublicKey(new Uint8Array(32).fill(53)));
  const spaceId = "tinycloud:pkh:eip155:1:0x2222222222222222222222222222222222222222:share";
  const contentSource = {
    shareId: "share-engine-binding",
    kvResource: `${spaceId}/kv/shares/report.txt`,
    selector: "exact" as const,
    encryptionNetwork: `urn:tinycloud:encryption:${ownerDid}:default`,
    encryptedSymmetricKeyDigestHex: "a".repeat(64),
    keyVersion: 1,
    mode: "immutable" as const,
    initialCiphertextDigestHex: "b".repeat(64),
  };
  const capabilityCeiling = [
    { kind: "kv" as const, resource: contentSource.kvResource, selector: "exact" as const, actions: ["tinycloud.kv/get" as const] },
    { kind: "encryption" as const, resource: contentSource.encryptionNetwork, action: "tinycloud.encryption/decrypt" as const },
  ];
  const unsignedPolicy = {
    schema: "xyz.tinycloud.policy/policy/v1" as const,
    ownerDid,
    createdAt: "2026-08-03T12:00:00Z",
    expiresAt: "2026-08-04T12:00:00Z",
    contentSource,
    capabilityCeiling,
  };
  const policyDigest = sha256(new TextEncoder().encode(
    `xyz.tinycloud.policy/policy/v1\0${canonicalize(unsignedPolicy)}`,
  ));
  const policy = unifiedPolicySchema.parse({
    ...unsignedPolicy,
    policyId: `pol_${base32Lower(policyDigest)}`,
    signature: { suite: "Ed25519", signerDid: ownerDid, value: toBase64Url(ed25519.sign(policyDigest, privateKey)) },
  });
  const policyCid = await computeCid(new TextEncoder().encode(canonicalize(policy)));
  const unsigned = {
    version: 3 as const,
    shareId: contentSource.shareId,
    recipientMatcher: { kind: "exactEmail" as const, value: "recipient@example.test" },
    actions: ["read" as const],
    resource: { kind: "exact" as const, path: "shares/report.txt" },
    target: { origin: "https://node.example.test", nodeAudience: ownerDid, spaceId },
    policy,
    policyCid,
    policyRoot: { cid: "policy-root", authorization: "a.b.c", role: "policy-authority" as const },
    enforcementRoot: { cid: "enforcement-root", authorization: "d.e.f", role: "policy-enforcement" as const },
    attestedEnforcerBinding: {
      schema: "xyz.tinycloud.policy/attested-enforcer/v2" as const,
      enforcerDid: ownerDid,
      nodeAudience: nodeDid,
      attestationBindingDigestHex: "d".repeat(64),
      issuedAt: "2026-08-03T12:00:00Z",
      expiresAt: "2026-08-04T12:00:00Z",
      signature: { suite: "Ed25519" as const, signerDid: nodeDid, value: toBase64Url(new Uint8Array(64)) },
    },
    contentSource,
    contentSourceDigestHex: "e".repeat(64),
    encryptionNetwork: contentSource.encryptionNetwork,
    expiry: "2026-08-04T12:00:00Z",
    display: { filename: "report.txt" },
    encrypted: true as const,
    metadata: { mediaType: "text/plain", byteLength: 12, filename: "report.txt", encoding: "utf-8" as const },
  };
  return { unsigned, envelope: signEnvelopeV3(unsigned, privateKey) };
}
